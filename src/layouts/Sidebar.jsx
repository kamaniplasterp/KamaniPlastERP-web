import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import { ROLE_LABELS } from '../api/rbac.api';
import { subscribePendingApprovals } from '../api/approvals.api';
import {
  LayoutDashboard, Briefcase, Package, Truck, BookUser,
  ChevronLeft, ChevronRight, ChevronDown, Circle, X, Cog, LogOut
} from 'lucide-react';

const navItems = [
  {
    section: 'MAIN NAVIGATION',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        route: '/dashboard',
        badge: null,
      },
      {
        id: 'jobwork',
        label: 'Job Work Hub',
        icon: Briefcase,
        route: '/job-work',
        children: [
          { id: 'orders', subModuleId: 'jobwork_outward', label: 'Outward & Inward Orders', tab: 'orders', isDefault: true },
          { id: 'challanReport', subModuleId: 'jobwork_trace', label: 'Challan Register & Trace', tab: 'challanReport' },
          { id: 'processorLedger', subModuleId: 'jobwork_contractor', label: 'Processor Stock & Wastage', tab: 'processorLedger', aliases: ['statement', 'material', 'wastage'] },
          { id: 'scrapSettlement', subModuleId: 'jobwork_scrap', label: 'Scrap Settlement & Deductions', tab: 'scrapSettlement', aliases: ['monthlySettlement', 'extraCutting'] },
        ],
      },
      {
        id: 'inventory',
        label: 'Inventory & Stock',
        icon: Package,
        route: '/inventory',
        children: [
          { id: 'rm', subModuleId: 'inventory_rm', label: 'Raw Materials & GRN', tab: 'rm', isDefault: true },
          { id: 'fg', subModuleId: 'inventory_fg', label: 'Finished Goods (FG)', tab: 'fg' },
          { id: 'bags', subModuleId: 'inventory_bags', label: 'Bags & Dual Stock', tab: 'bags' },
          { id: 'movements', subModuleId: 'inventory_movements', label: 'Stock Movements & Trace', tab: 'movements', aliases: ['traceability'] },
        ],
      },
      {
        id: 'sales',
        label: 'Sales & Dispatch',
        icon: Truck,
        route: '/sales',
        children: [
          { id: 'orders', subModuleId: 'sales_orders', label: 'Sales Orders & Allocation', tab: 'orders', isDefault: true },
          { id: 'dispatches', subModuleId: 'sales_challans', label: 'Dispatch Delivery Challans', tab: 'dispatches', aliases: ['dispatch'] },
        ],
      },
      {
        id: 'processMasters',
        label: 'Process & Plant Masters',
        icon: Cog,
        route: '/process-masters',
        children: [
          { id: 'processMaster', subModuleId: 'masters_operations', label: 'Operations & Wastage', tab: 'processMaster', isDefault: true },
          { id: 'locations', subModuleId: 'masters_godowns', label: 'Godowns & Locations', tab: 'locations' },
          { id: 'productMatrix', subModuleId: 'masters_products', label: 'Product Matrix & SKUs', tab: 'productMatrix' },
        ],
      },
      {
        id: 'directory',
        label: 'Directory & Admin',
        icon: BookUser,
        route: '/directory',
        children: [
          { id: 'directory', subModuleId: 'directory_business', label: 'Business Directory', tab: 'directory', aliases: ['vendors', 'customers'], isDefault: true },
          { id: 'ratesValuation', subModuleId: 'directory_rates', label: 'Rates & Valuation Master', tab: 'ratesValuation', aliases: ['rateMaster', 'valueMaster'] },
          { id: 'settings', subModuleId: 'directory_settings', label: 'Plant & System Settings', tab: 'settings', aliases: ['miscMaster'] },
          { id: 'approvals', subModuleId: 'directory_approvals', label: 'Approvals Queue', tab: 'approvals', adminOnly: true },
          { id: 'rbac', subModuleId: 'directory_rbac', label: 'User Roles & RBAC', tab: 'rbac', adminOnly: true },
          { id: 'audit', subModuleId: 'directory_audit', label: 'Security Audit Logs', tab: 'audit', adminOnly: true },
        ],
      },
    ],
  }
];

