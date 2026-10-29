import { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, AlertTriangle, Clock, ShieldCheck, UserCheck, FileText } from 'lucide-react';
import { submitQcEvaluation, approveQcCheck, directEvaluateAndApproveQc } from '../api/qc.api';
import { subscribePersonnel, DEFAULT_PERSONNEL } from '../api/directory.api';
import '../styles/Modals.css';

export default function QcCheckModal({ qcCheck, onClose, onSuccess }) {
  const [personnelList, setPersonnelList] = useState(DEFAULT_PERSONNEL);
  const [result, setResult] = useState(qcCheck?.result || 'PASS');
  const [notes, setNotes] = useState(qcCheck?.notes || '');
  const [mfiReading, setMfiReading] = useState(qcCheck?.mfiReading !== undefined && qcCheck?.mfiReading !== null ? qcCheck.mfiReading : '');
  const [uniformity, setUniformity] = useState(qcCheck?.uniformity || 'Even (સરખો)');
  const [trialReport, setTrialReport] = useState(qcCheck?.trialReport || '');
  const [checkedBy, setCheckedBy] = useState(qcCheck?.checkedBy || DEFAULT_PERSONNEL[0] || 'QC Inspector');
  const [approvedBy, setApprovedBy] = useState(qcCheck?.approvedBy || DEFAULT_PERSONNEL[1] || 'Plant Manager');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsub = subscribePersonnel(setPersonnelList);
    return () => unsub();
  }, []);

  if (!qcCheck) return null;

  // Deadline calculation
  const deadlineDate = qcCheck.deadlineDate || (qcCheck.deadlineAt?.toDate ? qcCheck.deadlineAt.toDate() : (qcCheck.deadlineAt ? new Date(qcCheck.deadlineAt) : null));
  const isOverdue = qcCheck.isOverdue || (deadlineDate && Date.now() > deadlineDate.getTime() && qcCheck.status !== 'APPROVED');
  
  let hoursRemaining = null;
  if (deadlineDate) {
    const diffMs = deadlineDate.getTime() - Date.now();
    hoursRemaining = Math.round(diffMs / (1000 * 60 * 60));
  }

  const handleSubmitEvaluation = async (e) => {
    if (e) e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await directEvaluateAndApproveQc(qcCheck.id, {
        result,
        notes,
        checkedBy,
        approvedBy,
        mfiReading,
        uniformity,
        trialReport
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error submitting QC evaluation:', err);
      setErrorMsg(err.message || 'Failed to submit QC evaluation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await approveQcCheck(qcCheck.id, { approvedBy });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Error approving QC:', err);
      setErrorMsg(err.message || 'Failed to approve QC');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md" style={{ maxWidth: '680px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Modern Header */}
        <div className="modal-header-dark" style={{ flexShrink: 0 }}>
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#2563eb' }}>
              <ShieldCheck size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="modal-title">Quality Control (QC) Inspection</h3>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: qcCheck.status === 'APPROVED' ? '#dcfce7' : (qcCheck.status === 'SENT_FOR_APPROVAL' ? '#eff6ff' : '#fef3c7'),
                  color: qcCheck.status === 'APPROVED' ? '#15803d' : (qcCheck.status === 'SENT_FOR_APPROVAL' ? '#1d4ed8' : '#b45309'),
                  border: '1px solid currentColor'
                }}>
                  {qcCheck.status === 'SENT_FOR_APPROVAL' ? 'SENT FOR APPROVAL' : qcCheck.status}
                </span>
              </div>
              <p className="modal-subtitle">
                GRN: <strong>{qcCheck.grnNo || 'N/A'}</strong> • Challan: <strong>{qcCheck.challanNo || 'N/A'}</strong> • Supplier: <strong>{qcCheck.supplierName || 'N/A'}</strong>
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Container with scrolling */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {errorMsg && (
            <div style={{ background: '#fee2e2', border: '1px solid #f87171', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '0.85rem' }}>
              {errorMsg}
            </div>
          )}

          {/* 24-Hour Mandatory SLA Indicator */}
          <div style={{
            padding: '10px 14px',
            borderRadius: '8px',
            background: isOverdue ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${isOverdue ? '#fecaca' : '#bbf7d0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.82rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: isOverdue ? '#dc2626' : '#16a34a' }} />
              <div>
                <strong style={{ color: isOverdue ? '#991b1b' : '#166534' }}>
                  {isOverdue ? '⚠️ 24-Hour QC SLA Overdue!' : '24-Hour Mandatory QC Window'}
                </strong>
                <div style={{ color: isOverdue ? '#b91c1c' : '#15803d', fontSize: '0.76rem' }}>
                  {isOverdue 
                    ? `Inspection expired ${Math.abs(hoursRemaining || 0)} hours ago. Immediate sign-off required.`
                    : hoursRemaining !== null ? `${hoursRemaining} hours remaining to finalize QC inspection.` : 'Pending evaluation.'}
                </div>
              </div>
            </div>
            {deadlineDate && (
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: '#64748b' }}>
                Deadline: <strong>{deadlineDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong> ({deadlineDate.toLocaleDateString()})
              </div>
            )}
          </div>

          {/* Material & Batch Specifications Banner */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            fontSize: '0.8rem'
          }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Material &amp; Grade</div>
              <div style={{ fontWeight: 700, color: '#0f172a' }}>{qcCheck.itemName || '—'}</div>
              <div style={{ fontSize: '0.75rem', color: '#475569' }}>Grade: {qcCheck.grade || '—'}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Form / Color / Packaging</div>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{qcCheck.materialForm || 'Granule'} • {qcCheck.materialColor || 'Natural'}</div>
              <div style={{ fontSize: '0.75rem', color: '#475569' }}>{qcCheck.packaging || 'Woven Bag'}{qcCheck.laminationType ? ` (${qcCheck.laminationType})` : ''}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.72rem' }}>Batch &amp; Inward Weight</div>
              <div style={{ fontWeight: 700, color: '#2563eb' }}>Batch: {qcCheck.batchNumber || 'N/A'}</div>
              <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>Net: {Number(qcCheck.netWeight || 0).toLocaleString()} KG</div>
            </div>
          </div>

          <form id="qc-form" onSubmit={handleSubmitEvaluation} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Result Selection */}
            <div className="mform-field">
              <label className="mform-label" style={{ fontWeight: 700 }}>Inspection Result</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setResult('PASS')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: `2px solid ${result === 'PASS' ? '#16a34a' : '#e2e8f0'}`,
                    background: result === 'PASS' ? '#f0fdf4' : '#ffffff',
                    color: result === 'PASS' ? '#166534' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CheckCircle2 size={18} style={{ color: result === 'PASS' ? '#16a34a' : '#94a3b8' }} />
                  <span>PASS (Accepted)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setResult('FAIL')}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: `2px solid ${result === 'FAIL' ? '#dc2626' : '#e2e8f0'}`,
                    background: result === 'FAIL' ? '#fef2f2' : '#ffffff',
                    color: result === 'FAIL' ? '#991b1b' : '#64748b',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <XCircle size={18} style={{ color: result === 'FAIL' ? '#dc2626' : '#94a3b8' }} />
                  <span>FAIL (Rejected)</span>
                </button>
              </div>
            </div>

            <div className="mform-row mform-col-2">
              <div className="mform-field">
                <label className="mform-label">Inspected By <span className="req">*</span></label>
                <select
                  className="mform-select"
                  value={checkedBy}
                  onChange={e => setCheckedBy(e.target.value)}
                >
                  {personnelList.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="mform-field">
                <label className="mform-label">Approved By (Plant Head / Manager) <span className="req">*</span></label>
                <select
                  className="mform-select"
                  value={approvedBy}
                  onChange={e => setApprovedBy(e.target.value)}
                >
                  {personnelList.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Items 9 & 10: MFI Reading & Uniformity */}
            <div className="mform-row mform-col-2">
              <div className="mform-field">
                <label className="mform-label">
                  MFI Reading (Melt Flow Index)
                  <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: '6px' }}>(g/10 min)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 3.20"
                  className="mform-input"
                  value={mfiReading}
                  onChange={e => setMfiReading(e.target.value)}
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">Uniformity / Consistency (સરખો / અલગ અલગ)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setUniformity('Even (સરખો)')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: `1.5px solid ${uniformity === 'Even (સરખો)' ? '#16a34a' : '#cbd5e1'}`,
                      background: uniformity === 'Even (સરખો)' ? '#f0fdf4' : '#ffffff',
                      color: uniformity === 'Even (સરખો)' ? '#15803d' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Even (સરખો)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUniformity('Uneven (અલગ અલગ)')}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: `1.5px solid ${uniformity === 'Uneven (અલગ અલગ)' ? '#ea580c' : '#cbd5e1'}`,
                      background: uniformity === 'Uneven (અલગ અલગ)' ? '#fff7ed' : '#ffffff',
                      color: uniformity === 'Uneven (અલગ અલગ)' ? '#c2410c' : '#475569',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      cursor: 'pointer'
                    }}
                  >
                    Uneven (અલગ અલગ)
                  </button>
                </div>
              </div>
            </div>

            {/* Item 11: Dedicated Trial & Report Field */}
            <div className="mform-field">
              <label className="mform-label">Trial &amp; Report</label>
              <textarea
                className="mform-textarea"
                rows={2}
                placeholder="Record extruder trial test, sample melt observation, elongation, or batch performance report..."
                value={trialReport}
                onChange={e => setTrialReport(e.target.value)}
              />
            </div>

            <div className="mform-field">
              <label className="mform-label">QC Notes &amp; Observations</label>
              <textarea
                className="mform-textarea"
                rows={2}
                placeholder="Record visual check, moisture inspection, granule consistency, or rejection reason..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            {qcCheck.status === 'SENT_FOR_APPROVAL' && (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.82rem',
                color: '#1e40af'
              }}>
                <div><strong>Evaluation Submitted:</strong> Inspected as <strong>{qcCheck.result || result}</strong> by <strong>{qcCheck.checkedBy || checkedBy}</strong>. Awaiting final plant manager sign-off.</div>
                {(qcCheck.mfiReading || mfiReading || qcCheck.uniformity || uniformity || qcCheck.trialReport || trialReport) && (
                  <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#3b82f6' }}>
                    MFI: <strong>{qcCheck.mfiReading || mfiReading || '—'}</strong> • Uniformity: <strong>{qcCheck.uniformity || uniformity}</strong> • Trial: <em>{qcCheck.trialReport || trialReport || 'None'}</em>
                  </div>
                )}
              </div>
            )}

            {qcCheck.status === 'APPROVED' && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '0.82rem',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ShieldCheck size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
                <div>
                  <strong>QC Approval Completed:</strong> Signed off by <strong>{qcCheck.approvedBy || 'Manager'}</strong> with result <strong>{qcCheck.result}</strong>.
                  {(qcCheck.mfiReading || qcCheck.uniformity || qcCheck.trialReport) && (
                    <div style={{ marginTop: '4px', fontSize: '0.78rem', color: '#15803d' }}>
                      MFI: <strong>{qcCheck.mfiReading || '—'}</strong> • Uniformity: <strong>{qcCheck.uniformity || '—'}</strong> • Trial: <em>{qcCheck.trialReport || 'None'}</em>
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>

        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px', flexShrink: 0 }}>
          <button type="button" className="mfooter-btn cancel" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>

          <button
            type="submit"
            form="qc-form"
            disabled={isSubmitting}
            className="mfooter-btn confirm"
            style={{
              background: result === 'PASS' ? '#16a34a' : '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '8px 20px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '0.825rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}
          >
            {result === 'PASS' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {isSubmitting 
              ? 'Saving Evaluation...' 
              : result === 'PASS' 
                ? 'Submit & Approve QC (PASS)' 
                : 'Submit QC Evaluation (REJECT)'}
          </button>
        </div>

      </div>
    </div>
  );
}
