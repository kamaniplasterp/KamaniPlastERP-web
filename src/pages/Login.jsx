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
  const getFriendlyErrorMessage = (code) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account with this email address already exists.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters long.';
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please verify and try again.';
      case 'auth/invalid-credential':
        return 'Invalid email or password. Please check your credentials.';
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

    // Email Validation
    if (!email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    // Forgot Password Flow
    if (isForgot) {
      return errors;
    }

    // Name Validation (Signup only)
    if (isRegister) {
      if (!name.trim()) {
        errors.name = 'Full name is required';
      } else if (name.trim().length < 2) {
        errors.name = 'Name must be at least 2 characters';
      }
    }

    // Password Validation
    if (!password) {
      errors.password = 'Password is required';
    } else if (isRegister && password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    // Confirm Password Validation (Signup only)
    if (isRegister) {
      if (!confirmPassword) {
        errors.confirmPassword = 'Please confirm your password';
      } else if (confirmPassword !== password) {
        errors.confirmPassword = 'Passwords do not match';
      }
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
        await signup(email.trim(), password, name.trim());
        navigate('/dashboard');
      } else {
        await login(email.trim(), password);
        navigate('/dashboard');
      }
    } catch (err) {
      const friendlyMsg = err.code ? getFriendlyErrorMessage(err.code) : null;
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
          {/* Full Name Field (Register only) */}
          {isRegister && !isForgot && (
            <div className="simple-field">
              <label>Full Name</label>
              <div className={`field-input ${touched.name && errors.name ? 'is-invalid' : ''}`}>
                <User size={18} className="field-icon" />
                <input 
                  type="text" 
                  placeholder="Rajesh Kamani"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => handleBlur('name')}
                />
              </div>
              {touched.name && errors.name && (
                <span className="field-error-text">{errors.name}</span>
              )}
            </div>
          )}

          {/* Email Address Field */}
          <div className="simple-field">
            <label>Work Email Address</label>
            <div className={`field-input ${touched.email && errors.email ? 'is-invalid' : ''}`}>
              <Mail size={18} className="field-icon" />
              <input 
                type="email" 
                placeholder="name@kamaniplast.com"
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

          {/* Confirm Password Field (Register only) */}
          {isRegister && !isForgot && (
            <div className="simple-field">
              <label>Confirm Password</label>
              <div className={`field-input ${touched.confirmPassword && errors.confirmPassword ? 'is-invalid' : ''}`}>
                <Lock size={18} className="field-icon" />
                <input 
                  type={showConfirmPassword ? 'text' : 'password'} 
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => handleBlur('confirmPassword')}
                />
                <button 
                  type="button" 
                  className="eye-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {touched.confirmPassword && errors.confirmPassword && (
                <span className="field-error-text">{errors.confirmPassword}</span>
              )}
            </div>
          )}

          {/* Password Requirements hint for Register */}
          {isRegister && !isForgot && (
            <div className="password-hint">
              <span className={`hint-item ${password.length >= 6 ? 'valid' : ''}`}>
                <Check size={12} /> At least 6 characters
              </span>
              <span className={`hint-item ${confirmPassword && confirmPassword === password ? 'valid' : ''}`}>
                <Check size={12} /> Passwords match
              </span>
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

        {/* Social Login */}
        {!isForgot && (
          <>
            <div className="or-divider">OR</div>

            <button type="button" className="google-btn" onClick={handleGoogleSignIn} disabled={loading}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
