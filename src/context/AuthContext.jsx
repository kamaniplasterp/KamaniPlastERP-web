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
  getDocs 
} from 'firebase/firestore';
import { db, auth, googleProvider, isFirebaseConfigured } from '../firebase/firebase';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && !currentUser.isAnonymous) {
        setUser(currentUser);
        saveUserMapping(currentUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("Auth state change error:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
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

      await setDoc(doc(db, 'users', userObj.uid), {
        uid: userObj.uid,
        email: email,
        username: usernameLower,
        displayName: userObj.displayName || username,
        updatedAt: new Date().toISOString()
      }, { merge: true });
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

  const value = {
    user,
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
