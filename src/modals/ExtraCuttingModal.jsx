import { useState, useEffect } from 'react';
import { X, Scissors, Calendar, User, FileText, DollarSign, Weight, AlertCircle } from 'lucide-react';
import { addExtraCutting } from '../api/jobwork.api';
import { subscribeVendors } from '../api/directory.api';
import '../styles/Modals.css';

export default function ExtraCuttingModal({ onClose, onSaved, prefillVendor }) {
  const [vendors, setVendors] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    partyName: prefillVendor || '',
    deductionDetails: '',
    weightKg: '',
    rate: '17.50',
    remarks: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeVendors(list => {
      setVendors(list);
      if (!formData.partyName && list.length > 0) {
        setFormData(prev => ({ ...prev, partyName: list[0].name }));
      }
    });
    return () => unsub();
  }, []);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const weightNum = parseFloat(formData.weightKg) || 0;
  const rateNum = parseFloat(formData.rate) || 0;
  const calculatedTotal = (weightNum * rateNum).toFixed(2);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.partyName.trim()) {
      alert('Please select or specify a Job Work party name.');
      return;
    }
    if (weightNum <= 0) {
      alert('Please enter a valid weight greater than 0 KG.');
      return;
    }
    if (rateNum < 0) {
      alert('Rate cannot be negative.');
      return;
    }

    try {
      setIsSubmitting(true);
      await addExtraCutting({
        ...formData,
        weightKg: weightNum,
        rate: rateNum,
        totalAmount: parseFloat(calculatedTotal)
      });
      if (onSaved) onSaved(formData);
      alert(`Extra Cutting entry of ${weightNum} KG (₹${calculatedTotal}) saved for ${formData.partyName}!`);
      onClose();
    } catch (err) {
      console.error('Error saving extra cutting deduction:', err);
      alert('Failed to save record. Please check console.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md">
        {/* Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171' }}>
              <Scissors size={16} />
            </div>
            <div>
              <h2 className="modal-title">Record Extra Cutting / Wastage Deduction</h2>
              <p className="modal-subtitle">Log piece-rate weight deductions &amp; processing allowances (Sheet: Extra Cutting)</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">
                <Calendar size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Date <span className="req">*</span>
              </label>
              <input
                type="date"
                className="mform-input"
                value={formData.date}
                onChange={e => handleChange('date', e.target.value)}
                required
              />
            </div>

            <div className="mform-field">
              <label className="mform-label">
                <User size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Party Name <span className="req">*</span>
              </label>
              <select
                className="mform-select"
                value={formData.partyName}
                onChange={e => handleChange('partyName', e.target.value)}
                required
              >
                {vendors.map(v => (
                  <option key={v.id || v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mform-field">
            <label className="mform-label">
              <FileText size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Deduction Details <span className="req">*</span>
            </label>
            <input
              type="text"
              className="mform-input"
              placeholder="e.g. Edge trimming wastage / extra cutting batch #842"
              value={formData.deductionDetails}
              onChange={e => handleChange('deductionDetails', e.target.value)}
              required
            />
          </div>

          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">
                <Weight size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Weight <span className="req">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="mform-input"
                placeholder="0.00"
                value={formData.weightKg}
                onChange={e => handleChange('weightKg', e.target.value)}
                required
              />
            </div>

            <div className="mform-field">
              <label className="mform-label">
                <DollarSign size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Rate <span className="req">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="mform-input"
                placeholder="17.50"
                value={formData.rate}
                onChange={e => handleChange('rate', e.target.value)}
                required
              />
            </div>

            <div className="mform-field">
              <label className="mform-label">
                Total
              </label>
              <input
                type="text"
                className="mform-input"
                style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold', color: '#b91c1c' }}
                value={`₹ ${calculatedTotal}`}
                readOnly
              />
            </div>
          </div>

          <div className="mform-field">
            <label className="mform-label">Remarks</label>
            <input
              type="text"
              className="mform-input"
              placeholder="e.g. Deducted against Challan #1042 / QA inspection"
              value={formData.remarks}
              onChange={e => handleChange('remarks', e.target.value)}
            />
          </div>

          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="mfooter-btn cancel" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Extra Cutting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
