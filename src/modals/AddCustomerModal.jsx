import { useState } from 'react';
import { X, Building } from 'lucide-react';
import '../styles/Modals.css';

export default function AddCustomerModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Marine & Fishing Supplies',
    phone: '',
    location: '',
    gst: '',
    paymentTerms: '30 Days Net'
  });

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a valid customer name.');
      return;
    }
    if (onSave) onSave(formData);
    alert(`Customer / Buyer "${formData.name}" added successfully to Directory!`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md">
        {/* Dark Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
              <Building size={16} />
            </div>
            <div>
              <h2 className="modal-title">Add New Customer / Buyer</h2>
              <p className="modal-subtitle">Register buyer or wholesale distributor in ERP directory</p>
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
              <label className="mform-label">Customer / Company Name <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. ABC Marine Traders"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Category / Sector <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.category}
                onChange={e => handleChange('category', e.target.value)}
                required
              >
                <option value="Marine & Fishing Supplies">Marine &amp; Fishing Supplies</option>
                <option value="Agricultural & Packaging Ropes">Agricultural &amp; Packaging Ropes</option>
                <option value="Hardware & Industrial Wholesale">Hardware &amp; Industrial Wholesale</option>
                <option value="Export & Shipping Supplies">Export &amp; Shipping Supplies</option>
              </select>
            </div>
          </div>

          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Contact Phone / Manager <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. +91 98480 32119 (Capt. Roy)"
                value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">City / Destination <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Veraval, Gujarat"
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
                placeholder="e.g. 24AAABC9912F1Z8"
                value={formData.gst}
                onChange={e => handleChange('gst', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Payment Terms</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. 30 Days Net"
                value={formData.paymentTerms}
                onChange={e => handleChange('paymentTerms', e.target.value)}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm">
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
