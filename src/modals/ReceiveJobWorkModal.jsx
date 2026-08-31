import { useState } from 'react';
import { X, FileText } from 'lucide-react';
import '../styles/Modals.css';

export default function ReceiveJobWorkModal({ row, onClose, onSave }) {
  const jwId = row?.jwNo || row?.id || 'JW-ORDER';
  const party = row?.vendor || row?.party || 'Job Worker';

  const [form, setForm] = useState({
    receivedQty: row?.balQtyKg !== undefined ? String(row.balQtyKg) : '',
    scrapQty: '0',
    acceptedQty: row?.balQtyKg !== undefined ? String(row.balQtyKg) : '',
    qualityStatus: 'Approved',
    location: 'WIP Storage Floor 1',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const maxPending = Number(row?.balQtyKg !== undefined ? row.balQtyKg : (row?.pendingQty ? parseFloat(String(row.pendingQty).replace(/[^0-9.]/g, '')) : 0));
    const recKg = Number(form.receivedQty || 0);
    const scrapKg = Number(form.scrapQty || 0);
    const totalAccounted = recKg + scrapKg;

    if (totalAccounted <= 0) {
      alert('Please enter a valid received or scrap quantity greater than 0 KG.');
      return;
    }

    if (maxPending > 0 && totalAccounted > maxPending) {
      alert(`Cannot receive ${totalAccounted.toLocaleString()} KG! Maximum remaining pending quantity outside at vendor is ${maxPending.toLocaleString()} KG.`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (onSave) {
        await onSave({ jwId, party, ...form });
      }
      onClose();
    } catch (err) {
      console.error('Error in GRN submit:', err);
      alert('Failed to record GRN receipt. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md">
        {/* Dark Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: 'rgba(249, 115, 22, 0.2)', border: '1px solid rgba(249, 115, 22, 0.3)', color: '#f97316' }}>
              <FileText size={16} />
            </div>
            <div>
              <h2 className="modal-title">Record Goods Receipt Note (GRN)</h2>
              <p className="modal-subtitle">Process incoming returned goods for {jwId} from {party}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Row 1: Received Qty & Scrap Qty */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Received Quantity (KG) <span className="req">*</span></label>
              <input
                type="number"
                className="mform-input"
                value={form.receivedQty}
                onChange={e => handleChange('receivedQty', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Scrap / Wastage (KG)</label>
              <input
                type="number"
                className="mform-input"
                value={form.scrapQty}
                onChange={e => handleChange('scrapQty', e.target.value)}
              />
            </div>
          </div>

          {/* Row 2: Accepted Qty & Quality Status */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Accepted Quantity (KG) <span className="req">*</span></label>
              <input
                type="number"
                className="mform-input"
                value={form.acceptedQty}
                onChange={e => handleChange('acceptedQty', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Quality Status</label>
              <select
                className="mform-select"
                value={form.qualityStatus}
                onChange={e => handleChange('qualityStatus', e.target.value)}
              >
                <option value="Approved">Approved (Passed A-Grade)</option>
                <option value="Rework">Rework Required</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Row 3: Location */}
          <div className="mform-field">
            <label className="mform-label">Target Warehouse Stock Location</label>
            <input
              type="text"
              className="mform-input"
              value={form.location}
              onChange={e => handleChange('location', e.target.value)}
            />
          </div>

          {/* Row 4: Notes */}
          <div className="mform-field">
            <label className="mform-label">Inspection &amp; QA Remarks</label>
            <input
              type="text"
              className="mform-input"
              value={form.notes}
              onChange={e => handleChange('notes', e.target.value)}
            />
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm" style={{ background: '#f97316' }}>
              Save GRN Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
