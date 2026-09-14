import { useState } from 'react';
import { X, Layers } from 'lucide-react';
import { RM_ITEM_NAMES, RM_GRADES } from '../api/inventory.api';
import '../styles/Modals.css';

export default function AddRawMaterialModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    code: `RM-${Math.floor(1000 + Math.random() * 9000)}`,
    category: 'PP Granules',
    name: RM_ITEM_NAMES[0],
    brand: 'Reliance Polymers',
    grade: RM_GRADES[0],
    openingStock: '0',
    rate: '112',
    reorderLevel: '1000'
  });

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (Number(formData.openingStock || 0) < 0) {
      alert('Opening stock quantity cannot be negative.');
      return;
    }
    if (Number(formData.rate || 0) < 0) {
      alert('Material rate cannot be negative.');
      return;
    }
    if (onSave) onSave(formData);
    alert(`Polymer Raw Material "${formData.name} ^ ${formData.grade}" successfully added!`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md">
        {/* Dark Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="modal-title">Add Polymer Raw Material Master</h2>
              <p className="modal-subtitle">Configure SKU code, polymer classification, grade, and initial stock.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Row 1: Code & Category */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Material Code <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                value={formData.code}
                onChange={e => handleChange('code', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Category <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.category}
                onChange={e => handleChange('category', e.target.value)}
                required
              >
                <option value="Granules">Polymer Granules</option>
                <option value="Grinder">Grinder / Regrind</option>
                <option value="Yarn">Monofilament / Raffia Yarn</option>
                <option value="Twine">Twine &amp; Hank</option>
                <option value="Masterbatch">Color Masterbatch</option>
                <option value="Packaging">Packaging Bora &amp; Cones</option>
              </select>
            </div>
          </div>

          {/* Row 2: Material Item Name (Sub Item) */}
          <div className="mform-field">
            <label className="mform-label">Item Name <span className="req">*</span></label>
            <select
              className="mform-select"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              required
            >
              {RM_ITEM_NAMES.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>

          {/* Row 3: Brand & Grade */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Brand / Producer</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Reliance, Indian Oil, Borouge"
                value={formData.brand}
                onChange={e => handleChange('brand', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Grade <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.grade}
                onChange={e => handleChange('grade', e.target.value)}
                required
              >
                {RM_GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: 3-column Stock, Rate & Reorder Level */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Opening Stock (KG)</label>
              <input
                type="number"
                className="mform-input"
                value={formData.openingStock}
                onChange={e => handleChange('openingStock', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Rate (₹ / KG)</label>
              <input
                type="number"
                step="0.1"
                className="mform-input"
                value={formData.rate}
                onChange={e => handleChange('rate', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Reorder Level</label>
              <input
                type="number"
                className="mform-input"
                value={formData.reorderLevel}
                onChange={e => handleChange('reorderLevel', e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm">
              Save Material
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
