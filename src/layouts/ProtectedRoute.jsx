import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

const MODULE_ROUTES = {
  dashboard: '/dashboard',
  jobwork: '/job-work',
  inventory: '/inventory',
  sales: '/sales',
  processMasters: '/process-masters',
  directory: '/directory'
};

export const ProtectedRoute = ({ children, module }) => {
  const { user, loading, hasAccess, allowedModules, userRole } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex-center min-vh-100 bg-slate-900 text-white">
        <div className="spinner-loader"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Enforce module-level permission
  if (module && !hasAccess(module)) {
    const firstAllowedKey = (allowedModules && allowedModules.length > 0) ? allowedModules[0] : null;
    const fallbackRoute = firstAllowedKey && MODULE_ROUTES[firstAllowedKey] ? MODULE_ROUTES[firstAllowedKey] : '/dashboard';

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        padding: '24px',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}>
        <div style={{
          maxWidth: '460px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '36px 32px',
          textAlign: 'center',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: '#fee2e2',
            color: '#dc2626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <ShieldAlert size={28} />
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
            Module Access Restricted
          </h2>

          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 8px', lineHeight: 1.5 }}>
            Your account ({user.email || userRole}) has not been granted access to this module.
          </p>

          <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '0 0 24px', lineHeight: 1.4 }}>
            Please contact an ERP Administrator to assign this module to your role.
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => navigate(fallbackRoute)}
              style={{
                background: '#0f172a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ArrowLeft size={14} /> Back to My Modules
            </button>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default ProtectedRoute;
