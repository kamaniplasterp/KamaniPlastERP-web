import { useState } from 'react';
import { X, Cog, Layers, DollarSign, Scale, Percent, FileText, CheckCircle2 } from 'lucide-react';
import { addProcess, updateProcess } from '../api/process.api';
import '../styles/Modals.css';

export default function ProcessMasterModal({ processToEdit, onClose, onSaved }) {
  const isEditing = Boolean(processToEdit?.id);

  const [formData, setFormData] = useState({
    processCode: processToEdit?.processCode || `PROC-${Math.floor(100 + Math.random() * 900)}`,
    processName: processToEdit?.processName || '',
    inputItemType: processToEdit?.inputItemType || 'PP/HDPE Granules',
    outputItemType: processToEdit?.outputItemType || 'Fishing Yarn',
    defaultRatePerKg: processToEdit?.defaultRatePerKg !== undefined ? String(processToEdit.defaultRatePerKg) : '5.00',
    isFixedWeight: processToEdit?.isFixedWeight !== undefined ? processToEdit.isFixedWeight : true,
    standardBagWeightKg: processToEdit?.standardBagWeightKg !== undefined ? String(processToEdit.standardBagWeightKg) : '50.0',
    toleranceKg: processToEdit?.toleranceKg !== undefined ? String(processToEdit.toleranceKg) : '1.0',
    expectedScrapPct: processToEdit?.expectedScrapPct !== undefined ? String(processToEdit.expectedScrapPct) : '1.0',
    description: processToEdit?.description || ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.processName.trim()) {
      alert('Please enter a valid process name.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...formData,
        defaultRatePerKg: Number(formData.defaultRatePerKg || 0),
        isFixedWeight: Boolean(formData.isFixedWeight),
        standardBagWeightKg: formData.isFixedWeight ? Number(formData.standardBagWeightKg || 50) : 0,
        toleranceKg: formData.isFixedWeight ? Number(formData.toleranceKg || 1) : 0,
        expectedScrapPct: Number(formData.expectedScrapPct || 0)
      };

      if (isEditing) {
        await updateProcess(processToEdit.id, payload);
        alert(`Process "${formData.processName}" updated successfully!`);
      } else {
        await addProcess(payload);
        alert(`Process "${formData.processName}" created successfully!`);
      }

      if (onSaved) onSaved(payload);
      onClose();
    } catch (err) {
      console.error('Error saving process master:', err);
      alert('Failed to save process master. Check console for details.');
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
            <div className="modal-header-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}>
              <Cog size={16} />
            </div>
            <div>
              <h2 className="modal-title">{isEditing ? 'Edit Process Master' : 'Add New Process Master'}</h2>
              <p className="modal-subtitle">Define conversion rates, fixed bag weight rules, and input/output mapping</p>
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
              <label className="mform-label">Process Code <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                value={formData.processCode}
                onChange={e => handleChange('processCode', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Processing Rate (₹ / KG) <span className="req">*</span></label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 13 }}>₹</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  style={{ paddingLeft: 24 }}
                  className="mform-input"
                  placeholder="e.g. 5.00"
                  value={formData.defaultRatePerKg}
                  onChange={e => handleChange('defaultRatePerKg', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <div className="mform-field">
            <label className="mform-label">Process Name <span className="req">*</span></label>
            <input
              type="text"
              className="mform-input"
              placeholder="e.g. Granules to Fishing Yarn or Fishing Yarn to Twine 3x3"
              value={formData.processName}
              onChange={e => handleChange('processName', e.target.value)}
              required
            />
          </div>

          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Input Material Type <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. PP/HDPE Granules or Fishing Yarn"
                value={formData.inputItemType}
                onChange={e => handleChange('inputItemType', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Output Product Type <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Fishing Yarn or 3x3 Twine Hank"
                value={formData.outputItemType}
                onChange={e => handleChange('outputItemType', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Fixed Weight Configuration Section */}
          <div style={{ 
            background: 'rgba(15, 23, 42, 0.6)', 
            border: '1px solid rgba(51, 65, 85, 0.7)', 
            borderRadius: '8px', 
            padding: '12px 14px', 
            marginTop: '8px',
            marginBottom: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: formData.isFixedWeight ? 10 : 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  style={{ width: 16, height: 16, accentColor: '#3b82f6', cursor: 'pointer' }}
                  checked={formData.isFixedWeight}
                  onChange={e => handleChange('isFixedWeight', e.target.checked)}
                />
                Fixed Weight Process (Bags stored in Main Stock)
              </label>
              <span style={{ fontSize: '11px', color: formData.isFixedWeight ? '#38bdf8' : '#94a3b8' }}>
                {formData.isFixedWeight ? '✓ Fixed Bag Standard Active' : 'Variable Weight Only'}
              </span>
            </div>

            {formData.isFixedWeight && (
              <div className="mform-row mform-col-2" style={{ marginTop: '10px' }}>
                <div className="mform-field">
                  <label className="mform-label">Standard Bag Weight (KG) <span className="req">*</span></label>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    className="mform-input"
                    placeholder="e.g. 50.0"
                    value={formData.standardBagWeightKg}
                    onChange={e => handleChange('standardBagWeightKg', e.target.value)}
                    required={formData.isFixedWeight}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Standard weight per bag (e.g. 50 KG)</span>
                </div>
                <div className="mform-field">
                  <label className="mform-label">Tolerance (± KG)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    className="mform-input"
                    placeholder="e.g. 1.0"
                    value={formData.toleranceKg}
                    onChange={e => handleChange('toleranceKg', e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Allowable variation (e.g. 49.0 - 51.0 KG)</span>
                </div>
              </div>
            )}
          </div>

          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Expected Scrap / Loss (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                className="mform-input"
                placeholder="e.g. 1.0"
                value={formData.expectedScrapPct}
                onChange={e => handleChange('expectedScrapPct', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Description / Remarks</label>
              <input
                type="text"
                className="mform-input"
                placeholder="Optional notes"
                value={formData.description}
                onChange={e => handleChange('description', e.target.value)}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="mfooter-btn cancel" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Process' : 'Save Process Master'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
