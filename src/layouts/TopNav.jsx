import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import {
  Search, RotateCcw, FlaskConical, Plus, Bell, LogOut, Menu
} from 'lucide-react';

export default function TopNav({ onNewJobWork, onSalesOrder, onOpenSimulator }) {
  const { user, logout } = useAuth();
  const { globalSearch, setGlobalSearch, setMobileMenuOpen } = useWorkflow();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const username = user?.displayName || user?.email?.split('@')[0] || 'Administrator';
  const initials = username.slice(0, 2).toUpperCase();

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      const q = (globalSearch || '').trim().toUpperCase();
      if (!q) return;

      if (q.startsWith('JW-') || q.startsWith('CH-')) {
        navigate('/job-work');
      } else if (q.startsWith('SO-')) {
        navigate('/sales');
      } else if (q.startsWith('DSP-') || q.startsWith('DC-') || q.startsWith('INV-')) {
        navigate('/sales', { state: { tab: 'dispatch' } });
      } else if (q.startsWith('RM-') || q.startsWith('FG-') || q.startsWith('BATCH-') || q.startsWith('LOT-')) {
        navigate('/inventory');
      }
    }
  };

  return (
    <header className="erp-topnav">
      {/* Mobile Hamburger Toggle Button */}
      <button 
        type="button"
        className="topnav-mobile-menu-btn" 
        onClick={() => setMobileMenuOpen && setMobileMenuOpen(true)}
        title="Open navigation menu"
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      {/* Search */}
      <div className="topnav-search">
        <Search size={14} className="search-icon" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search Job Work, Customer, Batch..."
          className="search-input"
          value={globalSearch}
          onChange={e => setGlobalSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        <span className="search-shortcut" onClick={() => searchInputRef.current?.focus()} style={{ cursor: 'pointer' }}>⌘K</span>
      </div>

      {/* Right Actions */}
      <div className="topnav-actions">
        {/* Workspace / Plant Indicator */}
        <div className="topnav-plant-pill" title="Connected Manufacturing Plant: Rajkot GIDC">
          <span className="plant-live-dot" />
          <span className="plant-pill-name">Plant 1 (Rajkot GIDC)</span>
        </div>

        <button className="tnav-icon-btn notif-btn" title="System Notifications">
          <Bell size={16} />
          <span className="notif-dot" />
        </button>

        <button className="topnav-profile" onClick={logout} title="Click to Sign Out">
          <div className="profile-info">
            <span className="profile-name">{username}</span>
            <span className="profile-role">Administrator</span>
          </div>
          <div className="profile-avatar">{initials}</div>
          <LogOut size={14} style={{ color: '#94a3b8', marginLeft: '4px' }} />
        </button>
      </div>
    </header>
  );
}
