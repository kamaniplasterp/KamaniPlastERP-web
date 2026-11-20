import { useState } from 'react';
import { X, Building } from 'lucide-react';
import { showAlert } from '../context/CustomAlertContext';
import '../styles/Modals.css';

export default function AddVendorModal({ onClose, onSave, initialData = null, vendor = null }) {
  const currentVendor = initialData || vendor;
  const isEditing = Boolean(currentVendor && (currentVendor.id || currentVendor.name));

  const [formData, setFormData] = useState({
    name: currentVendor?.name || '',
    phone: currentVendor?.phone && currentVendor.phone !== '-' ? currentVendor.phone : '',
    location: currentVendor?.location && currentVendor.location !== '-' ? currentVendor.location : '',
    gst: currentVendor?.gst ? String(currentVendor.gst).replace(/^GST:\s*/i, '') : '',
    address: currentVendor?.address || ''
  });

  const handleChange = (field, val) => {
    const rawVal = (val && typeof val === 'object' && 'target' in val) ? (val.target?.value ?? '') : val;
    setFormData(prev => ({ ...prev, [field]: rawVal }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = String(formData.name || '').trim();
    if (!cleanName) {
      await showAlert('Please enter a valid vendor name.', { type: 'warning', title: 'Required Field' });
      return;
    }
    const cleanPhone = String(formData.phone || '').trim();
    const cleanLocation = String(formData.location || '').trim();
    const cleanGst = String(formData.gst || '').trim();
    const cleanAddress = String(formData.address || '').trim();

    const payload = {
      name: cleanName,
      phone: cleanPhone,
      location: cleanLocation,
      gst: cleanGst,
      address: cleanAddress
    };

    if (onSave) onSave(payload, currentVendor?.id);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md">
        {/* Dark Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa' }}>
              <Building size={16} />
            </div>
            <div>
              <h2 className="modal-title">{isEditing ? 'Edit Processing Vendor' : 'Add New Processing Vendor'}</h2>
              <p className="modal-subtitle">{isEditing ? `Update details for "${currentVendor?.name || formData.name}"` : 'Register job worker / processing partner in ERP directory'}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="mform-field">
            <label className="mform-label">Supplier / Vendor Name <span className="req">*</span></label>
            <input
              type="text"
              className="mform-input"
              placeholder="e.g. Shree Plastic Works"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Contact Phone / Person <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. +91 98250 41290 (Mansukhbhai)"
                value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">City / Location <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Morbi, Gujarat"
                value={formData.location}
                onChange={e => handleChange('location', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">GSTIN Number</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. 24AABCS9912K1Z4"
                value={formData.gst}
                onChange={e => handleChange('gst', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Address / GIDC Estate</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Plot No. 44, GIDC Phase-2"
                value={formData.address}
                onChange={e => handleChange('address', e.target.value)}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm">
              {isEditing ? 'Update Vendor' : 'Save Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
