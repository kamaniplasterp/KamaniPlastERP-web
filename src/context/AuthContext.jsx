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
import { auth, googleProvider, isFirebaseConfigured } from '../firebase/firebase';

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
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        try {
          const anonRes = await signInAnonymously(auth);
          setUser(anonRes.user);
        } catch (err) {
          console.warn("KamaniPlastERP: Anonymous Auth disabled or failed:", err);
          setUser(null);
        } finally {
          setLoading(false);
        }
      }
    }, (err) => {
      console.error("Auth state change error:", err);
      setError(err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await signInWithEmailAndPassword(auth, email, password);
      return res.user;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const signup = async (email, password, displayName = 'ERP User') => {
    setError(null);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, password);
      if (res.user && displayName) {
        await updateProfile(res.user, { displayName });
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
