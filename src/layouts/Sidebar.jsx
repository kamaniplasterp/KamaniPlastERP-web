import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import {
  LayoutDashboard, Briefcase, Package, Truck, BookUser,
  FlaskConical, ChevronLeft, ChevronRight, Circle, LogOut, X
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
  const { activeJobWorksCount, openOrdersCount, lowStockCount, mobileMenuOpen, setMobileMenuOpen } = useWorkflow();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const username = user?.displayName || user?.email?.split('@')[0] || 'Administrator';
  const initials = username.slice(0, 2).toUpperCase();

  const dynamicNavItems = navItems.map(sec => ({
    ...sec,
    items: sec.items.map(item => {
      // Only emphasize urgent actionable alerts (e.g. low stock warnings)
      if (item.id === 'inventory' && lowStockCount > 0) {
        return { ...item, badge: { count: lowStockCount, type: 'low', text: `${lowStockCount} Low` } };
      }
      return { ...item, badge: null };
    })
  }));

  const handleNavClick = (itemId) => {
    if (setMobileMenuOpen) setMobileMenuOpen(false);
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
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="sidebar-mobile-backdrop" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      <aside className={`erp-sidebar${collapsed ? ' collapsed' : ''}${mobileMenuOpen ? ' mobile-open' : ''}`}>
        {/* Logo */}
        <div
          className="sidebar-logo"
          onClick={() => {
            if (setMobileMenuOpen) setMobileMenuOpen(false);
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
          <button
            className="sidebar-collapse-btn"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed(c => !c);
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          
          {/* Mobile Close Button */}
          <button
            className="sidebar-mobile-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              if (setMobileMenuOpen) setMobileMenuOpen(false);
            }}
            title="Close menu"
          >
            <X size={18} />
          </button>
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

      {/* System Footer (Profile & Logout canonically housed in TopNav) */}
      <div className="sidebar-footer">
        {!collapsed ? (
          <div className="sidebar-footer-info">
            <span className="sidebar-footer-edition">Kamani Industrial ERP</span>
            <span className="sidebar-footer-version">v2.4 • Online</span>
          </div>
        ) : (
          <div className="sidebar-footer-collapsed-dot" title="Systems Online" />
        )}
      </div>
    </aside>
    </>
  );
}
