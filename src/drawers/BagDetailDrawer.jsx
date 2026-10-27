import { useState, useEffect } from 'react';
import { 
  X, Scale, Package, Calendar, MapPin, Tag, 
  Layers, CheckCircle2, Edit3, Check, Printer, FileText, ArrowRight 
} from 'lucide-react';
import { subscribeLocations } from '../api/locations.api';
import { printSingleBagSticker } from '../utils/stickerPdf';
import '../styles/MaterialDetailDrawer.css';

export default function BagDetailDrawer({ bag, isOpen, onClose, onUpdateBagWeight, onUpdateBagLocation }) {
  if (!isOpen || !bag) return null;

  const [liveLocations, setLiveLocations] = useState([]);

  useEffect(() => {
    const unsub = subscribeLocations(setLiveLocations);
    return () => unsub();
  }, []);

  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const [newWeight, setNewWeight] = useState(String(bag.actualWeightKg || bag.standardWeightKg || 50));
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState(bag.location || 'KPI Godown');

  const stdWt = Number(bag.standardWeightKg) || 50;
  const actWt = Number(bag.actualWeightKg) || stdWt;
  const variance = actWt - stdWt;
  const isFixed = bag.stockType === 'FIXED';

  const handleSaveWeight = () => {
    const val = parseFloat(newWeight);
    if (!isNaN(val) && val > 0 && onUpdateBagWeight) {
      onUpdateBagWeight(bag, val);
    }
    setIsEditingWeight(false);
  };

  const handleSaveLocation = () => {
    if (newLocation && onUpdateBagLocation) {
      onUpdateBagLocation(bag, newLocation);
    }
    setIsEditingLocation(false);
  };

  return (
    <div className="mdrawer-overlay" onClick={onClose}>
      <div className="mdrawer-content" onClick={e => e.stopPropagation()} style={{ width: '560px' }}>
        {/* Dark Header */}
        <div className="mdrawer-header" style={{ background: '#0f172a', padding: '20px 24px' }}>
          <div className="mdrawer-header-top">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span 
                style={{ 
                  background: '#2563eb', 
                  color: '#ffffff', 
                  fontSize: '0.72rem', 
                  fontWeight: 800, 
                  padding: '3px 8px', 
                  borderRadius: '4px',
                  letterSpacing: '0.04em' 
                }}
              >
                BAG SERIAL REGISTER
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                Ref: {bag.inwardSlipNo || 'SLIP-3001'}
              </span>
            </div>
            <button className="mdrawer-close-btn" onClick={onClose} title="Close Drawer">
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            <h2 className="mdrawer-title" style={{ margin: 0, fontSize: '1.45rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Bag #{bag.bagNumber}</span>
              <span 
                style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  padding: '2px 8px', 
                  borderRadius: '12px',
                  background: isFixed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                  color: isFixed ? '#4ade80' : '#fbbf24',
                  border: isFixed ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid rgba(245, 158, 11, 0.4)'
                }}
              >
                {isFixed ? 'FIXED (50 KG STD)' : 'LOOSE STOCK'}
              </span>
            </h2>

            {bag.status === 'DISPATCHED' ? (
              <span 
                style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  color: '#475569', 
                  background: '#f1f5f9', 
                  border: '1px solid #cbd5e1',
                  padding: '3px 10px', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                🚚 DISPATCHED {bag.dispatchChallanNo ? `(${bag.dispatchChallanNo})` : ''}
              </span>
            ) : (
              <span 
                style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  color: '#22c55e', 
                  background: 'rgba(34, 197, 94, 0.15)', 
                  padding: '3px 10px', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckCircle2 size={12} /> {bag.status || 'AVAILABLE'}
              </span>
            )}
          </div>

          <div className="mdrawer-sub" style={{ marginTop: '8px', color: '#94a3b8', fontSize: '0.82rem' }}>
            {bag.productName || 'Fishing Twine'} • Quality: <strong style={{ color: '#ffffff' }}>{bag.quality || 'Anchor'}</strong> • Form: <strong style={{ color: '#ffffff' }}>{bag.form || 'Hank'}</strong> • Size: <strong style={{ color: '#ffffff' }}>{bag.size || '3×3'}</strong>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="mdrawer-body" style={{ padding: '20px 24px', overflowY: 'auto' }}>
          
          {/* 4 Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '20px' }}>
            {/* Scale Actual Weight */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>ACTUAL SCALE WEIGHT</span>
                <Scale size={15} style={{ color: '#2563eb' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                {isEditingWeight ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input 
                      type="number" 
                      step="0.1" 
                      value={newWeight} 
                      onChange={e => setNewWeight(e.target.value)}
                      style={{ width: '90px', padding: '4px 8px', fontSize: '1rem', fontWeight: 700, border: '1px solid #2563eb', borderRadius: '4px' }}
                      autoFocus
                    />
                    <button 
                      type="button" 
                      onClick={handleSaveWeight}
                      style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', padding: '5px 8px', cursor: 'pointer' }}
                    >
                      <Check size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{actWt.toFixed(1)}</span>
                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>KG</span>
                    <button 
                      type="button" 
                      onClick={() => setIsEditingWeight(true)}
                      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px 4px', marginLeft: 'auto' }}
                      title="Adjust Scale Weight"
                    >
                      <Edit3 size={13} />
                    </button>
                  </>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Recorded on factory digital weighing scale
              </div>
            </div>

            {/* Standard Reference Weight */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>STANDARD WEIGHT</span>
                <Package size={15} style={{ color: '#64748b' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{stdWt.toFixed(1)}</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>KG</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Standard full bag benchmark
              </div>
            </div>

            {/* Variance */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>SCALE VARIANCE (DIFF)</span>
                <span 
                  style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: 700, 
                    color: variance >= 0 ? '#16a34a' : '#dc2626',
                    background: variance >= 0 ? '#dcfce7' : '#fee2e2',
                    padding: '1px 6px',
                    borderRadius: '4px'
                  }}
                >
                  {variance >= 0 ? 'OVER' : 'UNDER'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                <span 
                  style={{ 
                    fontSize: '1.4rem', 
                    fontWeight: 800, 
                    color: variance >= 0 ? '#16a34a' : '#dc2626' 
                  }}
                >
                  {variance >= 0 ? `+${variance.toFixed(1)}` : variance.toFixed(1)}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>KG</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Actual Weight minus 50.0 KG Standard
              </div>
            </div>

            {/* Coils Count */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>COILS IN BAG</span>
                <Layers size={15} style={{ color: '#8b5cf6' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>{bag.coilCount || 12}</span>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Coils</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                Individual coils bundled inside this bag
              </div>
            </div>
          </div>

          {/* Product Specifications Section */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px', background: '#ffffff' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Tag size={14} style={{ color: '#2563eb' }} />
              PRODUCT SPECIFICATIONS
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Quality / Brand</span>
                <strong style={{ color: '#0f172a' }}>{bag.quality || 'Anchor'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Form / Package Type</span>
                <strong style={{ color: '#0f172a' }}>{bag.form || 'Hank'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Size / Ply</span>
                <strong style={{ color: '#0f172a' }}>{bag.size || '3×3'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Product Category</span>
                <strong style={{ color: '#0f172a' }}>{bag.productName || 'Fishing Twine'}</strong>
              </div>
            </div>
          </div>

          {/* Traceability & Manufacturing Origin */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px', background: '#ffffff' }}>
            <h3 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} style={{ color: '#2563eb' }} />
              MANUFACTURING &amp; INWARD TRACEABILITY
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.82rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Inward Slip #</span>
                <span style={{ fontWeight: 700, color: '#2563eb' }}>{bag.inwardSlipNo || 'SLIP-3001'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Job Work Order #</span>
                <strong style={{ color: '#0f172a' }}>{bag.jobWorkNo || 'JW-2026-1044'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Lot / Series Group</span>
                <span style={{ color: '#334155', fontWeight: 600 }}>{bag.lotGroup || 'LOT-30MAR-01'}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block' }}>Inward Date</span>
                <span style={{ color: '#334155' }}>{bag.receivedAt || '2026-03-30'}</span>
              </div>
            </div>
          </div>

          {/* Godown & Physical Location */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '16px', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} style={{ color: '#2563eb' }} />
                WAREHOUSE GODOWN &amp; STORAGE BAY
              </h3>
              {!isEditingLocation && (
                <button 
                  type="button" 
                  onClick={() => setIsEditingLocation(true)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  Change Godown
                </button>
              )}
            </div>

            {isEditingLocation ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <select 
                  className="mform-select" 
                  value={newLocation} 
                  onChange={e => setNewLocation(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                >
                  {liveLocations.map(loc => (
                    <option key={loc.id || loc.name} value={loc.name}>
                      {loc.name} {loc.type ? `(${loc.type})` : ''}
                    </option>
                  ))}
                </select>
                <button 
                  type="button"
                  onClick={handleSaveLocation}
                  style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Save
                </button>
                <button 
                  type="button"
                  onClick={() => setIsEditingLocation(false)}
                  style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#16a34a' }} />
                <div>
                  <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>{bag.location || 'KPI Godown'}</strong>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                    Active stock location for customer dispatch allocation
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
            <button 
              type="button" 
              className="inv-btn-ghost" 
              style={{ flex: 1, justifyContent: 'center', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
              onClick={() => printSingleBagSticker(bag)}
            >
              <Printer size={15} /> Print Bag Sticker (PDF)
            </button>
            <button 
              type="button" 
              className="inv-btn-primary" 
              style={{ flex: 1, justifyContent: 'center', background: '#0f172a', color: '#fff' }}
              onClick={onClose}
            >
              Done
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
