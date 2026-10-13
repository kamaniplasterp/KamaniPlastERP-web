import { useState } from 'react';
import { X, MapPin, Building, Warehouse, User, Phone, CheckCircle2 } from 'lucide-react';
import { addLocation, updateLocation } from '../api/locations.api';
import '../styles/Modals.css';

export default function LocationMasterModal({ locationToEdit, onClose, onSaved }) {
  const isEditing = Boolean(locationToEdit?.id);

  const [formData, setFormData] = useState({
    locationCode: locationToEdit?.locationCode || `LOC-${Math.floor(100 + Math.random() * 900)}`,
    name: locationToEdit?.name || '',
    type: locationToEdit?.type || 'INTERNAL',
    address: locationToEdit?.address || '',
    contactPerson: locationToEdit?.contactPerson || '',
    phone: locationToEdit?.phone || '',
    capacityKg: locationToEdit?.capacityKg !== undefined ? String(locationToEdit.capacityKg) : '50000',
    isDefault: locationToEdit?.isDefault || false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a location name.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        capacityKg: Number(formData.capacityKg || 0),
        isDefault: Boolean(formData.isDefault)
      };

      if (isEditing) {
        await updateLocation(locationToEdit.id, payload);
        alert(`Location "${formData.name}" updated successfully!`);
      } else {
        await addLocation(payload);
        alert(`Location "${formData.name}" created successfully!`);
      }

      if (onSaved) onSaved(payload);
      onClose();
    } catch (err) {
      console.error('Error saving location master:', err);
      alert('Failed to save location. Check console for details.');
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
            <div className="modal-header-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399' }}>
              <Warehouse size={16} />
            </div>
            <div>
              <h2 className="modal-title">{isEditing ? 'Edit Godown / Location' : 'Add New Godown / Location'}</h2>
              <p className="modal-subtitle">Internal factory warehouses (KPI, Marvel) & outside job worker locations</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Location Code <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. LOC-KPI, LOC-MARVEL"
                value={formData.locationCode}
                onChange={e => handleChange('locationCode', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Location Type <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.type}
                onChange={e => handleChange('type', e.target.value)}
                required
              >
                <option value="INTERNAL">Internal Factory Godown (e.g. KPI, Marvel)</option>
                <option value="JOB_WORKER">Outside Job Worker Site (e.g. Galaxy, Ramjibhai)</option>
              </select>
            </div>
          </div>

          <div className="mform-field">
            <label className="mform-label">Location / Site Name <span className="req">*</span></label>
            <input
              type="text"
              className="mform-input"
              placeholder="e.g. KPI Godown or Marvel Godown or Galaxy Enterprise"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              required
            />
          </div>

          <div className="mform-field">
            <label className="mform-label">Address / Bay Location</label>
            <input
              type="text"
              className="mform-input"
              placeholder="e.g. Plant Bay A-1, Shapar GIDC, Morbi Highway"
              value={formData.address}
              onChange={e => handleChange('address', e.target.value)}
            />
          </div>

          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Contact Person / Supervisor</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Suresh Bhai / Ramji Bhai"
                value={formData.contactPerson}
                onChange={e => handleChange('contactPerson', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Storage Capacity (KG)</label>
              <input
                type="number"
                min="0"
                className="mform-input"
                placeholder="e.g. 50000"
                value={formData.capacityKg}
                onChange={e => handleChange('capacityKg', e.target.value)}
              />
            </div>
          </div>

          {formData.type === 'INTERNAL' && (
            <div style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 13, color: '#e2e8f0' }}>
                <input
                  type="checkbox"
                  style={{ width: 16, height: 16, accentColor: '#10b981' }}
                  checked={formData.isDefault}
                  onChange={e => handleChange('isDefault', e.target.checked)}
                />
                Default Origin Godown for Raw Materials (e.g. Primary KPI)
              </label>
            </div>
          )}

          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="mfooter-btn cancel" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Location' : 'Save Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