export default function Sidebar({ activeNav, setActiveNav, onOpenSimulator }) {
  const { user, logout, hasAccess, can, userRole, defaultRoute, isAdmin } = useAuth();
  const { lowStockCount, mobileMenuOpen, setMobileMenuOpen } = useWorkflow();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  useEffect(() => {
    const unsub = subscribePendingApprovals(setPendingApprovals);
    return () => unsub();
  }, []);

  const username = user?.displayName || user?.email?.split('@')[0] || 'KamaniPlastERP';
  const initials = (user?.displayName || user?.email || 'KA').slice(0, 2).toUpperCase();

  // Determine current active section from location pathname
  const currentPath = location.pathname;
  const currentTab = searchParams.get('tab');

  const getActiveModuleId = () => {
    if (currentPath.startsWith('/dashboard')) return 'dashboard';
    if (currentPath.startsWith('/job-work')) return 'jobwork';
    if (currentPath.startsWith('/inventory')) return 'inventory';
    if (currentPath.startsWith('/sales')) return 'sales';
    if (currentPath.startsWith('/process-masters')) return 'processMasters';
    if (currentPath.startsWith('/directory')) return 'directory';
    return activeNav || 'dashboard';
  };

  const activeModuleId = getActiveModuleId();

  // Keep track of which accordion submenus are open
  const [openMenus, setOpenMenus] = useState({
    [activeModuleId]: true,
  });

  // Whenever the route changes, ensure the active section's menu is open
  useEffect(() => {
    if (activeModuleId) {
      setOpenMenus(prev => ({
        ...prev,
        [activeModuleId]: true
      }));
      if (setActiveNav) {
        setActiveNav(activeModuleId);
      }
    }
  }, [activeModuleId, setActiveNav]);

  const toggleMenu = (menuId) => {
    setOpenMenus(prev => ({
      ...prev,
      [menuId]: !prev[menuId]
    }));
  };

  const handleParentClick = (item) => {
    if (collapsed) {
      setCollapsed(false);
    }

    if (item.children && item.children.length > 0) {
      const isCurrentlyActive = activeModuleId === item.id;
      if (!isCurrentlyActive) {
        // If switching to this section, navigate to first default child
        toggleMenu(item.id);
        if (setMobileMenuOpen) setMobileMenuOpen(false);
        const defaultChild = item.children.find(c => c.isDefault) || item.children[0];
        navigate(`${item.route}?tab=${defaultChild.tab}`);
      } else {
        // If already on this section, simply toggle open/close accordion
        toggleMenu(item.id);
      }
    } else {
      // Top-level item without children (e.g. Dashboard)
      if (setMobileMenuOpen) setMobileMenuOpen(false);
      navigate(item.route);
    }
  };

  const handleSubmenuClick = (parentItem, childItem) => {
    if (setMobileMenuOpen) setMobileMenuOpen(false);
    navigate(`${parentItem.route}?tab=${childItem.tab}`);
  };

  const dynamicNavItems = navItems.map(sec => ({
    ...sec,
    items: sec.items
      .filter(item => hasAccess ? hasAccess(item.id) : true)
      .map(item => {
        // Filter out admin-only submenus and submenus where user lacks read permission
        let children = item.children;
        if (children) {
          children = children
            .filter(c => {
              if (c.adminOnly && !isAdmin) return false;
              if (c.subModuleId && can && !can(c.subModuleId, 'read')) return false;
              return true;
            })
            .map(c => {
              if (c.id === 'approvals') {
                return { ...c, badgeCount: pendingApprovals.length };
              }
              return c;
            });
        }

        // Low stock warning badge
        if (item.id === 'inventory' && lowStockCount > 0) {
          return { ...item, children, badge: { count: lowStockCount, type: 'low', text: `${lowStockCount} Low` } };
        }
        // Approvals badge for Directory
        if (item.id === 'directory' && pendingApprovals.length > 0 && isAdmin) {
          return { ...item, children, badge: { count: pendingApprovals.length, type: 'approval', text: `${pendingApprovals.length} Req` } };
        }
        return { ...item, children, badge: null };
      })
      .filter(item => !item.children || item.children.length > 0)
  }));

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
            const target = defaultRoute || (hasAccess('dashboard') ? '/dashboard' : '/job-work');
            const targetNav = hasAccess('dashboard') ? 'dashboard' : 'jobwork';
            if (setActiveNav) setActiveNav(targetNav);
            navigate(target);
          }}
          style={{ cursor: 'pointer' }}
          title="Go to Home Module"
        >
          {!collapsed ? (
            <div
              className="sidebar-logo-full"
              style={{
                background: '#ffffff',
                padding: '6px 12px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minWidth: 0,
                height: '46px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
              }}
            >
              <img
                src="/logo.png"
                alt="Kamani Plastic Industries"
                style={{
                  maxHeight: '34px',
                  width: 'auto',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          ) : (
            <div
              className="sidebar-logo-mark"
              style={{
                width: '44px',
                height: '44px',
                minWidth: '44px',
                background: '#fff',
                padding: '4px',
                borderRadius: '10px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src="/logo-icon.png"
                alt="Kamani Logo"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
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
                const isActiveParent = activeModuleId === item.id;
                const hasChildren = Boolean(item.children && item.children.length > 0);
                const isExpanded = Boolean(openMenus[item.id]);

                return (
                  <div key={item.id} className="sidebar-nav-group">
                    <button
                      className={`sidebar-nav-item${isActiveParent ? ' active' : ''}${hasChildren ? ' has-children' : ''}`}
                      onClick={() => handleParentClick(item)}
                      title={collapsed ? item.label : ''}
                    >
                      <div className="nav-item-icon">
                        <Icon size={17} />
                      </div>
                      {!collapsed && (
                        <div className="nav-item-text">
                          <span className="nav-item-label">{item.label}</span>
                        </div>
                      )}
                      {!collapsed && item.badge && (
                        <span className={`sidebar-badge badge-${item.badge.type}`}>
                          {item.badge.count} {item.badge.type === 'low' ? 'Low' : 'Active'}
                        </span>
                      )}
                      {!collapsed && hasChildren && (
                        <div className={`sidebar-chevron${isExpanded ? ' open' : ''}`}>
                          <ChevronDown size={14} />
                        </div>
                      )}
                    </button>

                    {/* Submenu Children */}
                    {hasChildren && isExpanded && !collapsed && (
                      <div className="sidebar-submenu">
                        {item.children.map(child => {
                          const isChildActive = isActiveParent && (
                            currentTab 
                              ? currentTab === child.tab || (child.aliases && child.aliases.includes(currentTab))
                              : child.isDefault
                          );

                          return (
                            <button
                              key={child.id}
                              className={`sidebar-submenu-item${isChildActive ? ' active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSubmenuClick(item, child);
                              }}
                            >
                              <span className="sidebar-submenu-dot" />
                              <span style={{ flex: 1, textAlign: 'left' }}>{child.label}</span>
                              {Boolean(child.badgeCount && child.badgeCount > 0) && (
                                <span style={{
                                  background: '#ef4444',
                                  color: '#ffffff',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                  marginLeft: 'auto',
                                  lineHeight: 1.2
                                }}>
                                  {child.badgeCount}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        {/* System Footer: Plant Indicator & User Profile */}
        <div className="sidebar-footer">
          {!collapsed ? (
            <>
              {/* Plant Pill */}
              <div className="sidebar-plant-pill" title="Connected Manufacturing Plant: Rajkot GIDC">
                <span className="plant-live-dot" />
                <span className="sidebar-plant-name">Plant 1 (Rajkot GIDC)</span>
              </div>

              {/* User Profile Card */}
              <div className="sidebar-user-card">
                <div className="sidebar-user-avatar" title={username}>
                  {initials}
                </div>
                <div className="sidebar-user-details">
                  <span className="sidebar-user-name" title={username}>{username}</span>
                  <span className="sidebar-user-role">{ROLE_LABELS[userRole] || 'Administrator'}</span>
                </div>
                <button 
                  type="button" 
                  className="sidebar-logout-btn" 
                  onClick={logout} 
                  title="Sign Out"
                >
                  <LogOut size={15} />
                </button>
              </div>
            </>
          ) : (
            <div className="sidebar-footer-collapsed-user">
              <button 
                type="button" 
                className="sidebar-user-avatar" 
                onClick={logout} 
                title={`${username} (${ROLE_LABELS[userRole] || 'Administrator'}) • Click to Sign Out`}
              >
                {initials}
              </button>
              <span className="plant-live-dot" title="Plant 1 (Rajkot GIDC) • Systems Online" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
