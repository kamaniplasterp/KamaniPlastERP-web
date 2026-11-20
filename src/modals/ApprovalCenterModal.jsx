import { useState, useEffect } from 'react';
import { 
  X, Check, AlertTriangle, ShieldCheck, Clock, User, 
  ArrowRight, CheckCircle2, XCircle, FileText, ChevronRight, Filter
} from 'lucide-react';
import { 
  subscribeAllApprovals, 
  approveMasterChange, 
  rejectMasterChange 
} from '../api/approvals.api';
import { useAuth } from '../context/AuthContext';
import { showAlert } from '../context/CustomAlertContext';
import '../styles/Modals.css';

export default function ApprovalCenterModal({ onClose }) {
  const { user, userProfile } = useAuth();
  const [approvals, setApprovals] = useState([]);
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'history'
  const [processingId, setProcessingId] = useState(null);
  const [rejectReason, setRejectReason] = useState({});
  const [showRejectInput, setShowRejectInput] = useState({});

  useEffect(() => {
    const unsub = subscribeAllApprovals(setApprovals);
    return () => unsub();
  }, []);

  const pendingList = approvals.filter(a => a.status === 'PENDING');
  const historyList = approvals.filter(a => a.status !== 'PENDING');

  const handleApprove = async (request) => {
    try {
      setProcessingId(request.id);
      await approveMasterChange(request, {
        uid: user?.uid,
        email: user?.email,
        displayName: userProfile?.displayName || user?.displayName || user?.email
      });
      await showAlert(`Approved change for "${request.recordTitle}". Master record updated.`, {
        type: 'success',
        title: 'Change Approved'
      });
    } catch (err) {
      console.error('Error approving change:', err);
      await showAlert(`Approval failed: ${err.message}`, { type: 'error', title: 'Error' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request) => {
    const reason = rejectReason[request.id] || '';
    try {
      setProcessingId(request.id);
      await rejectMasterChange(request.id, reason, {
        uid: user?.uid,
        email: user?.email,
        displayName: userProfile?.displayName || user?.displayName || user?.email
      });
      await showAlert(`Request for "${request.recordTitle}" has been rejected.`, {
        type: 'info',
        title: 'Request Rejected'
      });
      setShowRejectInput(prev => ({ ...prev, [request.id]: false }));
    } catch (err) {
      console.error('Error rejecting change:', err);
      await showAlert(`Rejection failed: ${err.message}`, { type: 'error', title: 'Error' });
    } finally {
      setProcessingId(null);
    }
  };

  const formatActionBadge = (action) => {
    switch (action) {
      case 'CREATE':
        return <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>+ ADD NEW</span>;
      case 'UPDATE':
        return <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>✎ EDIT / UPDATE</span>;
      case 'DELETE':
        return <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700 }}>✕ DELETE</span>;
      default:
        return <span>{action}</span>;
    }
  };

  const formatDataSummary = (data) => {
    if (!data || typeof data !== 'object') return 'None';
    const keys = Object.keys(data).filter(k => !['createdAt', 'updatedAt', 'id'].includes(k));
    return keys.slice(0, 6).map(k => (
      <span key={k} style={{ display: 'inline-block', marginRight: '8px', fontSize: '0.75rem', color: '#334155' }}>
        <strong>{k}:</strong> {String(data[k])}
      </span>
    ));
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-lg" style={{ maxWidth: '820px', maxHeight: '88vh' }}>
        {/* Header */}
        <div className="modal-header-dark" style={{ borderBottom: '1px solid #e2e8f0', padding: '18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #fde68a'
            }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="modal-title" style={{ fontSize: '1.15rem', color: '#0f172a' }}>
                Master Data Approval Center
              </div>
              <div className="modal-sub" style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Admin review queue for master records created or modified by staff members
              </div>
            </div>
          </div>
          <button 
            type="button" 
            className="modal-close-btn" 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '8px', padding: '12px 24px 0', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'pending' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'pending' ? '#1d4ed8' : '#64748b',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Pending Approvals</span>
            <span style={{
              background: pendingList.length > 0 ? '#ef4444' : '#cbd5e1',
              color: '#ffffff',
              borderRadius: '9999px',
              padding: '1px 7px',
              fontSize: '0.7rem'
            }}>
              {pendingList.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: activeTab === 'history' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'history' ? '#1d4ed8' : '#64748b',
              fontWeight: 700,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Resolved History ({historyList.length})
          </button>
        </div>

        {/* List Body */}
        <div className="modal-body" style={{ padding: '16px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeTab === 'pending' ? (
            pendingList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                <CheckCircle2 size={42} style={{ color: '#22c55e', margin: '0 auto 12px', display: 'block' }} />
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>All Clear! No Pending Requests</div>
                <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Every master change submitted by staff has been reviewed.</div>
              </div>
            ) : (
              pendingList.map(item => (
                <div 
                  key={item.id} 
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {formatActionBadge(item.action)}
                      <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                        {item.masterLabel}: {item.recordTitle}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {item.createdAt?.toLocaleString ? item.createdAt.toLocaleDateString() : 'Recent'}
                    </span>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '0.78rem', border: '1px solid #f1f5f9' }}>
                    <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
                      Submitted Details
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {formatDataSummary(item.proposedData)}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <User size={13} />
                      <span>By <strong>{item.submittedBy?.displayName || item.submittedBy?.email}</strong> ({item.submittedBy?.role || 'staff'})</span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {showRejectInput[item.id] ? (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="text"
                            placeholder="Reason for rejection..."
                            value={rejectReason[item.id] || ''}
                            onChange={e => setRejectReason({ ...rejectReason, [item.id]: e.target.value })}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.75rem',
                              width: '180px'
                            }}
                          />
                          <button
                            type="button"
                            disabled={processingId === item.id}
                            onClick={() => handleReject(item)}
                            style={{
                              background: '#ef4444',
                              color: '#ffffff',
                              border: 'none',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            Confirm Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRejectInput({ ...showRejectInput, [item.id]: false })}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={processingId === item.id}
                            onClick={() => setShowRejectInput({ ...showRejectInput, [item.id]: true })}
                            style={{
                              background: '#ffffff',
                              color: '#b91c1c',
                              border: '1px solid #fecaca',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            disabled={processingId === item.id}
                            onClick={() => handleApprove(item)}
                            style={{
                              background: '#16a34a',
                              color: '#ffffff',
                              border: 'none',
                              padding: '5px 14px',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Check size={14} />
                            {processingId === item.id ? 'Approving...' : 'Approve & Commit'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            historyList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                No past approval records yet.
              </div>
            ) : (
              historyList.map(item => (
                <div 
                  key={item.id} 
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    background: '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: item.status === 'APPROVED' ? '#dcfce7' : '#fee2e2',
                        color: item.status === 'APPROVED' ? '#15803d' : '#b91c1c'
                      }}>
                        {item.status}
                      </span>
                      <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                        {item.masterLabel}: {item.recordTitle}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '4px' }}>
                      Submitted by {item.submittedBy?.displayName || item.submittedBy?.email} • Reviewed by {item.reviewedBy?.displayName || item.reviewedBy?.email || 'Admin'}
                      {item.reviewNotes && <span> ({item.reviewNotes})</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                    {item.createdAt?.toLocaleDateString ? item.createdAt.toLocaleDateString() : ''}
                  </span>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
          <button
            type="button"
            className="mfooter-btn cancel"
            onClick={onClose}
            style={{ padding: '7px 18px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
