import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import { subscribeRmInwards } from '../api/inventory.api';
import { subscribeQcChecks } from '../api/qc.api';
import { subscribeTareStandards, DEFAULT_TARE_STANDARDS } from '../api/directory.api';
import { ROLE_LABELS, ROLE_COLORS } from '../api/rbac.api';
import {
  subscribeUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  syncSystemWatchdogAlerts
} from '../api/notifications.api';
import {
  Search,
  RotateCcw,
  FlaskConical,
  Plus,
  Bell,
  LogOut,
  Menu,
  AlertTriangle,
  Clock,
  Package,
  Briefcase,
  Truck,
  CheckCircle2,
  X
} from 'lucide-react';

export default function TopNav({ onNewJobWork, onSalesOrder, onOpenSimulator }) {
  const { user, logout, userRole, isAdmin, hasAccess, defaultRoute } = useAuth();
  const { 
    globalSearch, 
    setGlobalSearch, 
    setMobileMenuOpen,
    rmList,
    fgList,
    jobWorkList
  } = useWorkflow();
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const notifRef = useRef(null);
  const username = user?.displayName || user?.email?.split('@')[0] || 'Administrator';
  const initials = username.slice(0, 2).toUpperCase();

  // Real-time inward, QC check and tare data for watchdog synchronization
  const [rmInwards, setRmInwards] = useState([]);
  const [qcChecks, setQcChecks] = useState([]);
  const [tareStandards, setTareStandards] = useState(DEFAULT_TARE_STANDARDS);
  const [persistentNotifications, setPersistentNotifications] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  useEffect(() => {
    const unsubInw = subscribeRmInwards(setRmInwards);
    const unsubQc = subscribeQcChecks(setQcChecks);
    const unsubTare = subscribeTareStandards(setTareStandards);
    const unsubNotifs = subscribeUserNotifications({ ...user, role: userRole }, (list) => {
      setPersistentNotifications(list);
    });

    return () => {
      unsubInw();
      unsubQc();
      unsubTare();
      unsubNotifs();
    };
  }, [user, userRole]);

  // Synchronize watchdog alerts into persistent Firestore collection
  useEffect(() => {
    if (rmInwards.length > 0 || qcChecks.length > 0 || (rmList && rmList.length > 0)) {
      syncSystemWatchdogAlerts({
        rmInwards,
        qcChecks,
        tareStandards,
        rawMaterials: rmList || [],
        finishedGoods: fgList || []
      }).catch(console.warn);
    }
  }, [rmInwards, qcChecks, tareStandards, rmList, fgList]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    if (showNotifDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifDropdown]);

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
        if (!hasAccess || hasAccess('jobwork')) navigate('/job-work');
      } else if (q.startsWith('SO-')) {
        if (!hasAccess || hasAccess('sales')) navigate('/sales');
      } else if (q.startsWith('DSP-') || q.startsWith('DC-') || q.startsWith('INV-')) {
        if (!hasAccess || hasAccess('sales')) navigate('/sales', { state: { tab: 'dispatch' } });
      } else if (q.startsWith('RM-') || q.startsWith('FG-') || q.startsWith('BATCH-') || q.startsWith('LOT-')) {
        if (!hasAccess || hasAccess('inventory')) navigate('/inventory');
      }
    }
  };

  const isUserAdmin = Boolean(isAdmin || userRole === 'admin' || user?.role === 'admin');

  // QC Overdue alerts are strictly restricted to Admin users only
  const isQcNotification = (n) => (
    n?.category === 'QC' ||
    String(n?.category || '').toUpperCase() === 'QC' ||
    n?.type === 'QC_OVERDUE' ||
    (n?.sourceKey && String(n.sourceKey).startsWith('QC_')) ||
    (n?.title && /quality check|qc overdue/i.test(n.title))
  );

  const activeNotifications = persistentNotifications.filter(n => {
    if (isQcNotification(n) && !isUserAdmin) {
      return false;
    }
    return true;
  });

  const unreadCount = activeNotifications.filter(n => !n.isRead).length;

  const handleMarkAllRead = async () => {
    if (!user?.uid || activeNotifications.length === 0) return;
    const unreadIds = activeNotifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length === 0) return;

    // Optimistic UI update
    setPersistentNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

    await markAllNotificationsAsRead(unreadIds, user.uid);
  };

  const handleItemClick = (item) => {
    setShowNotifDropdown(false);

    if (user?.uid && !item.isRead) {
      setPersistentNotifications(prev => prev.map(n => n.id === item.id ? { ...n, isRead: true } : n));
      markNotificationAsRead(item.id, user.uid);
    }

    let path = item.actionPath || item.path || defaultRoute || (hasAccess('dashboard') ? '/dashboard' : '/job-work');
    const state = item.actionState || item.state || {};

    if (state.tab) {
      const hasQuery = path.includes('?');
      path = `${path}${hasQuery ? '&' : '?'}tab=${encodeURIComponent(state.tab)}`;
    }

    navigate(path, { state });
  };

  const formatNotificationTime = (item) => {
    const d = item.createdAtDate || (item.createdAt?.toDate ? item.createdAt.toDate() : (item.createdAt ? new Date(item.createdAt) : null));
    if (!d || isNaN(d.getTime())) return item.timeTag || '';

    const now = new Date();
    const isToday = now.toDateString() === d.toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = yesterday.toDateString() === d.toDateString();

    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    if (isToday) return timeStr;
    if (isYesterday) return `Yesterday, ${timeStr}`;
    return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })}, ${timeStr}`;
  };

  const getNotificationIcon = (category) => {
    switch (category) {
      case 'WEIGHT':
        return {
          icon: <AlertTriangle size={15} />,
          bg: '#fef2f2',
          color: '#ef4444'
        };
      case 'QC':
        return {
          icon: <Clock size={15} />,
          bg: '#fffbeb',
          color: '#f59e0b'
        };
      case 'STOCK':
        return {
          icon: <Package size={15} />,
          bg: '#f0f9ff',
          color: '#0284c7'
        };
      case 'JOB_WORK':
        return {
          icon: <Briefcase size={15} />,
          bg: '#f5f3ff',
          color: '#8b5cf6'
        };
      case 'SALES':
        return {
          icon: <Truck size={15} />,
          bg: '#f0fdf4',
          color: '#16a34a'
        };
      default:
        return {
          icon: <AlertTriangle size={15} />,
          bg: '#fef2f2',
          color: '#ef4444'
        };
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
        {/* Notifications & Warnings Bell */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button 
            type="button"
            className="tnav-icon-btn notif-btn" 
            title={unreadCount > 0 ? `${unreadCount} Unread Notifications` : "Notifications"}
            onClick={() => setShowNotifDropdown(prev => !prev)}
            style={{ 
              position: 'relative',
              background: showNotifDropdown ? '#e2e8f0' : undefined 
            }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span 
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '10px',
                  minWidth: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Clean Minimal Notification Panel (Image 2 style) */}
          {showNotifDropdown && (
            <div 
              style={{
                position: 'absolute',
                top: 'calc(100% + 12px)',
                right: 0,
                width: '390px',
                maxWidth: '92vw',
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 16px 40px rgba(15, 23, 42, 0.14), 0 3px 8px rgba(15, 23, 42, 0.05)',
                border: '1px solid #f1f5f9',
                zIndex: 9999,
                overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div 
                style={{
                  padding: '18px 20px 14px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.12rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                    Notification
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
                    {unreadCount} unread
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', paddingTop: '2px' }}>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#0284c7',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      Mark All read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNotifDropdown(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px'
                    }}
                    title="Close"
                  >
                    <X size={17} />
                  </button>
                </div>
              </div>

              <div style={{ height: '1px', background: '#f1f5f9' }} />

              {/* Notification List */}
              <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                {activeNotifications.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: '#16a34a' }}>
                      <CheckCircle2 size={20} />
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a' }}>All caught up!</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '3px' }}>No notifications to display.</div>
                  </div>
                ) : (
                  activeNotifications.map(item => {
                    const iconConfig = getNotificationIcon(item.category);
                    const timeLabel = formatNotificationTime(item);

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        style={{
                          padding: '13px 20px',
                          borderBottom: '1px solid #f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          transition: 'background 0.15s ease',
                          background: '#ffffff'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                        onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                      >
                        {/* Circular Icon */}
                        <div 
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: iconConfig.bg,
                            color: iconConfig.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          {iconConfig.icon}
                        </div>

                        {/* Title & Message & Time */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.83rem', fontWeight: item.isRead ? 400 : 500, color: '#1e293b', lineHeight: 1.38 }}>
                            {item.title}
                          </div>
                          {item.message && (
                            <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px', lineHeight: 1.35 }}>
                              {item.message}
                            </div>
                          )}
                          <div style={{ fontSize: '0.71rem', color: '#94a3b8', marginTop: '4px', fontWeight: 400 }}>
                            {timeLabel}
                          </div>
                        </div>

                        {/* Unread indicator dot */}
                        <div style={{ width: '10px', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                          {!item.isRead && (
                            <span 
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: '#0284c7'
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
