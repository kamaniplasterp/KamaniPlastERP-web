import React, { useState } from 'react';
import { X } from 'lucide-react';
import '../styles/AddFinishedGoodsStockModal.css';

export default function AddFinishedGoodsStockModal({ material, onClose, onSuccess }) {
  const [qty, setQty] = useState('');
  const [batchNo, setBatchNo] = useState(`BATCH-FG-${Math.floor(Math.random() * 900 + 100)}`);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSuccess) {
      onSuccess({ qty, batchNo, notes });
    } else {
      alert(`Successfully added ${qty} Coils for ${material?.code || 'FG-PPD-06-YL'}!`);
    }
    onClose();
  };

  return (
    <div className="afg-modal-overlay" onClick={onClose}>
      <div className="afg-modal-content" onClick={e => e.stopPropagation()}>
        {/* Dark Modal Header */}
        <div className="afg-modal-header">
          <h2 className="afg-modal-title">Add Finished Goods Stock</h2>
          <button className="afg-modal-close" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="afg-modal-form">
          {/* Selected Product Summary Box */}
          <div className="afg-product-box">
            <div className="afg-prod-title">{material?.name || 'PP Danline Rope 6mm (Yellow)'}</div>
            <div className="afg-prod-sub">
              Code: {material?.code || 'FG-PPD-06-YL'} • Current Free: {material?.freeStock || material?.availFactory || '850 Coils'}
            </div>
          </div>

          {/* Quantity to Inward */}
          <div className="afg-form-group">
            <label className="afg-label">Quantity to Inward (Coils) *</label>
            <input
              type="number"
              className="afg-input"
              value={qty}
              onChange={e => setQty(e.target.value)}
              required
            />
          </div>

          {/* Batch / Lot Number */}
          <div className="afg-form-group">
            <label className="afg-label">Batch / Lot Number</label>
            <input
              type="text"
              className="afg-input"
              value={batchNo}
              onChange={e => setBatchNo(e.target.value)}
              placeholder="e.g. BATCH-FG-932"
            />
          </div>

          {/* Inward Notes */}
          <div className="afg-form-group">
            <label className="afg-label">Inward Notes</label>
            <textarea
              className="afg-textarea"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows="3"
              placeholder="Add production notes..."
            />
          </div>

          {/* Footer Actions */}
          <div className="afg-modal-footer">
            <button type="button" className="afg-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="afg-btn-submit">
              Add Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
