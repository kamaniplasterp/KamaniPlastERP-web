import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Factory, 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle,
  CheckCircle2,
  Check
} from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const { login, signup, loginWithGoogle, resetPassword, error: authError } = useAuth();
  
  const [isRegister, setIsRegister] = useState(false);
  const [isForgot, setIsForgot] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  
  // Validation & UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [touched, setTouched] = useState({});

  // Helper for Firebase error codes
  const getFriendlyErrorMessage = (code, inputVal = '') => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this username or email already exists. Please sign in.';
      case 'auth/invalid-email':
        return 'Please enter a valid username or email address.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/user-not-found':
        return 'No account found with this username or email address. Click Create Account to register.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Incorrect password or account credentials. Please check your password or click Create Account if you need to register.';
      case 'auth/too-many-requests':
        return 'Too many failed login attempts. Please try again later.';
      default:
        return null;
    }
  };

  // Field validation rules
  const validate = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Username / Email Validation
    if (!email.trim()) {
      errors.email = 'Username or Email is required';
    } else if (isForgot && !emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address for password reset';
    }

    // Forgot Password Flow
    if (isForgot) {
      return errors;
    }

    // Name Validation (Signup only - optional)
    if (isRegister && name.trim() && name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters';
    }

    // Password Validation
    if (!password) {
      errors.password = 'Password is required';
    } else if (isRegister && password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    // Confirm Password Validation (Signup only)
    if (isRegister && confirmPassword && confirmPassword !== password) {
      errors.confirmPassword = 'Passwords do not match';
    }

    return errors;
  };

  const errors = validate();

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const resetFormState = (newMode) => {
    setServerError(null);
    setMessage(null);
    setTouched({});
    if (newMode === 'login') {
      setIsRegister(false);
      setIsForgot(false);
    } else if (newMode === 'register') {
      setIsRegister(true);
      setIsForgot(false);
    } else if (newMode === 'forgot') {
      setIsForgot(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    setMessage(null);

    // Mark all fields as touched on submit
    setTouched({
      email: true,
      password: true,
      confirmPassword: true,
      name: true
    });

    if (Object.keys(errors).length > 0) {
      return;
    }

    setLoading(true);

    try {
      if (isForgot) {
        await resetPassword(email.trim());
        setMessage('Password reset email sent! Check your inbox.');
      } else if (isRegister) {
        await signup(email.trim(), password, name.trim() || email.trim());
        navigate('/dashboard');
      } else {
        await login(email.trim(), password);
        navigate('/dashboard');
      }
    } catch (err) {
      const friendlyMsg = err.code ? getFriendlyErrorMessage(err.code, email.trim()) : null;
      setServerError(friendlyMsg || err.message || 'Action failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setServerError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      const friendlyMsg = err.code ? getFriendlyErrorMessage(err.code) : null;
      setServerError(friendlyMsg || err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simple-auth-container">
      <div className="simple-auth-card">
        {/* Header */}
        <div className="simple-auth-header">
          <div className="simple-logo">
            <Factory size={28} />
          </div>
          <h2>KamaniPlast ERP</h2>
          <p>
            {isForgot 
              ? 'Reset your password' 
              : isRegister 
                ? 'Create a new account' 
                : 'Sign in to your account'}
          </p>
        </div>

        {/* Feedback Alerts */}
        {(serverError || authError) && (
          <div className="simple-alert error">
            <AlertCircle size={16} />
            <span>{serverError || authError}</span>
          </div>
        )}

        {message && (
          <div className="simple-alert success">
            <CheckCircle2 size={16} />
            <span>{message}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="simple-form" noValidate>
          {/* Username or Email Address Field */}
          <div className="simple-field">
            <label>Username or Email</label>
            <div className={`field-input ${touched.email && errors.email ? 'is-invalid' : ''}`}>
              <User size={18} className="field-icon" />
              <input 
                type="text" 
                placeholder="admin or name@kamaniplast.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur('email')}
              />
            </div>
            {touched.email && errors.email && (
              <span className="field-error-text">{errors.email}</span>
            )}
          </div>

          {/* Password Field */}
          {!isForgot && (
            <div className="simple-field">
              <div className="label-flex">
                <label>Password</label>
              </div>
              <div className={`field-input ${touched.password && errors.password ? 'is-invalid' : ''}`}>
                <Lock size={18} className="field-icon" />
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur('password')}
                />
                <button 
                  type="button" 
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {touched.password && errors.password && (
                <span className="field-error-text">{errors.password}</span>
              )}
            </div>
          )}

          {isForgot && (
            <button 
              type="button" 
              className="link-btn mt-1 text-center"
              onClick={() => resetFormState('login')}
            >
              ← Back to Sign In
            </button>
          )}

          <button 
            type="submit" 
            className="submit-btn" 
            disabled={loading}
          >
            {loading 
              ? 'Processing...' 
              : isForgot 
                ? 'Send Reset Link' 
                : isRegister 
                  ? 'Create Account' 
                  : 'Sign In'}
          </button>
        </form>

        {/* Footer Toggle Links */}
        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: '#64748b' }}>
          {isForgot ? (
            <button 
              type="button" 
              className="link-btn" 
              onClick={() => resetFormState('login')}
              style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: '600' }}
            >
              ← Back to Sign In
            </button>
          ) : isRegister ? (
            <p>
              Already have an account?{' '}
              <button 
                type="button" 
                onClick={() => resetFormState('login')}
                style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: '600' }}
              >
                Sign In
              </button>
            </p>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                type="button" 
                onClick={() => resetFormState('forgot')}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.8125rem' }}
              >
                Forgot Password?
              </button>
              <button 
                type="button" 
                onClick={() => resetFormState('register')}
                style={{ background: 'none', border: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}
              >
                Create Account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

