import { useState } from 'react';
import { 
  X, UserPlus, Eye, EyeOff, ShieldCheck, Check, AlertTriangle, 
  Lock, Mail, User, Shield, Layers 
} from 'lucide-react';
import { 
  createEmployeeUser, 
  ERP_MODULES, 
  ROLE_DEFAULT_MODULES, 
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_LABELS, 
  ROLE_COLORS 
} from '../api/rbac.api';
import '../styles/Modals.css';

export default function CreateUserModal({ onClose, onUserCreated }) {
  const [form, setForm] = useState({
    displayName: '',
    username: '',
    password: '',
    email: '',
    role: 'employee',
    status: 'ACTIVE'
  });

  const [assignedModules, setAssignedModules] = useState(ROLE_DEFAULT_MODULES.employee);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRoleChange = (newRole) => {
    setForm(f => ({ ...f, role: newRole }));
    if (newRole === 'admin') {
      setAssignedModules(ERP_MODULES.map(m => m.id));
    } else {
      setAssignedModules(ROLE_DEFAULT_MODULES[newRole] || ROLE_DEFAULT_MODULES.employee);
    }
  };

  const handleToggleModule = (modId) => {
    if (form.role === 'admin') return; // Admins always have access to all modules
    setAssignedModules(prev => {
      if (prev.includes(modId)) {
        return prev.filter(id => id !== modId);
      } else {
        return [...prev, modId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanUsername = form.username.trim().toLowerCase().replace(/^@+/, '');
    if (!cleanUsername) {
      setErrorMsg('Please enter a username for the employee.');
      return;
    }
    if (cleanUsername.length < 3) {
      setErrorMsg('Username must be at least 3 characters long.');
      return;
    }
    if (!/^[a-z0-9._-]+$/.test(cleanUsername)) {
      setErrorMsg('Username can only contain lowercase letters, numbers, dots, and hyphens.');
      return;
    }
    if (!form.password || form.password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const cleanEmail = form.email.trim().toLowerCase() || `${cleanUsername}@kamaniplast.com`;

      const createdUser = await createEmployeeUser({
        username: cleanUsername,
        password: form.password,
        displayName: form.displayName.trim() || cleanUsername,
        email: cleanEmail,
        role: form.role,
        assignedModules: form.role === 'admin' ? ERP_MODULES.map(m => m.id) : assignedModules,
        permissions: form.role === 'admin' ? ROLE_DEFAULT_PERMISSIONS.admin : (ROLE_DEFAULT_PERMISSIONS[form.role] || ROLE_DEFAULT_PERMISSIONS.employee),
        status: form.status
      });

      setSuccessMsg(`User "${createdUser.displayName}" (${createdUser.username}) created successfully!`);
      if (onUserCreated) onUserCreated(createdUser);
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      console.error('Failed to create user:', err);
      setErrorMsg(err.message || 'Failed to create user account. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md" style={{ maxWidth: '620px' }}>
        {/* Header */}
        <div className="modal-header-dark" style={{ borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #bfdbfe'
            }}>
              <UserPlus size={19} />
            </div>
            <div>
              <div className="modal-title" style={{ fontSize: '1.15rem', color: '#0f172a' }}>
                Create Employee User Account
              </div>
              <div className="modal-sub" style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Register login credentials &amp; module access for new staff members
              </div>
            </div>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose} 
            disabled={loading}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} autoComplete="off" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Prevent browser password manager from autofilling admin credentials */}
          <input type="text" name="fake_user_remember" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
          <input type="password" name="fake_pwd_remember" style={{ display: 'none' }} tabIndex={-1} autoComplete="new-password" />

          <div className="modal-body" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px', overflowY: 'auto', maxHeight: 'calc(80vh - 120px)' }}>
            
            {/* Alert Messages */}
            {errorMsg && (
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#dc2626',
                fontSize: '0.82rem'
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#16a34a',
                fontSize: '0.82rem'
              }}>
                <Check size={16} style={{ flexShrink: 0 }} />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Section 1: Staff Credentials */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                1. Staff Profile &amp; Login Credentials
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Full Name */}
                <div className="mform-group">
                  <label className="mform-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                    Full Staff Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <User size={15} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                    <input
                      type="text"
                      name="staff_fullname_new"
                      autoComplete="off"
                      className="mform-input"
                      placeholder="e.g. Ramesh Patel"
                      value={form.displayName}
                      onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                      style={{ paddingLeft: '32px' }}
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {/* Username */}
                <div className="mform-group">
                  <label className="mform-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                    Login Username <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '10px', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 700 }}>@</span>
                    <input
                      type="text"
                      name="staff_username_new"
                      autoComplete="off"
                      className="mform-input"
                      placeholder="e.g. ramesh"
                      value={form.username}
                      onChange={e => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
                        setForm(f => ({ ...f, username: val }));
                      }}
                      style={{ paddingLeft: '30px' }}
                      required
                    />
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                    Employee will sign in using this username
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Password */}
                <div className="mform-group">
                  <label className="mform-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                    Login Password <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Lock size={15} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="staff_password_new"
                      autoComplete="new-password"
                      className="mform-input"
                      placeholder="Min 6 characters"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      style={{ paddingLeft: '32px', paddingRight: '36px' }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        background: 'none',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Email Address */}
                <div className="mform-group">
                  <label className="mform-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: '#334155' }}>
                    Email Address
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Mail size={15} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                    <input
                      type="email"
                      name="staff_email_new"
                      autoComplete="off"
                      className="mform-input"
                      placeholder="e.g. ramesh@kamaniplast.com (optional)"
                      value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      style={{ paddingLeft: '32px' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px' }}>
                    Optional: leave blank to auto-use @kamaniplast.com
                  </span>
                </div>
              </div>
            </div>

            {/* Section 2: Role Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                2. Assigned Security Role
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {[
                  { id: 'employee', label: 'Employee', desc: 'Plant & Floor operations' },
                  { id: 'accountant', label: 'Accountant', desc: 'Registers & Statements' },
                  { id: 'admin', label: 'Administrator', desc: 'Full System Access' }
                ].map(r => {
                  const isSelected = form.role === r.id;
                  const roleStyle = ROLE_COLORS[r.id] || ROLE_COLORS.employee;
                  return (
                    <div
                      key={r.id}
                      onClick={() => handleRoleChange(r.id)}
                      style={{
                        border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSelected ? '#f8fafc' : '#ffffff',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          background: roleStyle.bg,
                          color: roleStyle.text,
                          border: `1px solid ${roleStyle.border}`
                        }}>
                          {r.label}
                        </span>
                        {isSelected && <Check size={14} style={{ color: '#2563eb' }} />}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '6px' }}>
                        {r.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Module Permissions Checklist */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  3. Accessible ERP Modules ({assignedModules.length} of {ERP_MODULES.length})
                </span>
                {form.role === 'admin' ? (
                  <span style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>
                    Admins have full access to all modules
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAssignedModules(assignedModules.length === ERP_MODULES.length ? [] : ERP_MODULES.map(m => m.id))}
                    style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    {assignedModules.length === ERP_MODULES.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px'
              }}>
                {ERP_MODULES.map(mod => {
                  const isChecked = form.role === 'admin' || assignedModules.includes(mod.id);
                  return (
                    <label
                      key={mod.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        cursor: form.role === 'admin' ? 'default' : 'pointer',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: isChecked ? '#ffffff' : 'transparent',
                        border: isChecked ? '1px solid #cbd5e1' : '1px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={form.role === 'admin'}
                        onChange={() => handleToggleModule(mod.id)}
                        style={{ marginTop: '2px', accentColor: '#2563eb' }}
                      />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: isChecked ? '#0f172a' : '#64748b' }}>
                          {mod.label}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', lineHeight: 1.25 }}>
                          {mod.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Footer Actions */}
          <div className="modal-footer" style={{ padding: '14px 24px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              className="modal-btn-ghost"
              onClick={onClose}
              disabled={loading}
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="modal-btn-primary"
              disabled={loading}
              style={{
                padding: '8px 20px',
                fontSize: '0.85rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? (
                <>Creating Account...</>
              ) : (
                <>
                  <UserPlus size={16} /> Create User Account
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
