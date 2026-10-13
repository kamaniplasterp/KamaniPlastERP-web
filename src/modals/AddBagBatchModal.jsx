import React, { useState, useEffect } from 'react';
import { X, Scale, Plus, Check, AlertCircle, FileText, Package } from 'lucide-react';
import { addInventoryBagsBatch } from '../api/inventory.api';
import { subscribeLocations, DEFAULT_LOCATIONS_LIST } from '../api/locations.api';
import { subscribeProductAttributes, DEFAULT_PRODUCT_ATTRIBUTES } from '../api/productMatrix.api';

export default function AddBagBatchModal({ isOpen, onClose, currentMaxBagNumber = 0, onBagsAdded }) {
  if (!isOpen) return null;

  const [liveLocations, setLiveLocations] = useState(DEFAULT_LOCATIONS_LIST);
  const [productAttrs, setProductAttrs] = useState(DEFAULT_PRODUCT_ATTRIBUTES);

  useEffect(() => {
    const unsubL = subscribeLocations(setLiveLocations);
    const unsubA = subscribeProductAttributes(setProductAttrs);
    return () => {
      unsubL();
      unsubA();
    };
  }, []);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [inwardSlipNo, setInwardSlipNo] = useState(`SLIP-${Math.floor(1000 + Math.random() * 9000)}`);
  const [quality, setQuality] = useState('VIP');
  const [formType, setFormType] = useState('Hanks');
  const [size, setSize] = useState('3x3');
  const [standardWeightKg, setStandardWeightKg] = useState('50.0');
  const [coilCount, setCoilCount] = useState('12');
  const [location, setLocation] = useState('KPI Godown');
  const [stockType, setStockType] = useState('FIXED');
  const [weightsText, setWeightsText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Parse entered scale weights
  const parsedWeights = weightsText
    .split(/[\s,\n]+/)
    .map(w => parseFloat(w.trim()))
    .filter(w => !isNaN(w) && w > 0);

  const totalBagsCount = parsedWeights.length;
  const totalNetKg = parsedWeights.reduce((sum, w) => sum + w, 0);
  const stdKg = parseFloat(standardWeightKg) || 50;
  const expectedTotalKg = totalBagsCount * stdKg;
  const totalVariance = totalNetKg - expectedTotalKg;
  const avgWeightKg = totalBagsCount > 0 ? (totalNetKg / totalBagsCount).toFixed(2) : '0.00';
  const startBagNum = currentMaxBagNumber + 1;
  const endBagNum = currentMaxBagNumber + totalBagsCount;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (parsedWeights.length === 0) {
      setErrorMsg('Please enter at least one scale weight (e.g. 49.2, 49.7, 50.1).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const coils = parseInt(coilCount, 10) || 12;
      const lotId = `LOT-${date.replace(/-/g, '')}-${quality.toUpperCase().slice(0, 3)}-${size}`;
      const lotTitle = `${totalBagsCount} Bags: ${quality} ${formType} ${size}`;

      const newBags = parsedWeights.map((actWt, idx) => {
        const bagNum = startBagNum + idx;
        return {
          id: `BAG-LOCAL-${Date.now()}-${bagNum}`,
          bagNumber: bagNum,
          inwardSlipNo: inwardSlipNo.trim(),
          productName: 'Fishing Twine',
          quality: quality.trim(),
          form: formType.trim(),
          size: size.trim(),
          standardWeightKg: stdKg,
          actualWeightKg: actWt,
          coilCount: coils,
          stockType: stockType,
          location: location.trim(),
          status: 'AVAILABLE',
          lotGroup: lotId,
          lotTitle: lotTitle,
          receivedAt: date
        };
      });

      try {
        await addInventoryBagsBatch(newBags);
      } catch (err) {
        // Fallback for offline/demo if Firestore not connected
        console.warn('Firestore offline fallback for batch bags:', err.message);
      }

      if (onBagsAdded) {
        onBagsAdded(newBags);
      }

      onClose();
    } catch (err) {
      console.error('Error saving bag batch:', err);
      setErrorMsg('Failed to save bags. Please verify entries.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-lg" style={{ maxWidth: '680px', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Modal Header */}
        <div className="modal-header-dark" style={{ background: '#0f172a', borderBottom: '1px solid #1e293b' }}>
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.4)', color: '#60a5fa' }}>
              <Scale size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#2563eb', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px' }}>
                  DIARY INWARD
                </span>
                <h2 className="modal-title" style={{ fontSize: '1.15rem' }}>Record Inward Bag Batch (Scale Weights)</h2>
              </div>
              <p className="modal-subtitle">
                Directly digitize physical weighing diary entries with sequential integer serials ({startBagNum}, {startBagNum + 1}...).
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form className="modal-body" onSubmit={handleSubmit} style={{ padding: '20px' }}>
          {errorMsg && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Date & Slip No */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Inward Date</label>
              <input 
                type="date" 
                className="mform-input" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Inward Slip # / Challan</label>
              <input 
                type="text" 
                className="mform-input" 
                value={inwardSlipNo} 
                onChange={(e) => setInwardSlipNo(e.target.value)} 
                placeholder="e.g. SLIP-3001"
                required 
              />
            </div>
          </div>

          {/* Row 2: Quality, Form, Size */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Quality / Brand</label>
              <select className="mform-select" value={quality} onChange={(e) => setQuality(e.target.value)}>
                {productAttrs.qualities?.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>

            <div className="mform-field">
              <label className="mform-label">Form</label>
              <select className="mform-select" value={formType} onChange={(e) => setFormType(e.target.value)}>
                {productAttrs.forms?.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div className="mform-field">
              <label className="mform-label">Size</label>
              <input 
                type="text" 
                className="mform-input" 
                value={size} 
                onChange={(e) => setSize(e.target.value)} 
                placeholder="e.g. 3x3, 4x3" 
                required 
              />
            </div>
          </div>

          {/* Row 3: Std Wt, Coils, Godown */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Standard Wt (KG)</label>
              <input 
                type="number" 
                step="0.1" 
                className="mform-input" 
                value={standardWeightKg} 
                onChange={(e) => setStandardWeightKg(e.target.value)} 
                required 
              />
            </div>

            <div className="mform-field">
              <label className="mform-label">Coils / Pcs per Bag</label>
              <input 
                type="number" 
                className="mform-input" 
                value={coilCount} 
                onChange={(e) => setCoilCount(e.target.value)} 
                required 
              />
            </div>

            <div className="mform-field">
              <label className="mform-label">Godown / Location</label>
              <select className="mform-select" value={location} onChange={(e) => setLocation(e.target.value)}>
                {liveLocations.map(loc => (
                  <option key={loc.id || loc.name} value={loc.name}>
                    {loc.name} {loc.type ? `(${loc.type})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Stock Type Toggle */}
          <div className="mform-field">
            <label className="mform-label">Stock Classification</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="stockType" 
                  checked={stockType === 'FIXED'} 
                  onChange={() => setStockType('FIXED')} 
                />
                <span style={{ fontWeight: stockType === 'FIXED' ? 700 : 500, color: stockType === 'FIXED' ? '#16a34a' : '#475569' }}>
                  Fixed Stock (Standard 50.0 KG Bags)
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="stockType" 
                  checked={stockType === 'LOOSE'} 
                  onChange={() => setStockType('LOOSE')} 
                />
                <span style={{ fontWeight: stockType === 'LOOSE' ? 700 : 500, color: stockType === 'LOOSE' ? '#d97706' : '#475569' }}>
                  Loose Stock (Odd / Remainder Weights)
                </span>
              </label>
            </div>
          </div>

          {/* Scale Weights Entry (The Heart of the Diary Register) */}
          <div className="mform-section" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '14px', marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label className="mform-label" style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
                ⚖️ Scale Weights for Each Bag (KG)
              </label>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                Separate by comma, space, or new lines
              </span>
            </div>

            <textarea
              className="mform-input"
              rows={4}
              placeholder="e.g. 49.2, 49.7, 50.1, 50.0, 49.8..."
              value={weightsText}
              onChange={(e) => setWeightsText(e.target.value)}
              style={{ fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.4' }}
              required
            />

            {/* Quick Presets for Demo */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Quick Presets:</span>
              <button
                type="button"
                className="inv-btn-ghost-sm"
                onClick={() => setWeightsText('49.2, 49.7, 50.1')}
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              >
                3 Bags (49.2, 49.7, 50.1)
              </button>
              <button
                type="button"
                className="inv-btn-ghost-sm"
                onClick={() => setWeightsText('50.0, 49.8, 50.2, 49.9, 50.1, 50.0, 49.7, 50.3, 49.9, 50.1')}
                style={{ fontSize: '0.7rem', padding: '2px 8px' }}
              >
                10 Bags (~50kg std)
              </button>
            </div>

            {/* Live Calculation Bracket Summary */}
            {totalBagsCount > 0 && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: '#1e3a8a', color: '#fff', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                      [ {totalBagsCount} Bags: #{startBagNum} to #{endBagNum} ]
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e3a8a' }}>
                      {quality} • {formType} • {size}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb' }}>
                    {totalBagsCount * (parseInt(coilCount, 10) || 12)} Total Coils
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '0.78rem' }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Total Net Wt:</span>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem' }}>{totalNetKg.toFixed(1)} KG</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Average / Bag:</span>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{avgWeightKg} KG</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Expected Std:</span>
                    <div style={{ fontWeight: 600, color: '#475569' }}>{expectedTotalKg.toFixed(1)} KG</div>
                  </div>
                  <div>
                    <span style={{ color: '#64748b' }}>Variance:</span>
                    <div style={{ fontWeight: 700, color: totalVariance >= 0 ? '#16a34a' : '#ef4444' }}>
                      {totalVariance >= 0 ? `+${totalVariance.toFixed(1)}` : totalVariance.toFixed(1)} KG
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
            <button type="button" className="inv-btn-ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="inv-btn-primary" 
              disabled={isSubmitting || parsedWeights.length === 0}
              style={{ background: '#0f172a', color: '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <Check size={16} />
              {isSubmitting ? 'Saving...' : `Record ${totalBagsCount || ''} Bags in Register`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
