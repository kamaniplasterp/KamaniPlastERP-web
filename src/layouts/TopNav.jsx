import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkflow } from '../context/WorkflowContext';
import { subscribeRmInwards } from '../api/inventory.api';
import { subscribeQcChecks } from '../api/qc.api';
import { ROLE_LABELS, ROLE_COLORS } from '../api/rbac.api';
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
  ChevronRight,
  CheckCircle2,
  X
} from 'lucide-react';

export default function TopNav({ onNewJobWork, onSalesOrder, onOpenSimulator }) {
  const { user, logout, userRole, hasAccess } = useAuth();
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

  // Real-time inward and QC check data for notifications
  const [rmInwards, setRmInwards] = useState([]);
  const [qcChecks, setQcChecks] = useState([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifFilter, setNotifFilter] = useState('ALL');
  const [dismissedIds, setDismissedIds] = useState([]);

  useEffect(() => {
    const unsubInw = subscribeRmInwards(setRmInwards);
    const unsubQc = subscribeQcChecks(setQcChecks);
    return () => {
      unsubInw();
      unsubQc();
    };
  }, []);

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

  // 1. Weight Discrepancy Warnings (Billed Weight > Gross Weight)
  const weightDiscrepancies = rmInwards
    .filter(inw => {
      const billed = Number(inw.challanWeight || 0);
      const gross = Number(inw.grossWeight || 0);
      return billed > 0 && billed > gross;
    })
    .map(inw => {
      const billed = Number(inw.challanWeight || 0);
      const gross = Number(inw.grossWeight || 0);
      const diff = (billed - gross).toFixed(1);
      return {
        id: `weight-${inw.id || inw.grnNo}`,
        type: 'WEIGHT_DISCREPANCY',
        category: 'WEIGHT',
        title: `Weight Discrepancy: ${inw.grnNo}`,
        message: `Billed weight (${billed.toLocaleString()} KG) exceeds Gross (${gross.toLocaleString()} KG) by ${diff} KG. Batch: ${inw.batchNumber || '—'}.`,
        meta: `${inw.supplierName || 'Supplier'} • Challan #${inw.challanNo || '—'}`,
        timeTag: inw.date || 'Recent',
        severity: 'high',
        path: '/inventory',
        state: { tab: 'rm', subView: 'inward', search: inw.batchNumber || inw.grnNo }
      };
    });

  // 2. QC SLA Overdue Warnings (24-hr deadline exceeded without approval)
  const qcAlerts = rmInwards
    .filter(inw => {
      const matchQc = qcChecks.find(q => (q.grnId && q.grnId === inw.id) || (q.grnNo && q.grnNo === inw.grnNo));
      const isAccepted = inw.qcStatus === 'ACCEPTED' || matchQc?.result === 'PASS' || matchQc?.status === 'APPROVED';
      if (isAccepted) return false;

      const deadline = matchQc?.deadlineDate || (matchQc?.deadlineAt?.toDate ? matchQc.deadlineAt.toDate() : null);
      let isOverdue = Boolean(matchQc?.isOverdue);
      if (!isOverdue) {
        if (deadline && deadline.getTime() < Date.now()) {
          isOverdue = true;
        } else if (inw.date) {
          const inwDate = new Date(inw.date);
          if (!isNaN(inwDate.getTime()) && (Date.now() - inwDate.getTime() > 24 * 60 * 60 * 1000)) {
            isOverdue = true;
          }
        }
      }
      return isOverdue;
    })
    .map(inw => ({
      id: `qc-${inw.id || inw.grnNo}`,
      type: 'QC_OVERDUE',
      category: 'QC',
      title: `Quality Check Overdue: ${inw.grnNo}`,
      message: `24-hour inspection SLA exceeded for ${inw.itemName} (${inw.batchNumber || 'No Batch'}). Physical inspection required.`,
      meta: `${inw.supplierName || 'Supplier'} • Inward: ${inw.date || '—'}`,
      timeTag: 'SLA Overdue',
      severity: 'high',
      path: '/inventory',
      state: { tab: 'rm', subView: 'inward', search: inw.batchNumber || inw.grnNo }
    }));

  // 3. Low Stock Warnings (Below reorder level)
  const lowStockAlerts = [];
  (rmList || []).forEach(rm => {
    const total = (Number(rm.availFactory) || 0) + (Number(rm.atJobWork) || 0);
    const reorder = Number(rm.reorderLevel) || 1000;
    if (total < reorder) {
      lowStockAlerts.push({
        id: `low-rm-${rm.id || rm.code}`,
        type: 'LOW_STOCK',
        category: 'STOCK',
        title: `Low Stock: ${rm.name || rm.code}`,
        message: `Current stock (${total.toLocaleString()} KG) is below reorder level (${reorder.toLocaleString()} KG).`,
        meta: `Factory: ${Number(rm.availFactory || 0).toLocaleString()} KG • Grade: ${rm.grade || '—'}`,
        timeTag: 'Low RM',
        severity: 'medium',
        path: '/inventory',
        state: { tab: 'rm', subView: 'ledger', search: rm.name || rm.code }
      });
    }
  });

  (fgList || []).forEach(fg => {
    const total = Number(fg.stockQty || 0);
    const reorder = Number(fg.reorderLevel) || 50;
    if (total < reorder) {
      lowStockAlerts.push({
        id: `low-fg-${fg.id || fg.code}`,
        type: 'LOW_STOCK',
        category: 'STOCK',
        title: `Low FG Stock: ${fg.name || fg.code}`,
        message: `Finished stock (${total.toLocaleString()} Coils) is below minimum reserve (${reorder.toLocaleString()}).`,
        meta: `${fg.category || 'Finished Goods'}`,
        timeTag: 'Low FG',
        severity: 'medium',
        path: '/inventory',
        state: { tab: 'fg', search: fg.name || fg.code }
      });
    }
  });

  // 4. Job Work Pending Balance Alerts
  const jobWorkAlerts = (jobWorkList || [])
    .filter(jw => {
      const isCompleted = jw.status === 'COMPLETED' || jw.status === 'FULLY RECEIVED';
      if (isCompleted) return false;
      const bal = Number(jw.balQtyKg !== undefined ? jw.balQtyKg : (Number(jw.sentQtyKg || 0) - Number(jw.recQtyKg || 0)));
      return bal > 0;
    })
    .slice(0, 5)
    .map(jw => {
      const bal = Number(jw.balQtyKg !== undefined ? jw.balQtyKg : (Number(jw.sentQtyKg || 0) - Number(jw.recQtyKg || 0)));
      return {
        id: `jw-${jw.id || jw.jwNo}`,
        type: 'JOB_WORK',
        category: 'JW',
        title: `Outside Processing: ${jw.jwNo}`,
        message: `${bal.toLocaleString()} KG material awaiting processing return from ${jw.vendor || 'Job Worker'}.`,
        meta: `Challan #${jw.chNo || '—'} • Issued ${jw.date || '—'}`,
        timeTag: 'Pending',
        severity: 'low',
        path: '/job-work',
        state: {}
      };
    });

  // Combined notifications list
  const allNotifications = [
    ...weightDiscrepancies,
    ...qcAlerts,
    ...lowStockAlerts,
    ...jobWorkAlerts
  ];

  const activeNotifications = allNotifications.filter(n => !dismissedIds.includes(n.id));
  const hasHighSeverity = activeNotifications.some(n => n.severity === 'high');

  const filteredList = activeNotifications.filter(n => {
    if (notifFilter === 'ALL') return true;
    return n.category === notifFilter;
  });

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

        {/* Notifications & Warnings Bell */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button 
            type="button"
            className="tnav-icon-btn notif-btn" 
            title={activeNotifications.length > 0 ? `${activeNotifications.length} Active System Warnings & Notifications` : "No active alerts"}
            onClick={() => setShowNotifDropdown(prev => !prev)}
            style={{ 
              position: 'relative',
              background: showNotifDropdown ? '#e2e8f0' : undefined 
            }}
          >
            <Bell size={16} />
            {activeNotifications.length > 0 && (
              <span 
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: hasHighSeverity ? '#dc2626' : '#ea580c',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '1px 5px',
                  borderRadius: '10px',
                  minWidth: '17px',
                  height: '17px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }}
              >
                {activeNotifications.length}
              </span>
            )}
          </button>

          {/* Notification Dropdown Panel */}
          {showNotifDropdown && (
            <div 
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '390px',
                maxWidth: '92vw',
                background: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 14px 40px rgba(15, 23, 42, 0.18), 0 2px 6px rgba(15, 23, 42, 0.08)',
                border: '1px solid #e2e8f0',
                zIndex: 9999,
                overflow: 'hidden'
              }}
            >
              {/* Dropdown Header */}
              <div 
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Bell size={16} style={{ color: '#0f172a' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                    Warnings &amp; Alerts
                  </span>
                  {activeNotifications.length > 0 && (
                    <span 
                      style={{
                        background: '#fee2e2',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        fontSize: '0.68rem',
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: '10px'
                      }}
                    >
                      {activeNotifications.length} Active
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {activeNotifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setDismissedIds(allNotifications.map(n => n.id))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      Dismiss All
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowNotifDropdown(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div 
                style={{
                  display: 'flex',
                  padding: '8px 12px',
                  gap: '6px',
                  borderBottom: '1px solid #f1f5f9',
                  background: '#ffffff',
                  overflowX: 'auto'
                }}
              >
                {[
                  { key: 'ALL', label: `All (${activeNotifications.length})` },
                  { key: 'WEIGHT', label: `⚠️ Weight (${weightDiscrepancies.length})` },
                  { key: 'QC', label: `⏱️ QC Overdue (${qcAlerts.length})` },
                  { key: 'STOCK', label: `📦 Stock (${lowStockAlerts.length})` },
                  { key: 'JW', label: `💼 Job Work (${jobWorkAlerts.length})` }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setNotifFilter(tab.key)}
                    style={{
                      background: notifFilter === tab.key ? '#0f172a' : '#f1f5f9',
                      color: notifFilter === tab.key ? '#ffffff' : '#475569',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Notification List */}
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {filteredList.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center', color: '#64748b' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', color: '#16a34a' }}>
                      <CheckCircle2 size={22} />
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>All Clear!</div>
                    <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>No active alerts in this category.</div>
                  </div>
                ) : (
                  filteredList.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setShowNotifDropdown(false);
                        navigate(item.path, { state: item.state });
                      }}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = '#ffffff'}
                    >
                      {/* Icon */}
                      <div 
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: item.type === 'WEIGHT_DISCREPANCY' ? '#fee2e2' : item.type === 'QC_OVERDUE' ? '#fff1f2' : item.type === 'LOW_STOCK' ? '#fef3c7' : '#e0f2fe',
                          color: item.type === 'WEIGHT_DISCREPANCY' ? '#dc2626' : item.type === 'QC_OVERDUE' ? '#e11d48' : item.type === 'LOW_STOCK' ? '#b45309' : '#0369a1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '2px'
                        }}
                      >
                        {item.type === 'WEIGHT_DISCREPANCY' ? <AlertTriangle size={16} /> :
                         item.type === 'QC_OVERDUE' ? <Clock size={16} /> :
                         item.type === 'LOW_STOCK' ? <Package size={16} /> :
                         <Briefcase size={16} />}
                      </div>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.title}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: item.severity === 'high' ? '#dc2626' : '#94a3b8', fontWeight: item.severity === 'high' ? 700 : 500, whiteSpace: 'nowrap' }}>
                            {item.timeTag}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#475569', marginTop: '3px', lineHeight: 1.35 }}>
                          {item.message}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            {item.meta}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            View <ChevronRight size={11} />
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div 
                style={{
                  padding: '10px 16px',
                  background: '#f8fafc',
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '0.72rem',
                  color: '#64748b'
                }}
              >
                <span>Plant 1 (Rajkot GIDC) • Live Watchdog</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {activeNotifications.length} Active Alerts
                </span>
              </div>
            </div>
          )}
        </div>

        <button className="topnav-profile" onClick={logout} title="Click to Sign Out">
          <div className="profile-info">
            <span className="profile-name">{username}</span>
            <span className="profile-role">{ROLE_LABELS[userRole] || 'Administrator'}</span>
          </div>
          <div className="profile-avatar">{initials}</div>
          <LogOut size={14} style={{ color: '#94a3b8', marginLeft: '4px' }} />
        </button>
      </div>
    </header>
  );
}
