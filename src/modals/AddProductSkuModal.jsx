import { useState, useMemo } from 'react';
import { X, Layers, Sparkles } from 'lucide-react';
import '../styles/Modals.css';

const BRAND_OPTIONS = ['LOTUS', 'ANCHOR', 'GALAXY', 'KPI', 'KAMANI'];
const SIZE_OPTIONS = ['02MM', '03MM', '04MM', '05MM', '06MM', '08MM', '10MM', '12MM', '14MM', '16MM'];
const PACKING_OPTIONS = ['HANKS', 'CONE', 'COIL', 'REEL', 'BUNDLE'];
const PACK_WEIGHT_OPTIONS = ['1KG', '2KG', '5KG', '10KG', '20KG', '25KG', '50KG'];
const COLOR_OPTIONS = ['F BLUE', 'WHITE', 'GREEN', 'RED', 'NATURAL', 'YELLOW', 'BLACK'];

export default function AddProductSkuModal({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    code: '',
    category: 'PP Danline Rope',
    brand: 'LOTUS',
    sizeDia: '02MM',
    packingType: 'HANKS',
    packWeightKg: '1KG',
    color: 'F BLUE',
    initialStock: '0',
    rate: '245.00',
    reorderLevel: '10'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-compose product name: Brand ^ Size ^ Packing Type ^ Pack Weight ^ Color (Sheet: FG Master)
  const composedName = useMemo(() => {
    return [
      formData.brand,
      formData.sizeDia,
      formData.packingType,
      formData.packWeightKg,
      formData.color
    ].filter(Boolean).join(' ^ ');
  }, [formData.brand, formData.sizeDia, formData.packingType, formData.packWeightKg, formData.color]);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const generatedCode = formData.code.trim() || `FG-${formData.brand.slice(0, 3)}-${formData.sizeDia}-${Math.floor(100 + Math.random() * 900)}`;

    setIsSubmitting(true);
    try {
      if (onSave) {
        await onSave({
          ...formData,
          code: generatedCode,
          name: composedName,
          diaSize: formData.sizeDia,
          colorTracer: formData.color,
          brand: formData.brand,
          packingType: formData.packingType,
          packWeightKg: formData.packWeightKg
        });
      }
      alert(`Product SKU "${composedName}" created successfully!`);
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
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', color: '#34d399' }}>
              <Layers size={16} />
            </div>
            <div>
              <h2 className="modal-title">Add New Finished Goods (FG) SKU</h2>
              <p className="modal-subtitle">5-Part Specification Master: Brand ^ Size ^ Packing ^ Weight ^ Color (Sheet: FG Master)</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Live Specification Preview */}
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sparkles size={16} style={{ color: '#059669', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#047857', textTransform: 'uppercase' }}>
                Item Name
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: '800', color: '#065f46', letterSpacing: '0.3px' }}>
                {composedName || 'Brand ^ Size ^ Packing Type ^ Pack Weight ^ Color'}
              </div>
            </div>
          </div>

          {/* Row 1: Product Code & Category */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">SKU Code (Auto-generated if empty)</label>
              <input
                type="text"
                className="mform-input"
                placeholder={`e.g. FG-${formData.brand.slice(0, 3)}-${formData.sizeDia}`}
                value={formData.code}
                onChange={e => handleChange('code', e.target.value)}
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

          {/* 5 Distinct FG Master Fields from Excel */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Brand <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.brand}
                onChange={e => handleChange('brand', e.target.value)}
                required
              >
                {BRAND_OPTIONS.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="mform-field">
              <label className="mform-label">Size <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.sizeDia}
                onChange={e => handleChange('sizeDia', e.target.value)}
                required
              >
                {SIZE_OPTIONS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Packing Type <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.packingType}
                onChange={e => handleChange('packingType', e.target.value)}
                required
              >
                {PACKING_OPTIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div className="mform-field">
              <label className="mform-label">Pack Weight <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.packWeightKg}
                onChange={e => handleChange('packWeightKg', e.target.value)}
                required
              >
                {PACK_WEIGHT_OPTIONS.map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>

            <div className="mform-field">
              <label className="mform-label">Color <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.color}
                onChange={e => handleChange('color', e.target.value)}
                required
              >
                {COLOR_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Stock, Rate & Reorder */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Initial Stock (Units)</label>
              <input
                type="number"
                min="0"
                className="mform-input"
                value={formData.initialStock}
                onChange={e => handleChange('initialStock', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Selling Rate (₹ / Unit)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="mform-input"
                value={formData.rate}
                onChange={e => handleChange('rate', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Reorder Level (Units)</label>
              <input
                type="number"
                min="1"
                className="mform-input"
                value={formData.reorderLevel}
                onChange={e => handleChange('reorderLevel', e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="mfooter-btn cancel" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save FG Master SKU'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
