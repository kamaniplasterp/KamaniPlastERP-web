import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Package, Scale, Layers, Printer, CheckCircle2, AlertTriangle, 
  ArrowRight, Plus, Trash2, Sliders, Hash, RotateCcw, Check
} from 'lucide-react';
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

  // Packing Mode: 'even' | 'remainder' | 'uneven'
  const [packMode, setPackMode] = useState('even');

  // Mode 1: Even Weight State
  const [targetBagWeightKg, setTargetBagWeightKg] = useState('50.0');
  const stdWeight = parseFloat(targetBagWeightKg) || 50.0;
  const maxPossibleBags = Math.max(0, Math.floor(availableKg / (stdWeight || 50)));
  const [bagCount, setBagCount] = useState(String(Math.max(1, maxPossibleBags)));

  // Mode 2: Remainder / Tail Bag State
  const [includeRemainderBag, setIncludeRemainderBag] = useState(true);

  // Mode 3: Uneven / Variable Weights State
  // List of weights [ { id: '1', weight: '48.5' }, { id: '2', weight: '51.2' } ]
  const [customBags, setCustomBags] = useState([
    { id: '1', weight: '50.0' },
    { id: '2', weight: '50.0' }
  ]);
  const [bulkWeightInput, setBulkWeightInput] = useState('');

  // Common Metadata
  const [coilsPerBag, setCoilsPerBag] = useState('12');
  const [location, setLocation] = useState(material.location || 'KPI Godown');
  const [lotNo, setLotNo] = useState(
    `PACK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${(material.quality || 'VIP').toUpperCase().slice(0, 3)}`
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [packedBagsResult, setPackedBagsResult] = useState(null);

  // Calculations based on active mode
  const { calculatedBagWeights, totalWeightToPack, totalBagCount, remainderKg } = useMemo(() => {
    if (packMode === 'even') {
      const count = parseInt(bagCount, 10) || 0;
      const weights = Array(count).fill(stdWeight);
      const total = parseFloat((count * stdWeight).toFixed(2));
      return {
        calculatedBagWeights: weights,
        totalWeightToPack: total,
        totalBagCount: count,
        remainderKg: Math.max(0, parseFloat((availableKg - total).toFixed(2)))
      };
    } else if (packMode === 'remainder') {
      const fullCount = parseInt(bagCount, 10) || 0;
      const fullTotal = parseFloat((fullCount * stdWeight).toFixed(2));
      const rawRemainder = parseFloat((availableKg - fullTotal).toFixed(2));
      const hasValidRemainder = includeRemainderBag && rawRemainder > 0;
      const weights = [...Array(fullCount).fill(stdWeight)];
      if (hasValidRemainder) {
        weights.push(rawRemainder);
      }
      const total = parseFloat(weights.reduce((s, w) => s + w, 0).toFixed(2));
      return {
        calculatedBagWeights: weights,
        totalWeightToPack: total,
        totalBagCount: weights.length,
        remainderKg: rawRemainder
      };
    } else {
      // 'uneven'
      const weights = customBags.map(b => parseFloat(b.weight) || 0).filter(w => w > 0);
      const total = parseFloat(weights.reduce((s, w) => s + w, 0).toFixed(2));
      return {
        calculatedBagWeights: weights,
        totalWeightToPack: total,
        totalBagCount: weights.length,
        remainderKg: Math.max(0, parseFloat((availableKg - total).toFixed(2)))
      };
    }
  }, [packMode, bagCount, stdWeight, availableKg, includeRemainderBag, customBags]);

  const remainingWeightKg = parseFloat((availableKg - totalWeightToPack).toFixed(2));
  const isOverLimit = totalWeightToPack > availableKg;

  // Custom bag list management
  const handleAddBagRow = () => {
    setCustomBags(prev => [
      ...prev,
      { id: String(Date.now() + Math.random()), weight: String(stdWeight) }
    ]);
  };

  const handleUpdateBagWeight = (id, val) => {
    setCustomBags(prev => prev.map(b => b.id === id ? { ...b, weight: val } : b));
  };

  const handleRemoveBagRow = (id) => {
    if (customBags.length <= 1) return;
    setCustomBags(prev => prev.filter(b => b.id !== id));
  };

  const handleApplyBulkWeights = () => {
    if (!bulkWeightInput.trim()) return;
    const parsed = bulkWeightInput
      .split(/[\s,]+/)
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n) && n > 0);

    if (parsed.length > 0) {
      setCustomBags(parsed.map((w, idx) => ({ id: `${Date.now()}_${idx}`, weight: String(w) })));
      setBulkWeightInput('');
    }
  };

  const handlePackSubmit = async (e) => {
    e.preventDefault();
    if (totalBagCount <= 0 || calculatedBagWeights.length === 0) {
      setErrorMsg('Please specify at least 1 bag with a valid weight to pack.');
      return;
    }
    if (isOverLimit) {
      setErrorMsg(`Insufficient loose stock. Weight to pack (${totalWeightToPack.toFixed(1)} KG) exceeds available loose stock (${availableKg.toFixed(1)} KG).`);
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
        bagWeights: calculatedBagWeights,
        bagCount: totalBagCount,
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
      <div className="modal-dialog" style={{ maxWidth: '680px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header-dark" style={{ flexShrink: 0 }}>
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
                Pack into even standard weights or uneven floor scale bags with individual barcodes
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        {packedBagsResult ? (
          <div className="modal-body" style={{ padding: '24px 20px', textAlign: 'center', overflowY: 'auto' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <CheckCircle2 size={36} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
              Packaging Complete!
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '480px', margin: '0 auto 20px' }}>
              Successfully created <strong>{packedBagsResult.length} bags</strong> (
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
                <span style={{ color: '#64748b' }}>Packing Mode:</span>
                <strong style={{ color: '#0f172a', textTransform: 'capitalize' }}>
                  {packMode === 'even' ? 'Standard Even Weight' : packMode === 'remainder' ? 'Standard + Remainder Bag' : 'Uneven Scale Weights'}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '10px' }}>
                <span style={{ color: '#64748b' }}>Total Weight Packed:</span>
                <strong style={{ color: '#2563eb' }}>{totalWeightToPack.toFixed(1)} KG</strong>
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
          <form className="modal-body" onSubmit={handlePackSubmit} style={{ overflowY: 'auto', flex: 1, padding: '20px 24px' }}>
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
            </div>

            {/* Packing Mode Switcher */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>
                SELECT PACKING WEIGHT METHOD
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setPackMode('even')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: packMode === 'even' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: packMode === 'even' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: packMode === 'even' ? '#1d4ed8' : '#1e293b' }}>
                    Even Weight
                  </div>
                  <div style={{ fontSize: '0.7rem', color: packMode === 'even' ? '#3b82f6' : '#64748b', marginTop: '2px' }}>
                    Standard bags (e.g. 50 kg)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPackMode('remainder')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: packMode === 'remainder' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: packMode === 'remainder' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: packMode === 'remainder' ? '#1d4ed8' : '#1e293b' }}>
                    Even + Remainder
                  </div>
                  <div style={{ fontSize: '0.7rem', color: packMode === 'remainder' ? '#3b82f6' : '#64748b', marginTop: '2px' }}>
                    Standard + 1 tail bag
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPackMode('uneven')}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: packMode === 'uneven' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                    background: packMode === 'uneven' ? '#eff6ff' : '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: packMode === 'uneven' ? '#1d4ed8' : '#1e293b' }}>
                    Uneven Scale Weights
                  </div>
                  <div style={{ fontSize: '0.7rem', color: packMode === 'uneven' ? '#3b82f6' : '#64748b', marginTop: '2px' }}>
                    Custom weights per bag
                  </div>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '10px 12px', color: '#991b1b', fontSize: '0.82rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Mode 1 & 2 Inputs: Even / Remainder */}
            {(packMode === 'even' || packMode === 'remainder') && (
              <div className="mform-row mform-col-2">
                <div className="mform-field">
                  <label className="mform-label">
                    Target Standard Bag Weight (KG) <span className="req">*</span>
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
                    Full Standard Bags to Pack <span className="req">*</span>
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 4 }}>
                      (Max full: {maxPossibleBags})
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
            )}

            {/* Mode 2: Remainder Tail Bag Checkbox Banner */}
            {packMode === 'remainder' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={includeRemainderBag}
                    onChange={e => setIncludeRemainderBag(e.target.checked)}
                    style={{ marginTop: '3px', width: '16px', height: '16px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#92400e' }}>
                      Pack leftover loose weight as a final uneven "Tail Bag"
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#b45309', marginTop: '2px' }}>
                      {remainderKg > 0 ? (
                        <span>
                          Will pack <strong>{bagCount} standard bags</strong> ({stdWeight} KG each) + <strong>1 remainder bag</strong> of <strong>{remainderKg.toFixed(1)} KG</strong> (Total {totalBagCount} bags, {totalWeightToPack.toFixed(1)} KG).
                        </span>
                      ) : (
                        <span>No loose weight will remain.</span>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            )}

            {/* Mode 3: Uneven / Variable Scale Weights Table */}
            {packMode === 'uneven' && (
              <div style={{ marginBottom: '16px' }}>
                {/* Bulk Paste Box */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                    QUICK BULK PASTE (SCALE WEIGHTS)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="mform-input"
                      placeholder="e.g. 48.5, 51.2, 49.8, 52.0, 50.1"
                      value={bulkWeightInput}
                      onChange={e => setBulkWeightInput(e.target.value)}
                      style={{ fontSize: '0.8rem' }}
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulkWeights}
                      style={{
                        padding: '6px 14px',
                        background: '#0f172a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Parse Weights
                    </button>
                  </div>
                </div>

                {/* Individual Bag Rows */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                    INDIVIDUAL BAG SCALE WEIGHTS ({customBags.length} Bags)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddBagRow}
                    style={{
                      background: '#eff6ff',
                      color: '#2563eb',
                      border: '1px solid #bfdbfe',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Plus size={13} /> Add Bag Row
                  </button>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '180px', overflowY: 'auto', background: '#ffffff' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, borderBottom: '1px solid #e2e8f0', zIndex: 1 }}>
                      <tr>
                        <th style={{ padding: '6px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700, width: '90px' }}>BAG #</th>
                        <th style={{ padding: '6px 12px', textAlign: 'left', color: '#64748b', fontWeight: 700 }}>SCALE NET WEIGHT (KG)</th>
                        <th style={{ padding: '6px 12px', textAlign: 'center', width: '50px' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customBags.map((bag, idx) => (
                        <tr key={bag.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 700, color: '#0f172a' }}>
                            Bag #{idx + 1}
                          </td>
                          <td style={{ padding: '6px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={bag.weight}
                                onChange={e => handleUpdateBagWeight(bag.id, e.target.value)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '5px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  width: '120px'
                                }}
                                required
                              />
                              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>KG</span>
                            </div>
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveBagRow(bag.id)}
                              disabled={customBags.length <= 1}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: customBags.length <= 1 ? '#cbd5e1' : '#dc2626',
                                cursor: customBags.length <= 1 ? 'not-allowed' : 'pointer',
                                padding: '2px'
                              }}
                              title="Remove bag"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Common Metadata Fields */}
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

            {/* Live Calculation Preview Banner */}
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
                    <strong>{totalBagCount} bags</strong> ({packMode === 'even' ? `${stdWeight} kg each` : 'custom weights'})
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
                  cursor: isSubmitting || totalBagCount <= 0 || isOverLimit ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting || totalBagCount <= 0 || isOverLimit ? 0.6 : 1,
                  boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)'
                }}
                disabled={isSubmitting || totalBagCount <= 0 || isOverLimit}
              >
                <Package size={15} />
                {isSubmitting ? 'Packing into Bags...' : `Confirm & Pack ${totalBagCount} Bags (${totalWeightToPack.toFixed(1)} KG)`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
