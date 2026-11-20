import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Shield, User, Check, X, ShieldAlert, CheckCircle2, 
  RotateCcw, Save, Layers, Lock, Unlock, Eye, Plus, Edit2, 
  Briefcase, Package, Truck, Cog, BookUser, LayoutDashboard, Copy
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  subscribeUsers, 
  updateUserAccess, 
  ERP_MODULES, 
  ERP_SUBMODULES,
  ROLE_DEFAULT_MODULES, 
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_LABELS, 
  ROLE_COLORS,
  deriveAssignedModules
} from '../api/rbac.api';
import { logAuditEvent } from '../api/audit.api';
import { showAlert } from '../context/CustomAlertContext';
import '../styles/AssignPermissions.css';

const MODULE_ICON_MAP = {
  dashboard: LayoutDashboard,
  jobwork: Briefcase,
  inventory: Package,
  sales: Truck,
  processMasters: Cog,
  directory: BookUser
};

export default function AssignPermissionsView() {
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin, user: currentUser, userProfile: currentAdminProfile } = useAuth();

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Subscribe to live user records from Firestore
  useEffect(() => {
    const unsub = subscribeUsers((list) => {
      setUsers(list);
      setLoadingUsers(false);
    });
    return () => unsub();
  }, []);

  const effectiveUserId = userId || searchParams.get('userId');

  const targetUser = useMemo(() => {
    if (!effectiveUserId && users.length > 0) return users[0];
    return users.find(u => u.uid === effectiveUserId || u.id === effectiveUserId) || null;
  }, [effectiveUserId, users]);

  // Form Editing State
  const [role, setRole] = useState('employee');
  const [dashboardEnabled, setDashboardEnabled] = useState(true);
  const [permissions, setPermissions] = useState({});
  const [status, setStatus] = useState('ACTIVE');
  const [isSaving, setIsSaving] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);

  // Initialize or reload form when target user changes
  useEffect(() => {
    if (targetUser) {
      const uRole = targetUser.role || 'employee';
      setRole(uRole);
      setStatus(targetUser.status || 'ACTIVE');

      const defaultPerms = ROLE_DEFAULT_PERMISSIONS[uRole] || ROLE_DEFAULT_PERMISSIONS.employee;
      const initialPerms = targetUser.permissions && typeof targetUser.permissions === 'object'
        ? JSON.parse(JSON.stringify(targetUser.permissions))
        : JSON.parse(JSON.stringify(defaultPerms));
      setPermissions(initialPerms);

      const isDash = Array.isArray(targetUser.assignedModules)
        ? targetUser.assignedModules.includes('dashboard')
        : (uRole === 'admin' || (ROLE_DEFAULT_MODULES[uRole] || []).includes('dashboard'));
      setDashboardEnabled(isDash);
    }
  }, [targetUser?.id, targetUser?.uid, targetUser?.updatedAt]);

  // Handle changing user role
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    if (newRole === 'admin') {
      setDashboardEnabled(true);
      setPermissions(JSON.parse(JSON.stringify(ROLE_DEFAULT_PERMISSIONS.admin)));
    } else {
      const rolePerms = ROLE_DEFAULT_PERMISSIONS[newRole] || ROLE_DEFAULT_PERMISSIONS.employee;
      setPermissions(JSON.parse(JSON.stringify(rolePerms)));
      const roleModules = ROLE_DEFAULT_MODULES[newRole] || ROLE_DEFAULT_MODULES.employee;
      setDashboardEnabled(roleModules.includes('dashboard'));
    }
  };

  // Toggle single action for a sub-module with smart interlocking
  const handleToggleSubPermission = (subModuleId, action) => {
    if (role === 'admin') return;

    setPermissions(prev => {
      const current = prev[subModuleId] || { read: false, create: false, update: false };
      const nextVal = !current[action];
      const updated = { ...current, [action]: nextVal };

      // If user enables 'create' or 'update', 'read' must automatically be enabled
      if ((action === 'create' || action === 'update') && nextVal) {
        updated.read = true;
      }
      // If user disables 'read', 'create' and 'update' must be disabled
      if (action === 'read' && !nextVal) {
        updated.create = false;
        updated.update = false;
      }

      return {
        ...prev,
        [subModuleId]: updated
      };
    });
  };

  // Module-level Bulk Controls
  const handleModuleEnableAll = (moduleId) => {
    if (role === 'admin') return;
    const subs = ERP_SUBMODULES.filter(s => s.moduleId === moduleId);
    setPermissions(prev => {
      const updated = { ...prev };
      subs.forEach(s => {
        updated[s.id] = { read: true, create: true, update: true };
      });
      return updated;
    });
  };

  const handleModuleReadOnly = (moduleId) => {
    if (role === 'admin') return;
    const subs = ERP_SUBMODULES.filter(s => s.moduleId === moduleId);
    setPermissions(prev => {
      const updated = { ...prev };
      subs.forEach(s => {
        updated[s.id] = { read: true, create: false, update: false };
      });
      return updated;
    });
  };

  const handleModuleDisable = (moduleId) => {
    if (role === 'admin') return;
    const subs = ERP_SUBMODULES.filter(s => s.moduleId === moduleId);
    setPermissions(prev => {
      const updated = { ...prev };
      subs.forEach(s => {
        updated[s.id] = { read: false, create: false, update: false };
      });
      return updated;
    });
  };

  // Global Presets
  const handlePresetAll = () => {
    setRole('admin');
    setDashboardEnabled(true);
    setPermissions(JSON.parse(JSON.stringify(ROLE_DEFAULT_PERMISSIONS.admin)));
  };

  const handlePresetReadOnly = () => {
    const ro = {};
    ERP_SUBMODULES.forEach(sub => {
      ro[sub.id] = { read: true, create: false, update: false };
    });
    setPermissions(ro);
  };

  const handleResetRoleDefaults = () => {
    const rolePerms = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.employee;
    setPermissions(JSON.parse(JSON.stringify(rolePerms)));
    const roleModules = ROLE_DEFAULT_MODULES[role] || ROLE_DEFAULT_MODULES.employee;
    setDashboardEnabled(roleModules.includes('dashboard'));
  };

  const handleClearAll = () => {
    if (role === 'admin') setRole('employee');
    setDashboardEnabled(false);
    const cleared = {};
    ERP_SUBMODULES.forEach(sub => {
      cleared[sub.id] = { read: false, create: false, update: false };
    });
    setPermissions(cleared);
  };

  // Compute active module stats
  const activeModulesDerived = useMemo(() => {
    if (role === 'admin') return ERP_MODULES.map(m => m.id);
    return deriveAssignedModules(permissions, dashboardEnabled ? ['dashboard'] : []);
  }, [role, permissions, dashboardEnabled]);

  // Save handler
  const handleSave = async () => {
    if (!targetUser) return;
    setIsSaving(true);

    try {
      const finalAssignedModules = role === 'admin'
        ? ERP_MODULES.map(m => m.id)
        : activeModulesDerived;

      const finalPermissions = role === 'admin'
        ? ROLE_DEFAULT_PERMISSIONS.admin
        : permissions;

      await updateUserAccess(targetUser, {
        role,
        assignedModules: finalAssignedModules,
        permissions: finalPermissions,
        status
      });

      await logAuditEvent({
        category: 'SECURITY',
        action: 'RBAC_PERMISSIONS_UPDATED',
        summary: `Admin updated permissions for "${targetUser.displayName || targetUser.email}" (${role.toUpperCase()}, ${finalAssignedModules.length} Modules active)`,
        targetId: targetUser.email || targetUser.uid,
        details: {
          userUid: targetUser.uid || targetUser.id,
          role,
          assignedModules: finalAssignedModules,
          status
        }
      });

      await showAlert(`Permissions successfully saved for ${targetUser.displayName || targetUser.email}! Changes are active immediately.`, {
        type: 'success',
        title: 'Permissions Saved'
      });

      navigate('/directory?tab=rbac');
    } catch (err) {
      console.error('Error saving permissions:', err);
      await showAlert(`Failed to save permissions: ${err.message}`, {
        type: 'error',
        title: 'Error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyUidToClipboard = () => {
    if (!targetUser?.uid) return;
    navigator.clipboard?.writeText(targetUser.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  if (loadingUsers) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
        <div className="spinner-loader" style={{ margin: '0 auto 16px' }} />
        <div>Loading user directory &amp; permissions...</div>
      </div>
    );
  }

  if (!targetUser) {
    return (
      <div className="perm-page-container">
        <button type="button" className="perm-back-btn" onClick={() => navigate('/directory?tab=rbac')}>
          <ArrowLeft size={14} />
          <span>Back to Users &amp; RBAC</span>
        </button>
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
          <ShieldAlert size={48} style={{ color: '#ef4444', margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>User Record Not Found</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>The requested user account does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const initials = (targetUser.displayName || targetUser.email || 'US').slice(0, 2).toUpperCase();

  // Group sub-modules by their parent module
  const modulesWithSubs = ERP_MODULES.filter(m => m.id !== 'dashboard');

  return (
    <div className="perm-page-container">
      {/* ── Top Navigation Row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <button type="button" className="perm-back-btn" onClick={() => navigate('/directory?tab=rbac')}>
          <ArrowLeft size={14} />
          <span>Back to Users &amp; RBAC</span>
        </button>

        {/* User Switcher Dropdown */}
        <div className="perm-user-switcher">
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>Configure User:</span>
          <select
            className="perm-user-select"
            value={targetUser.uid || targetUser.id}
            onChange={(e) => navigate(`/assign-permissions/${e.target.value}`)}
          >
            {users.map(u => (
              <option key={u.uid || u.id} value={u.uid || u.id}>
                {u.displayName || u.username} ({u.email || u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Target User Profile Banner ── */}
      <div className="perm-user-card">
        <div className="perm-user-info">
          <div className="perm-avatar">
            {initials}
          </div>
          <div className="perm-user-details">
            <h2>{targetUser.displayName || 'No Display Name'}</h2>
            <div className="perm-user-meta">
              <span>{targetUser.email || 'No Email Set'}</span>
              <span>•</span>
              <span className="perm-uid-badge" title="Firebase UID">
                UID: {targetUser.uid ? `${targetUser.uid.slice(0, 10)}...` : 'N/A'}
              </span>
              <button
                type="button"
                onClick={copyUidToClipboard}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: '#64748b', display: 'flex' }}
                title="Copy UID"
              >
                <Copy size={12} />
              </button>
              {copiedUid && <span style={{ color: '#16a34a', fontSize: '0.72rem', fontWeight: 700 }}>Copied!</span>}
              <span>•</span>
              <span className={`perm-status-pill ${status === 'ACTIVE' ? 'active' : 'disabled'}`}>
                {status}
              </span>
            </div>
          </div>
        </div>

        {/* Status Switcher Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Account Status:</span>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              fontWeight: 700,
              background: status === 'ACTIVE' ? '#dcfce7' : '#fee2e2',
              color: status === 'ACTIVE' ? '#15803d' : '#b91c1c',
              cursor: 'pointer'
            }}
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED (Suspended)</option>
          </select>
        </div>
      </div>

      {/* ── SECTION 1: Select Primary Role ── */}
      <div>
        <h3 className="perm-section-title">
          <Shield size={16} style={{ color: '#2563eb' }} />
          <span>1. Select Primary Role</span>
        </h3>
        <div className="perm-roles-grid">
          {/* Admin Role Card */}
          <div
            className={`perm-role-card ${role === 'admin' ? 'selected' : ''}`}
            onClick={() => handleRoleChange('admin')}
          >
            <div className="perm-role-card-header">
              <span className="perm-role-name">Administrator</span>
              <span className="perm-role-badge" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                Full System
              </span>
            </div>
            <div className="perm-role-desc">
              Unrestricted full access to all manufacturing pipelines, stock registers, approvals, master settings, and user access controls.
            </div>
          </div>

          {/* Accountant Role Card */}
          <div
            className={`perm-role-card ${role === 'accountant' ? 'selected' : ''}`}
            onClick={() => handleRoleChange('accountant')}
          >
            <div className="perm-role-card-header">
              <span className="perm-role-name">Accountant</span>
              <span className="perm-role-badge" style={{ background: '#eff6ff', color: '#1d4ed8' }}>
                Operations &amp; Finance
              </span>
            </div>
            <div className="perm-role-desc">
              Standard access to job work challans, raw material inwards, inventory registers, billing rates, customer profiles, and reports.
            </div>
          </div>

          {/* Employee Role Card */}
          <div
            className={`perm-role-card ${role === 'employee' ? 'selected' : ''}`}
            onClick={() => handleRoleChange('employee')}
          >
            <div className="perm-role-card-header">
              <span className="perm-role-name">Employee</span>
              <span className="perm-role-badge" style={{ background: '#dcfce7', color: '#15803d' }}>
                Floor &amp; Custom Access
              </span>
            </div>
            <div className="perm-role-desc">
              Custom granular permissions. Strictly restricted to only the specific modules and operational actions assigned below.
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Module-Wise Permission Management ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 className="perm-section-title" style={{ margin: 0 }}>
            <Layers size={16} style={{ color: '#2563eb' }} />
            <span>2. Module-Wise Permissions Matrix</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '12px' }}>
              {activeModulesDerived.length} of {ERP_MODULES.length} Modules Permitted
            </span>
          </h3>

          {/* Quick Presets Toolbar */}
          <div className="perm-toolbar">
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Quick Presets:</span>
            <button type="button" className="perm-toolbar-btn primary" onClick={handlePresetAll}>
              <Check size={12} />
              <span>Grant Full Access</span>
            </button>
            <button type="button" className="perm-toolbar-btn" onClick={handlePresetReadOnly}>
              <Eye size={12} />
              <span>Read-Only All</span>
            </button>
            <button type="button" className="perm-toolbar-btn" onClick={handleResetRoleDefaults}>
              <RotateCcw size={12} />
              <span>Reset to Role Defaults</span>
            </button>
            <button type="button" className="perm-toolbar-btn" onClick={handleClearAll} style={{ color: '#dc2626' }}>
              <X size={12} />
              <span>Clear All</span>
            </button>
          </div>
        </div>

        {role === 'admin' && (
          <div style={{ padding: '14px 18px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#991b1b', fontSize: '0.82rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={18} style={{ flexShrink: 0 }} />
            <span>
              <strong>Administrator Mode Active:</strong> Administrators have unrestricted access to all ERP modules and actions. Granular sub-module restrictions do not apply to Admins.
            </span>
          </div>
        )}

        <div className="perm-modules-list">
          {/* ── Standalone Module: Dashboard ── */}
          <div className={`perm-module-card ${dashboardEnabled ? 'active' : 'disabled'}`}>
            <div className="perm-module-header">
              <div className="perm-module-title-group">
                <div className="perm-module-icon">
                  <LayoutDashboard size={20} />
                </div>
                <div>
                  <h4 className="perm-module-heading">Dashboard</h4>
                  <div className="perm-module-desc">
                    Executive overview, plant pipeline KPIs, active orders, and monthly revenue metrics
                  </div>
                </div>
              </div>
              <div className="perm-module-actions">
                <label className="perm-checkbox-label" style={{ gap: '8px', fontSize: '0.82rem', fontWeight: 700 }}>
                  <input
                    type="checkbox"
                    className="perm-checkbox-input"
                    checked={role === 'admin' || dashboardEnabled}
                    disabled={role === 'admin'}
                    onChange={e => setDashboardEnabled(e.target.checked)}
                  />
                  <span>{dashboardEnabled ? 'Dashboard Enabled' : 'Dashboard Disabled'}</span>
                </label>
              </div>
            </div>
          </div>

          {/* ── Modules with Granular Sub-Modules ── */}
          {modulesWithSubs.map(mod => {
            const ModIcon = MODULE_ICON_MAP[mod.id] || Layers;
            const subModules = ERP_SUBMODULES.filter(s => s.moduleId === mod.id);
            const activeSubCount = subModules.filter(s => permissions[s.id]?.read).length;
            const isModuleActive = role === 'admin' || activeSubCount > 0;

            return (
              <div key={mod.id} className={`perm-module-card ${isModuleActive ? 'active' : 'disabled'}`}>
                {/* Module Header */}
                <div className="perm-module-header">
                  <div className="perm-module-title-group">
                    <div className="perm-module-icon">
                      <ModIcon size={20} />
                    </div>
                    <div>
                      <h4 className="perm-module-heading">{mod.label}</h4>
                      <div className="perm-module-desc">{mod.description}</div>
                    </div>
                  </div>

                  <div className="perm-module-actions">
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: isModuleActive ? '#dcfce7' : '#f1f5f9',
                      color: isModuleActive ? '#15803d' : '#64748b',
                      border: `1px solid ${isModuleActive ? '#bbf7d0' : '#e2e8f0'}`
                    }}>
                      {role === 'admin' ? 'All Sub-Modules Permitted' : `${activeSubCount} of ${subModules.length} Sub-Modules Permitted`}
                    </span>

                    {role !== 'admin' && (
                      <>
                        <button
                          type="button"
                          className="perm-module-toggle-btn"
                          onClick={() => handleModuleEnableAll(mod.id)}
                          title="Grant Read, Create & Update across all submodules in this module"
                        >
                          Enable All
                        </button>
                        <button
                          type="button"
                          className="perm-module-toggle-btn"
                          onClick={() => handleModuleReadOnly(mod.id)}
                          title="Grant Read-Only across this module"
                        >
                          Read-Only
                        </button>
                        <button
                          type="button"
                          className="perm-module-toggle-btn"
                          onClick={() => handleModuleDisable(mod.id)}
                          title="Disable this entire module"
                          style={{ color: '#dc2626' }}
                        >
                          Disable
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Sub-modules Table */}
                <div className="perm-table-container">
                  <table className="perm-table">
                    <thead>
                      <tr>
                        <th>Sub-Module &amp; Functional Scope</th>
                        <th className="center">Read / View</th>
                        <th className="center">Create / Add</th>
                        <th className="center">Update / Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subModules.map(sub => {
                        const perm = permissions[sub.id] || { read: false, create: false, update: false };
                        const isRead = role === 'admin' || Boolean(perm.read);
                        const isCreate = role === 'admin' || Boolean(perm.create);
                        const isUpdate = role === 'admin' || Boolean(perm.update);

                        return (
                          <tr key={sub.id} style={{ background: isRead ? '#ffffff' : '#fafafa' }}>
                            <td>
                              <span className="perm-sub-label">{sub.label}</span>
                              <span className="perm-sub-desc">{sub.description}</span>
                            </td>
                            <td className="center">
                              <label className="perm-checkbox-label">
                                <input
                                  type="checkbox"
                                  className="perm-checkbox-input"
                                  checked={isRead}
                                  disabled={role === 'admin'}
                                  onChange={() => handleToggleSubPermission(sub.id, 'read')}
                                />
                              </label>
                            </td>
                            <td className="center">
                              <label className="perm-checkbox-label">
                                <input
                                  type="checkbox"
                                  className="perm-checkbox-input"
                                  checked={isCreate}
                                  disabled={role === 'admin'}
                                  onChange={() => handleToggleSubPermission(sub.id, 'create')}
                                />
                              </label>
                            </td>
                            <td className="center">
                              <label className="perm-checkbox-label">
                                <input
                                  type="checkbox"
                                  className="perm-checkbox-input"
                                  checked={isUpdate}
                                  disabled={role === 'admin'}
                                  onChange={() => handleToggleSubPermission(sub.id, 'update')}
                                />
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Sticky Bottom Action Bar ── */}
      <div className="perm-footer-bar">
        <div className="perm-footer-summary">
          <Shield size={18} style={{ color: '#2563eb' }} />
          <span>
            Configuring <strong>{targetUser.displayName || targetUser.email}</strong> • 
            Role: <strong style={{ textTransform: 'uppercase' }}>{role}</strong> • 
            <strong>{activeModulesDerived.length}</strong> Modules Permitted
          </span>
        </div>

        <div className="perm-footer-actions">
          <button
            type="button"
            className="perm-cancel-btn"
            disabled={isSaving}
            onClick={() => navigate('/directory?tab=rbac')}
          >
            Cancel / Discard
          </button>

          <button
            type="button"
            className="perm-save-btn"
            disabled={isSaving}
            onClick={handleSave}
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving Changes...' : 'Save Permissions'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
