import { useState } from 'react';
import { X, DollarSign, Tag, Calendar, Layers } from 'lucide-react';
import { RM_ITEM_NAMES } from '../api/inventory.api';
import { addJwValueMaster } from '../api/directory.api';
import '../styles/Modals.css';

export default function JwValueMasterModal({ onClose, onSaved }) {
  const [formData, setFormData] = useState({
    code: `VAL-${Math.floor(1000 + Math.random() * 9000)}`,
    date: new Date().toISOString().split('T')[0],
    itemDescription: RM_ITEM_NAMES[0] || 'GRANUALS-HDPE',
    value: '85.00'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      alert('Please provide a unique code.');
      return;
    }
    if (!formData.itemDescription.trim()) {
      alert('Please select or specify an item description.');
      return;
    }
    const numVal = Number(formData.value);
    if (isNaN(numVal) || numVal <= 0) {
      alert('Please enter a valid valuation amount.');
      return;
    }

    try {
      setIsSubmitting(true);
      await addJwValueMaster(formData);
      if (onSaved) onSaved(formData);
      alert(`JW Value Master record (${formData.code}) created successfully!`);
      onClose();
    } catch (err) {
      console.error('Error creating JW Value Master record:', err);
      alert('Failed to save JW Value Master. Please check console for details.');
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
            <div className="modal-header-icon" style={{ background: 'rgba(234, 88, 12, 0.2)', border: '1px solid rgba(234, 88, 12, 0.4)', color: '#fb923c' }}>
              <DollarSign size={16} />
            </div>
            <div>
              <h2 className="modal-title">Add JW Value Master Entry</h2>
              <p className="modal-subtitle">Define standardized processing valuation rates per item specification</p>
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
                <Tag size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                Code <span className="req">*</span>
              </label>
              <input
                type="text"
                className="mform-input"
                placeholder="VAL-001"
                value={formData.code}
                onChange={e => handleChange('code', e.target.value)}
                required
              />
            </div>

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
          </div>

          <div className="mform-field">
            <label className="mform-label">
              <Layers size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Item Description <span className="req">*</span>
            </label>
            <select
              className="mform-select"
              value={formData.itemDescription}
              onChange={e => handleChange('itemDescription', e.target.value)}
              required
            >
              {RM_ITEM_NAMES.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          <div className="mform-field">
            <label className="mform-label">
              <DollarSign size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Value <span className="req">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="mform-input"
              placeholder="e.g. 85.00"
              value={formData.value}
              onChange={e => handleChange('value', e.target.value)}
              required
            />
          </div>

          {/* Footer Actions */}
          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="mfooter-btn cancel" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Value Master'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
