import { useState } from 'react';
import { X, Building } from 'lucide-react';
import '../styles/Modals.css';

export default function AddVendorModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    processBadge: 'Extrusion / Yarn Making / Twisting',
    phone: '',
    location: '',
    gst: '',
    rate: '8.5'
  });

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a valid vendor name.');
      return;
    }
    if (onSave) onSave(formData);
    alert(`Vendor "${formData.name}" added successfully to Directory!`);
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
              <h2 className="modal-title">Add New Processing Vendor</h2>
              <p className="modal-subtitle">Register job worker / processing partner in ERP directory</p>
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
              <label className="mform-label">Vendor Business Name <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Shree Plastic Works"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Process Specialization <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.processBadge}
                onChange={e => handleChange('processBadge', e.target.value)}
                required
              >
                <option value="Extrusion / Yarn Making / Twisting">Extrusion / Yarn Making / Twisting</option>
                <option value="Rope Twisting & 3-Strand Laying">Rope Twisting &amp; 3-Strand Laying</option>
                <option value="Tape Plant & Monofilament Extrusion">Tape Plant &amp; Monofilament Extrusion</option>
                <option value="Fishing Twine Ring Twisting & Spooling">Fishing Twine Ring Twisting &amp; Spooling</option>
                <option value="Dyeing / Coloring & Braiding">Dyeing / Coloring &amp; Braiding</option>
              </select>
            </div>
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
              <label className="mform-label">Processing Rate (₹ / KG) <span className="req">*</span></label>
              <input
                type="number"
                step="0.25"
                className="mform-input"
                placeholder="e.g. 8.50"
                value={formData.rate}
                onChange={e => handleChange('rate', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm">
              Save Vendor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
