import { useState, useEffect } from 'react';
import { X, MapPin, Building, Warehouse, User, Phone, CheckCircle2 } from 'lucide-react';
import { addLocation, updateLocation } from '../api/locations.api';
import { showAlert } from '../context/CustomAlertContext';
import '../styles/Modals.css';

export default function LocationMasterModal({ locationToEdit, location, onClose, onSaved }) {
  const targetLoc = locationToEdit || location;
  const isEditing = Boolean(targetLoc && (targetLoc.id || targetLoc.locationCode));

  const [formData, setFormData] = useState({
    locationCode: targetLoc?.locationCode || `LOC-${Math.floor(100 + Math.random() * 900)}`,
    name: targetLoc?.name || '',
    type: targetLoc?.type || 'INTERNAL',
    address: targetLoc?.address || '',
    contactPerson: targetLoc?.contactPerson || '',
    phone: targetLoc?.phone || '',
    capacityKg: targetLoc?.capacityKg !== undefined ? String(targetLoc.capacityKg) : '50000',
    isDefault: targetLoc?.isDefault || false
  });

  useEffect(() => {
    if (targetLoc) {
      setFormData({
        locationCode: targetLoc.locationCode || `LOC-${Math.floor(100 + Math.random() * 900)}`,
        name: targetLoc.name || '',
        type: targetLoc.type || 'INTERNAL',
        address: targetLoc.address || '',
        contactPerson: targetLoc.contactPerson || '',
        phone: targetLoc.phone || '',
        capacityKg: targetLoc.capacityKg !== undefined ? String(targetLoc.capacityKg) : '50000',
        isDefault: targetLoc.isDefault || false
      });
    }
  }, [targetLoc]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      await showAlert('Please enter a location name.', { type: 'warning', title: 'Required Field' });
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
        const targetId = targetLoc.id || targetLoc.locationCode;
        await updateLocation(targetId, payload);
        await showAlert(`Location "${formData.name}" updated successfully!`, { type: 'success', title: 'Location Updated' });
      } else {
        await addLocation(payload);
        await showAlert(`Location "${formData.name}" created successfully!`, { type: 'success', title: 'Location Created' });
      }

      if (onSaved) onSaved(payload);
      onClose();
    } catch (err) {
      console.error('Error saving location master:', err);
      await showAlert('Failed to save location. Check console for details.', { type: 'error' });
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
              <h2 className="modal-title">
                {isEditing ? `Edit Godown: ${targetLoc?.name || formData.name}` : 'Add New Godown / Location'}
              </h2>
              <p className="modal-subtitle">
                {isEditing
                  ? `Editing: "${targetLoc?.name || formData.name}" (${targetLoc?.locationCode || formData.locationCode})`
                  : 'Internal factory warehouses (KPI, Marvel) & outside job worker locations'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {isEditing && (
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '10px 14px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Current Godown / Location
                </span>
                <div style={{ color: '#065f46', fontWeight: 700, fontSize: '0.98rem' }}>
                  {targetLoc?.name || formData.name}
                </div>
              </div>
              <span style={{
                background: '#d1fae5',
                border: '1px solid #6ee7b7',
                color: '#047857',
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '3px 10px',
                borderRadius: '6px'
              }}>
                {targetLoc?.locationCode || formData.locationCode}
              </span>
            </div>
          )}

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
            <label className="mform-label">Address / Bay Location <span style={{ fontSize: '0.72rem', color: '#64748b' }}>(Optional)</span></label>
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
              <label className="mform-label">Contact Person / Supervisor <span style={{ fontSize: '0.72rem', color: '#64748b' }}>(Optional)</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Suresh Bhai / Ramji Bhai"
                value={formData.contactPerson}
                onChange={e => handleChange('contactPerson', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Storage Capacity (KG) <span style={{ fontSize: '0.72rem', color: '#64748b' }}>(Optional)</span></label>
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
            <div style={{ 
              marginTop: '10px',
              padding: '12px 14px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px'
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#0f172a', margin: 0 }}>
                <input
                  type="checkbox"
                  style={{ width: 16, height: 16, accentColor: '#059669', cursor: 'pointer' }}
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
