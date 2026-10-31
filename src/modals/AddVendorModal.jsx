import { useState, useEffect } from 'react';
import { X, Building } from 'lucide-react';
import { subscribeProcesses } from '../api/process.api';
import SearchableSelect from '../components/SearchableSelect';
import { showAlert } from '../context/CustomAlertContext';
import '../styles/Modals.css';

export default function AddVendorModal({ onClose, onSave, initialData = null, vendor = null }) {
  const currentVendor = initialData || vendor;
  const isEditing = Boolean(currentVendor && (currentVendor.id || currentVendor.name));

  const [liveProcesses, setLiveProcesses] = useState([]);

  const [formData, setFormData] = useState({
    name: currentVendor?.name || '',
    processBadge: currentVendor?.processBadge || '',
    phone: currentVendor?.phone && currentVendor.phone !== '-' ? currentVendor.phone : '',
    location: currentVendor?.location && currentVendor.location !== '-' ? currentVendor.location : '',
    gst: currentVendor?.gst ? String(currentVendor.gst).replace(/^GST:\s*/i, '') : '',
    rate: currentVendor?.rate !== undefined 
      ? String(currentVendor.rate).replace(/[^0-9.]/g, '') || '17.5' 
      : '17.5'
  });

  useEffect(() => {
    const unsub = subscribeProcesses((procs) => {
      setLiveProcesses(procs);
      if (procs.length > 0 && !formData.processBadge) {
        setFormData(f => f.processBadge ? f : { ...f, processBadge: procs[0].processName });
      }
    });
    return () => unsub();
  }, []);

  const handleChange = (field, val) => {
    const rawVal = (val && typeof val === 'object' && 'target' in val) ? (val.target?.value ?? '') : val;
    setFormData(prev => ({ ...prev, [field]: rawVal }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanName = (typeof formData.name === 'object' && formData.name) ? (formData.name.target?.value || formData.name.value || '') : String(formData.name || '').trim();
    if (!cleanName) {
      await showAlert('Please enter a valid vendor name.', { type: 'warning', title: 'Required Field' });
      return;
    }
    const cleanBadge = (typeof formData.processBadge === 'object' && formData.processBadge) ? (formData.processBadge.target?.value || formData.processBadge.value || formData.processBadge.label || '') : String(formData.processBadge || '').trim();
    const cleanPhone = (typeof formData.phone === 'object' && formData.phone) ? (formData.phone.target?.value || formData.phone.value || '') : String(formData.phone || '').trim();
    const cleanLocation = (typeof formData.location === 'object' && formData.location) ? (formData.location.target?.value || formData.location.value || '') : String(formData.location || '').trim();
    const cleanGst = (typeof formData.gst === 'object' && formData.gst) ? (formData.gst.target?.value || formData.gst.value || '') : String(formData.gst || '').trim();
    const cleanRate = Number(typeof formData.rate === 'object' && formData.rate ? formData.rate.target?.value : formData.rate) || 17.5;

    const payload = {
      name: cleanName,
      processBadge: cleanBadge,
      phone: cleanPhone,
      location: cleanLocation,
      gst: cleanGst,
      rate: cleanRate
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
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Supplier Name <span className="req">*</span></label>
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
              <label className="mform-label">Process Specialization (from Process Master) <span className="req">*</span></label>
              <SearchableSelect
                value={formData.processBadge}
                onChange={val => handleChange('processBadge', val)}
                options={liveProcesses.map(proc => proc.processName || proc.name || proc)}
                placeholder="-- Select Process Specialization --"
                searchPlaceholder="Search processes (e.g. Yarn, Twine, Extrusion)..."
                required
              />
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
              {isEditing ? 'Update Vendor' : 'Save Vendor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
