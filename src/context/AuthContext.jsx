import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  signInWithPopup, 
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  onAuthStateChanged,
  signInAnonymously,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import { db, auth, googleProvider, isFirebaseConfigured } from '../firebase/firebase';
import { ROLE_DEFAULT_MODULES, ERP_MODULES } from '../api/rbac.api';
import { logAuditEvent } from '../api/audit.api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    let unsubUserDoc = null;

    const isMasterAdminAccount = (emailStr = '', usernameStr = '', nameStr = '') => {
      const e = (emailStr || '').toLowerCase();
      const u = (usernameStr || '').toLowerCase();
      const n = (nameStr || '').toLowerCase();
      return (
        e.includes('admin') || 
        u.includes('admin') || 
        n.includes('admin') ||
        e.includes('kamani') || 
        u.includes('kamani') || 
        n.includes('kamani')
      );
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (currentUser && !currentUser.isAnonymous) {
        setUser(currentUser);
        saveUserMapping(currentUser);

        // Real-time listener for user's assigned role and modules in Firestore
        if (db) {
          const userDocRef = doc(db, 'users', currentUser.uid);
          unsubUserDoc = onSnapshot(userDocRef, (snap) => {
            const data = snap.exists() ? snap.data() : {};
            const isMaster = isMasterAdminAccount(
              currentUser.email,
              data.username || (currentUser.email ? currentUser.email.split('@')[0] : ''),
              data.displayName || currentUser.displayName
            );

            const role = isMaster ? 'admin' : (data.role || 'employee');
            const assignedModules = role === 'admin'
              ? ERP_MODULES.map(m => m.id)
              : (Array.isArray(data.assignedModules)
                  ? data.assignedModules
                  : (ROLE_DEFAULT_MODULES[role] || ROLE_DEFAULT_MODULES.employee));

            setUserProfile({
              uid: currentUser.uid,
              email: currentUser.email || '',
              displayName: data.displayName || currentUser.displayName || 'KamaniPlastERP',
              role,
              assignedModules,
              status: data.status || 'ACTIVE'
            });

            // Auto-heal admin privileges in Firestore document
            if (isMaster && data.role !== 'admin') {
              setDoc(userDocRef, {
                role: 'admin',
                assignedModules: ERP_MODULES.map(m => m.id),
                status: 'ACTIVE'
              }, { merge: true }).catch(console.warn);
            }
          }, (err) => {
            console.error('Error listening to user profile doc:', err);
          });
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Auth state change error:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
    };
  }, []);

  const saveUserMapping = async (userObj, rawUsername = '') => {
    if (!db || !userObj || !userObj.uid) return;
    try {
      const email = userObj.email || '';
      const defaultUsername = email ? email.split('@')[0] : '';
      const username = (rawUsername || userObj.displayName || defaultUsername).trim();
      const usernameLower = username.toLowerCase();

      if (usernameLower) {
        await setDoc(doc(db, 'usernames', usernameLower), {
          email: email,
          uid: userObj.uid,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Check if user doc already has a role
      const userDocRef = doc(db, 'users', userObj.uid);
      const existingSnap = await getDoc(userDocRef);
      const isMaster = (email || '').toLowerCase().includes('admin') ||
                       (email || '').toLowerCase().includes('kamani') ||
                       (usernameLower || '').includes('kamani') ||
                       (userObj.displayName || '').toLowerCase().includes('kamani');
      const defaultRole = isMaster ? 'admin' : 'employee';

      const initialData = {
        uid: userObj.uid,
        email: email,
        username: usernameLower,
        displayName: userObj.displayName || username,
        updatedAt: new Date().toISOString()
      };

      if (isMaster) {
        initialData.role = 'admin';
        initialData.assignedModules = ERP_MODULES.map(m => m.id);
        initialData.status = 'ACTIVE';
      } else if (!existingSnap.exists() || !existingSnap.data()?.role) {
        initialData.role = defaultRole;
        initialData.assignedModules = ROLE_DEFAULT_MODULES[defaultRole] || [];
        initialData.status = 'ACTIVE';
      }

      await setDoc(userDocRef, initialData, { merge: true });
    } catch (err) {
      console.warn('Error saving user mapping in Firestore:', err);
    }
  };

  const resolveEmail = async (input) => {
    const trimmed = input.trim();
    if (!trimmed) return '';
    if (trimmed.includes('@')) return trimmed;

    const usernameLower = trimmed.toLowerCase();
    
    // 1. Check Firestore `usernames/{username}` doc
    if (db) {
      try {
        const uDocRef = doc(db, 'usernames', usernameLower);
        const uSnap = await getDoc(uDocRef);
        if (uSnap.exists() && uSnap.data()?.email) {
          return uSnap.data().email;
        }

        // 2. Query Firestore `users` collection where `username` matches
        const q = query(collection(db, 'users'), where('username', '==', usernameLower));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const userDoc = qSnap.docs[0].data();
          if (userDoc?.email) return userDoc.email;
        }
      } catch (e) {
        console.warn('Username lookup in Firestore failed, using domain fallback:', e);
      }
    }

    // Default domain fallback
    return `${usernameLower}@kamaniplast.com`;
  };

  const login = async (usernameOrEmail, password) => {
    setError(null);
    const targetEmail = await resolveEmail(usernameOrEmail);
    try {
      const res = await signInWithEmailAndPassword(auth, targetEmail, password);
      await saveUserMapping(res.user, usernameOrEmail.includes('@') ? '' : usernameOrEmail);
      
      logAuditEvent({
        category: 'SECURITY',
        action: 'USER_LOGIN',
        summary: `User "${usernameOrEmail}" signed into system`,
        targetId: usernameOrEmail,
        user: res.user
      });

      return res.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const signup = async (usernameOrEmail, password, displayName = 'ERP User') => {
    setError(null);
    const targetEmail = usernameOrEmail.includes('@') 
      ? usernameOrEmail.trim() 
      : `${usernameOrEmail.trim().toLowerCase()}@kamaniplast.com`;
    const rawUsername = usernameOrEmail.includes('@') ? usernameOrEmail.split('@')[0] : usernameOrEmail.trim();
    const resolvedName = displayName || rawUsername;

    try {
      const res = await createUserWithEmailAndPassword(auth, targetEmail, password);
      if (res.user && resolvedName) {
        await updateProfile(res.user, { displayName: resolvedName });
      }
      await saveUserMapping(res.user, rawUsername);
      return res.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    setError(null);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await saveUserMapping(res.user);
      return res.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };


  const logout = async () => {
    setError(null);
    if (auth) {
      try {
        logAuditEvent({
          category: 'SECURITY',
          action: 'USER_LOGOUT',
          summary: `User "${user?.displayName || user?.email || 'User'}" signed out of system`,
          targetId: user?.email || 'System'
        });
        await firebaseSignOut(auth);
        setUser(null);
      } catch (err) {
        setError(err.message);
        throw err;
      }
    }
  };

  const resetPassword = async (email) => {
    setError(null);
    try {
      await firebaseSendPasswordResetEmail(auth, email);
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const isMasterUser = (user?.email || '').toLowerCase().includes('admin') ||
                       (user?.email || '').toLowerCase().includes('kamani') ||
                       (user?.displayName || '').toLowerCase().includes('kamani') ||
                       (userProfile?.displayName || '').toLowerCase().includes('kamani') ||
                       (userProfile?.email || '').toLowerCase().includes('kamani');
  const userRole = isMasterUser ? 'admin' : (userProfile?.role || 'employee');
  const isAdmin = userRole === 'admin';
  const assignedModules = Array.isArray(userProfile?.assignedModules)
    ? userProfile.assignedModules
    : (ROLE_DEFAULT_MODULES[userRole] || ROLE_DEFAULT_MODULES.employee);

  // Checks whether the current user is permitted to access a given module
  const hasAccess = (moduleKey) => {
    if (!moduleKey) return true;
    if (isAdmin) return true;
    return assignedModules.includes(moduleKey);
  };

  const allowedModules = isAdmin 
    ? ERP_MODULES.map(m => m.id)
    : assignedModules;

  const value = {
    user,
    userProfile,
    userRole,
    isAdmin,
    assignedModules,
    allowedModules,
    hasAccess,
    loading,
    error,
    isFirebaseConfigured,
    login,
    signup,
    loginWithGoogle,
    logout,
    resetPassword
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
