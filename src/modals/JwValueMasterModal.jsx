import { useState } from 'react';
import { X, DollarSign, Tag, Calendar, Layers } from 'lucide-react';
import { RM_ITEM_NAMES } from '../api/inventory.api';
import { addJwValueMaster, updateJwValueMaster } from '../api/directory.api';
import { showAlert } from '../context/CustomAlertContext';
import '../styles/Modals.css';

export default function JwValueMasterModal({ onClose, onSaved, initialData = null }) {
  const isEditing = Boolean(initialData && (initialData.id || initialData.code));

  const [formData, setFormData] = useState({
    code: initialData?.code || `VAL-${Math.floor(1000 + Math.random() * 9000)}`,
    date: initialData?.date || new Date().toISOString().split('T')[0],
    itemDescription: initialData?.itemDescription || RM_ITEM_NAMES[0] || 'GRANUALS-HDPE',
    value: initialData?.value !== undefined ? String(initialData.value) : '85.00'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.code.trim()) {
      await showAlert('Please provide a unique code.', { type: 'warning', title: 'Required Field' });
      return;
    }
    if (!formData.itemDescription.trim()) {
      await showAlert('Please select or specify an item description.', { type: 'warning', title: 'Required Field' });
      return;
    }
    const numVal = Number(formData.value);
    if (isNaN(numVal) || numVal <= 0) {
      await showAlert('Please enter a valid valuation amount.', { type: 'warning', title: 'Invalid Value' });
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing) {
        await updateJwValueMaster(initialData.id, formData);
        await showAlert(`JW Value Master record (${formData.code}) updated successfully!`, { type: 'success', title: 'Valuation Updated' });
      } else {
        await addJwValueMaster(formData);
        await showAlert(`JW Value Master record (${formData.code}) created successfully!`, { type: 'success', title: 'Valuation Created' });
      }
      if (onSaved) onSaved(formData);
      onClose();
    } catch (err) {
      console.error('Error saving JW Value Master record:', err);
      await showAlert('Failed to save JW Value Master. Please check console for details.', { type: 'error' });
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
              <h2 className="modal-title">{isEditing ? 'Edit JW Value Master Entry' : 'Add JW Value Master Entry'}</h2>
              <p className="modal-subtitle">
                {isEditing 
                  ? `Update valuation standard for ${initialData?.code || formData.code}`
                  : 'Define standardized processing valuation rates per item specification'}
              </p>
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
              {isSubmitting ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Value Master' : 'Save Value Master')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
