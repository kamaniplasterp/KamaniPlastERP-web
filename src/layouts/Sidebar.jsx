import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import {
  LayoutDashboard, Briefcase, Package, Truck, BookUser,
  FlaskConical, ChevronLeft, ChevronRight, Circle, LogOut
} from 'lucide-react';

const navItems = [
  {
    section: 'CORE MODULES',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        sublabel: 'Operations Overview',
        icon: LayoutDashboard,
        badge: null,
      },
      {
        id: 'jobwork',
        label: 'Job Work Hub',
        sublabel: 'Challans, Outside Stock & Wast...',
        icon: Briefcase,
        badge: { count: 0, type: 'active' },
      },
      {
        id: 'inventory',
        label: 'Inventory & Stock',
        sublabel: 'Raw, Finished & Traceability',
        icon: Package,
        badge: { count: 0, type: 'low' },
      },
      {
        id: 'sales',
        label: 'Sales & Dispatch',
        sublabel: 'Orders, Allocation & Challans',
        icon: Truck,
        badge: { count: 0, type: 'orders' },
      },
      {
        id: 'directory',
        label: 'Directory & Settings',
        sublabel: 'Vendors, Buyers & Setup',
        icon: BookUser,
        badge: null,
      },
    ],
  }
];

export default function Sidebar({ activeNav, setActiveNav, onOpenSimulator }) {
  const { user, logout } = useAuth();
  const { activeJobWorksCount, openOrdersCount, lowStockCount } = useWorkflow();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const username = user?.displayName || user?.email?.split('@')[0] || 'Administrator';
  const initials = username.slice(0, 2).toUpperCase();

  const dynamicNavItems = navItems.map(sec => ({
    ...sec,
    items: sec.items.map(item => {
      if (item.id === 'jobwork') return { ...item, badge: { count: activeJobWorksCount, type: 'active' } };
      if (item.id === 'inventory') return { ...item, badge: { count: lowStockCount, type: 'low' } };
      if (item.id === 'sales') return { ...item, badge: { count: openOrdersCount, type: 'orders' } };
      return item;
    })
  }));

  const handleNavClick = (itemId) => {
    if (itemId === 'simulator') {
      if (onOpenSimulator) onOpenSimulator();
      return;
    }
    if (setActiveNav) {
      setActiveNav(itemId);
    }
    if (itemId === 'dashboard') {
      navigate('/dashboard');
    } else if (itemId === 'jobwork') {
      navigate('/job-work');
    } else if (itemId === 'inventory') {
      navigate('/inventory');
    } else if (itemId === 'sales') {
      navigate('/sales');
    } else if (itemId === 'directory') {
      navigate('/directory');
    }
  };

  return (
    <aside className={`erp-sidebar${collapsed ? ' collapsed' : ''}`}>
      {/* Logo */}
      <div
        className="sidebar-logo"
        onClick={() => {
          if (collapsed) setCollapsed(false);
          if (setActiveNav) setActiveNav('dashboard');
          navigate('/dashboard');
        }}
        style={{ cursor: 'pointer' }}
        title="Go to Operations Dashboard"
      >
        <div className="sidebar-logo-mark">
          <span>K</span>
        </div>
        {!collapsed && (
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-name">Kamani Plastic</span>
            <span className="sidebar-brand-sub">INDUSTRIAL ERP</span>
          </div>
        )}
        {!collapsed && (
          <button
            className="sidebar-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(c => !c);
            }}
            title="Collapse"
          >
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      {/* Nav Sections */}
      <nav className="sidebar-nav">
        {dynamicNavItems.map((section, si) => (
          <div key={si} className="sidebar-section">
            {section.section && !collapsed && (
              <span className="sidebar-section-label">{section.section}</span>
            )}
            {section.items.map(item => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  className={`sidebar-nav-item${isActive ? ' active' : ''}${item.isSimulator ? ' simulator' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                  title={collapsed ? item.label : ''}
                >
                  <div className="nav-item-icon">
                    <Icon size={17} />
                  </div>
                  {!collapsed && (
                    <div className="nav-item-text">
                      <span className="nav-item-label">{item.label}</span>
                      <span className="nav-item-sub">{item.sublabel}</span>
                    </div>
                  )}
                  {!collapsed && item.badge && (
                    <span className={`sidebar-badge badge-${item.badge.type}`}>
                      {item.badge.count} {item.badge.type === 'low' ? 'Low' : item.badge.type === 'orders' ? 'Orders' : 'Active'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Admin Section */}
      <div className="sidebar-footer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="sidebar-admin">
          <div className="admin-avatar">{initials}</div>
          {!collapsed && (
            <div className="admin-info">
              <span className="admin-name">{username}</span>
              <span className="admin-status">
                <Circle size={7} fill="#22c55e" color="#22c55e" />
                Plant 1 Active
              </span>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={logout}
            title="Log Out"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              color: '#f87171',
              borderRadius: '6px',
              padding: '6px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 500
            }}
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        )}
      </div>
    </aside>
  );
}
