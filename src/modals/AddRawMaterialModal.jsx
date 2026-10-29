import { useState, useEffect } from 'react';
import { X, Layers } from 'lucide-react';
import { RM_ITEM_NAMES, RM_GRADES, subscribeRawMaterials } from '../api/inventory.api';
import SearchableSelect from '../components/SearchableSelect';
import { showAlert } from '../context/CustomAlertContext';
import '../styles/Modals.css';

export default function AddRawMaterialModal({ onClose, onSave }) {
  const [liveMaterials, setLiveMaterials] = useState([]);

  useEffect(() => {
    const unsub = subscribeRawMaterials(setLiveMaterials);
    return () => unsub();
  }, []);

  const [formData, setFormData] = useState({
    code: `RM-${Math.floor(1000 + Math.random() * 9000)}`,
    category: 'PP Granules',
    name: RM_ITEM_NAMES[0] || 'HDPE Granules',
    brand: 'Reliance Polymers',
    grade: RM_GRADES[0] || 'RIL H030SG',
    openingStock: '0',
    rate: '112',
    reorderLevel: '1000'
  });

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(formData.openingStock || 0) < 0) {
      await showAlert('Opening stock quantity cannot be negative.', { type: 'warning', title: 'Invalid Quantity' });
      return;
    }
    if (Number(formData.rate || 0) < 0) {
      await showAlert('Material rate cannot be negative.', { type: 'warning', title: 'Invalid Rate' });
      return;
    }
    if (onSave) onSave(formData);
    await showAlert(`Polymer Raw Material "${formData.name} ^ ${formData.grade}" successfully added!`, { type: 'success', title: 'Material Added' });
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
              <SearchableSelect
                value={formData.category}
                onChange={val => handleChange('category', val)}
                options={[
                  { value: 'Granules', label: 'Polymer Granules' },
                  { value: 'Grinder', label: 'Grinder / Regrind' },
                  { value: 'Yarn', label: 'Monofilament / Raffia Yarn' },
                  { value: 'Twine', label: 'Twine & Hank' },
                  { value: 'Masterbatch', label: 'Color Masterbatch' },
                  { value: 'Packaging', label: 'Packaging Bora & Cones' }
                ]}
                placeholder="-- Select Category --"
                searchPlaceholder="Search category..."
                required
              />
            </div>
          </div>

          {/* Row 2: Material Item Name (Sub Item) */}
          <div className="mform-field">
            <label className="mform-label">Item Name <span className="req">*</span></label>
            <input
              type="text"
              className="mform-input"
              list="raw-materials-datalist"
              placeholder="e.g. GRANUALS-HDPE, PP Granules"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              required
            />
            <datalist id="raw-materials-datalist">
              {liveMaterials.map(m => (
                <option key={m.id || m.name} value={m.name || m.code || ''} />
              ))}
              {RM_ITEM_NAMES.map(item => (
                <option key={item} value={item} />
              ))}
            </datalist>
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
              <SearchableSelect
                value={formData.grade}
                onChange={val => handleChange('grade', val)}
                options={RM_GRADES}
                placeholder="-- Select Grade --"
                searchPlaceholder="Search polymer grade..."
                required
              />
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
