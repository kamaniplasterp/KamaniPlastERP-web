import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  signInWithPopup, 
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  onAuthStateChanged,
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
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth, googleProvider, isFirebaseConfigured } from '../firebase/firebase';
import { ROLE_DEFAULT_MODULES, ERP_MODULES, getDefaultRouteForRole } from '../api/rbac.api';
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

  // Verifies if an email address belongs to the master system administrator
  const isMasterAdminEmail = (emailStr = '') => {
    const e = (emailStr || '').toLowerCase().trim();
    return (
      e === 'admin@kamaniplast.com' ||
      e === 'kamaniplasterp@kamaniplast.com' ||
      e.startsWith('admin@')
    );
  };

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    let unsubUserDoc = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }

      if (currentUser && !currentUser.isAnonymous) {
        setUser(currentUser);

        // Real-time listener for user's assigned role and modules in Firestore
        if (db) {
          const userDocRef = doc(db, 'users', currentUser.uid);
          unsubUserDoc = onSnapshot(userDocRef, (snap) => {
            const data = snap.exists() ? snap.data() : {};
            const userEmail = (currentUser.email || '').toLowerCase().trim();
            const isMaster = isMasterAdminEmail(userEmail);

            // ── Clean Database-Driven RBAC Role Evaluation ──
            const validRoles = ['admin', 'accountant', 'employee'];
            const role = validRoles.includes(data.role) ? data.role : (isMaster ? 'admin' : 'employee');

            const assignedModules = role === 'admin'
              ? ERP_MODULES.map(m => m.id)
              : (Array.isArray(data.assignedModules) && data.assignedModules.length > 0
                  ? data.assignedModules
                  : (ROLE_DEFAULT_MODULES[role] || ROLE_DEFAULT_MODULES.employee));

            const profile = {
              uid: currentUser.uid,
              email: data.email || currentUser.email || '',
              username: data.username || (currentUser.email ? currentUser.email.split('@')[0] : ''),
              displayName: data.displayName || currentUser.displayName || data.username || 'Staff User',
              role: role,
              assignedModules: assignedModules,
              status: data.status || 'ACTIVE'
            };

            // If account has been disabled by Admin, force sign-out
            if (profile.status === 'DISABLED') {
              firebaseSignOut(auth).then(() => {
                setUser(null);
                setUserProfile(null);
                setError('Your account has been deactivated. Please contact your system administrator.');
              });
              return;
            }

            setUserProfile(profile);

            // If first time sign-in and document did not exist in Firestore, initialize baseline record
            if (!snap.exists()) {
              setDoc(userDocRef, {
                uid: currentUser.uid,
                email: userEmail,
                username: profile.username.toLowerCase(),
                displayName: profile.displayName,
                role: profile.role,
                assignedModules: profile.assignedModules,
                status: 'ACTIVE',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
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

  /**
   * Resolves a login input (which could be either a username or an email address)
   * into a valid registered email address.
   */
  const resolveEmail = async (input) => {
    const trimmed = (input || '').trim();
    if (!trimmed) return '';
    if (trimmed.includes('@')) return trimmed.toLowerCase();

    const usernameLower = trimmed.toLowerCase();
    
    // 1. Check Firestore `usernames/{usernameLower}` mapping collection
    if (db) {
      try {
        const uDocRef = doc(db, 'usernames', usernameLower);
        const uSnap = await getDoc(uDocRef);
        if (uSnap.exists() && uSnap.data()?.email) {
          return uSnap.data().email.toLowerCase().trim();
        }

        // 2. Query Firestore `users` collection where `username == usernameLower`
        const q = query(collection(db, 'users'), where('username', '==', usernameLower));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const userDoc = qSnap.docs[0].data();
          if (userDoc?.email) return userDoc.email.toLowerCase().trim();
        }
      } catch (e) {
        console.warn('Username lookup in Firestore failed, using domain fallback:', e);
      }
    }

    // 3. Fallback: Default to standard company domain
    return `${usernameLower}@kamaniplast.com`;
  };

  /**
   * Unified Login Handler - supports both username and email authentication
   */
  const login = async (usernameOrEmail, password) => {
    setError(null);
    const targetEmail = await resolveEmail(usernameOrEmail);

    try {
      const res = await signInWithEmailAndPassword(auth, targetEmail, password);

      // Verify account status
      if (db && res.user?.uid) {
        try {
          const snap = await getDoc(doc(db, 'users', res.user.uid));
          if (snap.exists() && snap.data()?.status === 'DISABLED') {
            await firebaseSignOut(auth);
            throw new Error('This account has been deactivated. Please contact your system administrator.');
          }
        } catch (statusErr) {
          if (statusErr.message.includes('deactivated')) throw statusErr;
        }
      }

      logAuditEvent({
        category: 'SECURITY',
        action: 'USER_LOGIN',
        summary: `User "${usernameOrEmail}" signed into system`,
        targetId: usernameOrEmail,
        user: res.user
      });

      // Compute initial landing route based on assigned role/modules
      let defaultRoute = '/dashboard';
      if (db && res.user?.uid) {
        try {
          const snap = await getDoc(doc(db, 'users', res.user.uid));
          if (snap.exists()) {
            const data = snap.data();
            defaultRoute = getDefaultRouteForRole(data.role || 'employee', data.assignedModules || []);
          }
        } catch (_) {}
      }

      return { user: res.user, defaultRoute };
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const signup = async (usernameOrEmail, password, displayName = 'Staff User') => {
    setError(null);
    const cleanInput = (usernameOrEmail || '').trim();
    const targetEmail = cleanInput.includes('@') 
      ? cleanInput.toLowerCase() 
      : `${cleanInput.toLowerCase()}@kamaniplast.com`;
    const rawUsername = cleanInput.includes('@') ? cleanInput.split('@')[0] : cleanInput;
    const resolvedName = displayName || rawUsername;

    try {
      const res = await createUserWithEmailAndPassword(auth, targetEmail, password);
      if (res.user && resolvedName) {
        await updateProfile(res.user, { displayName: resolvedName });
      }

      if (db && res.user?.uid) {
        const usernameLower = rawUsername.toLowerCase();
        // Save initial user doc
        await setDoc(doc(db, 'users', res.user.uid), {
          uid: res.user.uid,
          email: targetEmail,
          username: usernameLower,
          displayName: resolvedName,
          role: 'employee',
          assignedModules: ROLE_DEFAULT_MODULES.employee,
          status: 'ACTIVE',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Save username mapping
        await setDoc(doc(db, 'usernames', usernameLower), {
          email: targetEmail,
          uid: res.user.uid,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

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
          summary: `User "${userProfile?.displayName || user?.email || 'User'}" signed out of system`,
          targetId: user?.email || 'System'
        });
        await firebaseSignOut(auth);
        setUser(null);
        setUserProfile(null);
      } catch (err) {
        setError(err.message);
      }
    }
  };

  const resetPassword = async (email) => {
    setError(null);
    try {
      await firebaseSendPasswordResetEmail(auth, email.trim().toLowerCase());
      return true;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  // Authoritative RBAC Properties
  const userRole = userProfile?.role || 'employee';
  const isAdmin = userRole === 'admin';
  const assignedModules = Array.isArray(userProfile?.assignedModules)
    ? userProfile.assignedModules
    : (ROLE_DEFAULT_MODULES[userRole] || ROLE_DEFAULT_MODULES.employee);

  // Checks whether current user is permitted to access a given module route
  const hasAccess = (moduleKey) => {
    if (!moduleKey) return true;
    if (isAdmin) return true;
    return assignedModules.includes(moduleKey);
  };

  const allowedModules = isAdmin 
    ? ERP_MODULES.map(m => m.id)
    : assignedModules;

  const defaultRoute = getDefaultRouteForRole(userRole, assignedModules);

  const value = {
    user,
    userProfile,
    userRole,
    isAdmin,
    assignedModules,
    allowedModules,
    defaultRoute,
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
