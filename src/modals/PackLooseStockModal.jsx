import React, { useState, useEffect } from 'react';
import { X, Package, Scale, Layers, Printer, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { packLooseStockIntoBags } from '../api/inventory.api';
import { subscribeLocations, DEFAULT_LOCATIONS_LIST } from '../api/locations.api';
import { printMultipleBagStickers } from '../utils/stickerPdf';
import { useAuth } from '../context/AuthContext';
import '../styles/Modals.css';

export default function PackLooseStockModal({ isOpen, onClose, material, onPackedSuccess }) {
  if (!isOpen || !material) return null;

  const { currentUser } = useAuth();
  const [liveLocations, setLiveLocations] = useState(DEFAULT_LOCATIONS_LIST);

  useEffect(() => {
    const unsubL = subscribeLocations(setLiveLocations);
    return () => unsubL();
  }, []);

  const availableKg = Number(material.looseWeightKg || 0);
  const [targetBagWeightKg, setTargetBagWeightKg] = useState('50.0');
  const stdWeight = parseFloat(targetBagWeightKg) || 50.0;
  const maxPossibleBags = Math.max(0, Math.floor(availableKg / (stdWeight || 50)));

  const [bagCount, setBagCount] = useState(String(Math.max(1, maxPossibleBags)));
  const [coilsPerBag, setCoilsPerBag] = useState('12');
  const [location, setLocation] = useState(material.location || 'KPI Godown');
  const [lotNo, setLotNo] = useState(
    `PACK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${(material.quality || 'VIP').toUpperCase().slice(0, 3)}`
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [packedBagsResult, setPackedBagsResult] = useState(null);

  const enteredBags = parseInt(bagCount, 10) || 0;
  const totalWeightToPack = parseFloat((enteredBags * stdWeight).toFixed(2));
  const remainingWeightKg = parseFloat((availableKg - totalWeightToPack).toFixed(2));
  const isOverLimit = totalWeightToPack > availableKg;

  const handlePackSubmit = async (e) => {
    e.preventDefault();
    if (enteredBags <= 0) {
      setErrorMsg('Please specify at least 1 bag to pack.');
      return;
    }
    if (isOverLimit) {
      setErrorMsg(`Insufficient loose stock. Weight to pack (${totalWeightToPack} KG) exceeds available loose stock (${availableKg} KG).`);
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const generated = await packLooseStockIntoBags({
        materialKey: material.id || material.materialKey,
        quality: material.quality || 'VIP',
        form: material.form || 'Hank',
        size: material.size || 'Standard',
        color: material.color || 'Natural',
        targetBagWeightKg: stdWeight,
        bagCount: enteredBags,
        coilsPerBag: parseInt(coilsPerBag, 10) || 12,
        location: location.trim(),
        lotNo: lotNo.trim(),
        user: currentUser
      });

      setPackedBagsResult(generated);
      if (onPackedSuccess) {
        onPackedSuccess(generated);
      }
    } catch (err) {
      console.error('Error packing loose stock into bags:', err);
      setErrorMsg(err.message || 'Failed to pack loose stock into bags.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog" style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: 'rgba(234, 88, 12, 0.2)', border: '1px solid rgba(234, 88, 12, 0.4)', color: '#ea580c' }}>
              <Package size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#ea580c', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px' }}>
                  PACKING HUB
                </span>
                <h2 className="modal-title">Pack Loose Stock into Bags</h2>
              </div>
              <p className="modal-subtitle">
                Convert loose weight into discrete standard bags with barcodes
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {packedBagsResult ? (
          <div className="modal-body" style={{ padding: '24px 20px', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              Packaging Complete!
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '440px', margin: '0 auto 20px' }}>
              Successfully packed <strong>{packedBagsResult.length} bags</strong> (
              {totalWeightToPack.toFixed(1)} KG) from loose stock of <strong>{material.quality} {material.form} {material.size}</strong>.
            </p>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '24px', textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '10px' }}>
                <span style={{ color: '#64748b' }}>Assigned Bag Numbers:</span>
                <strong style={{ color: '#0f172a' }}>
                  #{packedBagsResult[0]?.bagNumber} to #{packedBagsResult[packedBagsResult.length - 1]?.bagNumber}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '10px' }}>
                <span style={{ color: '#64748b' }}>Target Weight / Bag:</span>
                <strong style={{ color: '#0f172a' }}>{stdWeight} KG</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '10px' }}>
                <span style={{ color: '#64748b' }}>Remaining Loose Stock:</span>
                <strong style={{ color: remainingWeightKg > 0 ? '#ea580c' : '#16a34a' }}>
                  {remainingWeightKg.toFixed(1)} KG
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748b' }}>Godown Location:</span>
                <strong style={{ color: '#0f172a' }}>{location}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="mfooter-btn green-btn"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 20px' }}
                onClick={() => printMultipleBagStickers(packedBagsResult)}
              >
                <Printer size={16} /> Print Barcode Stickers ({packedBagsResult.length})
              </button>
              <button
                type="button"
                className="mfooter-btn cancel"
                style={{ padding: '9px 22px' }}
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="modal-body" onSubmit={handlePackSubmit}>
            {/* Material Summary Card */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700 }}>
                    MATERIAL SPECIFICATION
                  </span>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                    <span>{material.quality}</span>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{ color: '#475569', fontWeight: 600 }}>{material.form}</span>
                    <span style={{ color: '#cbd5e1' }}>•</span>
                    <span style={{ color: '#475569', fontWeight: 600 }}>{material.size}</span>
                  </div>
                  {material.color && (
                    <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '2px' }}>
                      Color: <strong style={{ color: '#334155' }}>{material.color}</strong>
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700 }}>
                    AVAILABLE LOOSE WEIGHT
                  </span>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ea580c', lineHeight: 1.2, marginTop: '3px' }}>
                    {availableKg.toFixed(1)} <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>KG</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid #f1f5f9', fontSize: '0.8rem', color: '#475569' }}>
                <span>Max full {stdWeight} KG bags possible:</span>
                <span style={{ fontWeight: 700, color: '#0f172a', background: '#ffffff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  {maxPossibleBags} Bags ({(maxPossibleBags * stdWeight).toFixed(1)} KG)
                </span>
              </div>
            </div>

            {errorMsg && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 12px', color: '#991b1b', fontSize: '0.82rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Inputs Grid */}
            <div className="mform-row mform-col-2">
              <div className="mform-field">
                <label className="mform-label">
                  Target Bag Weight (KG) <span className="req">*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    className="mform-input"
                    style={{ paddingRight: '80px' }}
                    value={targetBagWeightKg}
                    onChange={e => setTargetBagWeightKg(e.target.value)}
                    required
                  />
                  <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, pointerEvents: 'none' }}>
                    KG / Bag
                  </span>
                </div>
              </div>

              <div className="mform-field">
                <label className="mform-label">
                  Bags to Pack <span className="req">*</span>
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 4 }}>
                    (Max: {maxPossibleBags})
                  </span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={maxPossibleBags > 0 ? maxPossibleBags : 1}
                  className="mform-input"
                  value={bagCount}
                  onChange={e => setBagCount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="mform-row mform-col-2" style={{ marginTop: '8px' }}>
              <div className="mform-field">
                <label className="mform-label">Coils Per Bag</label>
                <input
                  type="number"
                  min="1"
                  className="mform-input"
                  value={coilsPerBag}
                  onChange={e => setCoilsPerBag(e.target.value)}
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">Target Godown / Location <span className="req">*</span></label>
                <select
                  className="mform-select"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  required
                >
                  {liveLocations.map(loc => (
                    <option key={loc.id || loc.name} value={loc.name}>
                      {loc.name} {loc.code ? `(${loc.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mform-field" style={{ marginTop: '8px' }}>
              <label className="mform-label">Lot / Packaging Reference</label>
              <input
                type="text"
                className="mform-input"
                value={lotNo}
                onChange={e => setLotNo(e.target.value)}
                placeholder="e.g. PACK-20261120-VIP"
              />
            </div>

            {/* Live Calculation Preview */}
            <div style={{ background: '#f8fafc', border: `1px solid ${isOverLimit ? '#fca5a5' : '#e2e8f0'}`, borderRadius: '10px', padding: '14px 16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Scale size={13} style={{ color: '#64748b' }} /> Packing Weight Calculation Preview
                </div>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: isOverLimit ? '#dc2626' : '#16a34a',
                  background: isOverLimit ? '#fef2f2' : '#f0fdf4',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: `1px solid ${isOverLimit ? '#fecaca' : '#bbf7d0'}`
                }}>
                  {isOverLimit ? 'Weight Exceeded' : 'Valid Allocation'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '12px', alignItems: 'center' }}>
                {/* Weight to Pack */}
                <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Weight to Pack</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: isOverLimit ? '#dc2626' : '#2563eb', margin: '2px 0' }}>
                    {totalWeightToPack.toFixed(1)} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>KG</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 500 }}>
                    <strong>{enteredBags} bags</strong> &times; {stdWeight} kg
                  </div>
                </div>

                {/* Arrow */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                  <ArrowRight size={22} />
                </div>

                {/* Remaining Loose */}
                <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Remaining Loose</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: remainingWeightKg < 0 ? '#dc2626' : (remainingWeightKg > 0 ? '#ea580c' : '#16a34a'), margin: '2px 0' }}>
                    {remainingWeightKg.toFixed(1)} <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>KG</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 500 }}>
                    Kept in loose stock
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer" style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                className="mfooter-btn cancel"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="mfooter-btn green-btn"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: isSubmitting || enteredBags <= 0 || isOverLimit ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting || enteredBags <= 0 || isOverLimit ? 0.6 : 1,
                  boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)'
                }}
                disabled={isSubmitting || enteredBags <= 0 || isOverLimit}
              >
                <Package size={15} />
                {isSubmitting ? 'Packing into Bags...' : `Confirm & Pack ${enteredBags} Bags (${totalWeightToPack.toFixed(1)} KG)`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
