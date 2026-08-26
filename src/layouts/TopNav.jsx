import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import {
  Search, RotateCcw, FlaskConical, Plus, Bell, LogOut
} from 'lucide-react';

export default function TopNav({ onNewJobWork, onSalesOrder, onOpenSimulator }) {
  const { user, logout } = useAuth();
  const { globalSearch, setGlobalSearch } = useWorkflow();
  const username = user?.displayName || user?.email?.split('@')[0] || 'Administrator';
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <header className="erp-topnav">
      {/* Search */}
      <div className="topnav-search">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search Job Work, Customer, Batch..."
          className="search-input"
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
        />
        <span className="search-shortcut">⌘K</span>
      </div>

      {/* Right Actions */}
      <div className="topnav-actions">
        <button className="tnav-btn primary" onClick={onNewJobWork}>
          <Plus size={14} />
          <span>New Job Work</span>
        </button>

        <button className="tnav-btn dark" onClick={onSalesOrder}>
          <Plus size={14} />
          <span>Sales Order</span>
        </button>

        <button className="tnav-icon-btn notif-btn">
          <Bell size={16} />
          <span className="notif-dot" />
        </button>

        <button className="topnav-profile" onClick={logout} title="Click to Sign Out">
          <div className="profile-info">
            <span className="profile-name">{username}</span>
            <span className="profile-role">Administrator</span>
          </div>
          <div className="profile-avatar">{initials}</div>
          <LogOut size={14} style={{ color: '#ef4444', marginLeft: '4px' }} />
        </button>
      </div>
    </header>
  );
}
