import { useState } from 'react';
import { X } from 'lucide-react';
import '../styles/Modals.css';

export default function AddProductSkuModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    code: '',
    category: 'PP Danline Rope',
    name: '',
    diaSize: '',
    colorTracer: '',
    initialStock: '0',
    rate: '',
    reorderLevel: '10'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (onSave) {
        await onSave(formData);
      }
      onClose();
    } catch (err) {
      console.error('Error saving SKU:', err);
      alert('Failed to save product SKU. Please check fields.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md">
        {/* Dark Header */}
        <div className="modal-header-dark">
          <div>
            <h2 className="modal-title">Add New Product SKU</h2>
            <p className="modal-subtitle">Register new manufactured coil, reel, or twine product SKU</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Row 1: Product Code & Category */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Product Code <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                value={formData.code}
                onChange={e => handleChange('code', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Product Category <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.category}
                onChange={e => handleChange('category', e.target.value)}
                required
              >
                <option value="PP Danline Rope">PP Danline Rope</option>
                <option value="HDPE Rope">HDPE Rope</option>
                <option value="3 Strand HDPE Rope">3 Strand HDPE Rope</option>
                <option value="HDPE Twine">HDPE Twine</option>
                <option value="Fishing Twine">Fishing Twine</option>
              </select>
            </div>
          </div>

          {/* Row 2: Product Name / Specification */}
          <div className="mform-field">
            <label className="mform-label">Product Name / Specification <span className="req">*</span></label>
            <input
              type="text"
              className="mform-input"
              placeholder="e.g. PP Danline Rope 12mm (Yellow)"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
              required
            />
          </div>

          {/* Row 3: Dia & Color */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Diameter / Size</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. 12 mm"
                value={formData.diaSize}
                onChange={e => handleChange('diaSize', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Color &amp; Tracer Details</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Bright Yellow with Blue Tracer"
                value={formData.colorTracer}
                onChange={e => handleChange('colorTracer', e.target.value)}
              />
            </div>
          </div>

          {/* Row 4: 3-column Stock, Rate & Reorder Level */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Initial Stock (Units)</label>
              <input
                type="number"
                className="mform-input"
                value={formData.initialStock}
                onChange={e => handleChange('initialStock', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Selling Rate (₹ / Unit)</label>
              <input
                type="number"
                className="mform-input"
                value={formData.rate}
                onChange={e => handleChange('rate', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Reorder Level (Units)</label>
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
              Save Product SKU
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
