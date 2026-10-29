import { useState, useEffect } from 'react';
import { X, Package, Calculator, Truck, FileText, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { 
  RM_ITEM_NAMES, 
  RM_GRADES, 
  RM_SUPPLIERS, 
  recordRmInward,
  subscribeRawMaterials 
} from '../api/inventory.api';
import { ARTICLE_TARE_DEFAULTS } from '../api/jobwork.api';
import { 
  subscribePersonnel, 
  subscribeTareStandards, 
  subscribeVendors,
  DEFAULT_PERSONNEL, 
  DEFAULT_TARE_STANDARDS 
} from '../api/directory.api';
import SearchableSelect from '../components/SearchableSelect';
import { showAlert } from '../context/CustomAlertContext';
import '../styles/Modals.css';

function today() {
  return new Date().toISOString().split('T')[0];
}

export const CORE_POLYMER_ITEMS = ['PP', 'HDPE', 'HDPP MIX', 'REPROCESSED'];
export const MATERIAL_FORMS = ['Granule', 'Powder', 'Mamri', 'Grinder'];
export const MATERIAL_COLORS = ['Natural / White', 'Red', 'Black', 'Yellow', 'Green', 'Silver'];
export const PACKAGING_OPTIONS = [
  { id: 'Woven Bag', label: 'Woven Bag', tareKey: 'bora', defaultTare: 0.200 },
  { id: 'Paper Bag', label: 'Paper Bag', tareKey: 'khaliBag', defaultTare: 0.120 },
  { id: 'LD Bag', label: 'LD Bag', tareKey: 'theli', defaultTare: 0.015 }
];
export const PACKAGING_TYPES = PACKAGING_OPTIONS.map(p => p.id);

export default function RawMaterialInwardModal({ onClose, onSaved }) {
  const [personnelList, setPersonnelList] = useState(DEFAULT_PERSONNEL);
  const [tareStandards, setTareStandards] = useState(DEFAULT_TARE_STANDARDS);
  const [liveVendors, setLiveVendors] = useState([]);
  const [liveMaterials, setLiveMaterials] = useState([]);

  useEffect(() => {
    const unsubP = subscribePersonnel((list) => {
      setPersonnelList(list);
      if (list?.length) setForm(f => f.receivedBy ? f : { ...f, receivedBy: list[0] });
    });
    const unsubT = subscribeTareStandards(setTareStandards);
    const unsubV = subscribeVendors((vendors) => {
      setLiveVendors(vendors);
      if (vendors?.length) setForm(f => f.supplierName ? f : { ...f, supplierName: vendors[0].name });
    });
    const unsubM = subscribeRawMaterials((materials) => {
      setLiveMaterials(materials);
      if (materials?.length) setForm(f => f.itemName ? f : { ...f, itemName: materials[0].name || materials[0].code, grade: materials[0].grade || '' });
    });
    return () => {
      unsubP();
      unsubT();
      unsubV();
      unsubM();
    };
  }, []);

  const getPackagingUnitTare = (pkgType, customRate) => {
    if (customRate !== '' && customRate !== undefined && customRate !== null) {
      return Number(customRate);
    }
    const match = PACKAGING_OPTIONS.find(p => p.id === pkgType) || PACKAGING_OPTIONS[0];
    if (match.tareKey && tareStandards?.[match.tareKey] !== undefined) {
      return Number(tareStandards[match.tareKey]);
    }
    return match.defaultTare;
  };

  const [form, setForm] = useState({
    grnNo: `GRN-${Math.floor(1000 + Math.random() * 9000)}`,
    challanNo: `CHL-${Math.floor(1000 + Math.random() * 9000)}`,
    date: today(),
    supplierName: '',
    itemName: 'PP',
    grade: '',
    // Change 3: 5 material attributes + Batch Number
    materialForm: 'Granule',
    materialColor: 'Natural / White',
    packaging: 'Woven Bag',
    laminationType: 'Non-Laminated',
    batchNumber: `BATCH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    challanWeight: '', // Item 8: Supplier Challan Billed Net Weight (KG)
    grossWeight: '',
    boraCount: '',
    looseStockKg: '0', // Change 6: Dual Stock (loose qty)
    customTareRate: '',
    rate: '112',
    receivedBy: DEFAULT_PERSONNEL[0],
    remarks: ''
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Item 7: Reprocessed conditional check
  const isReprocessed = form.itemName === 'REPROCESSED';

  // Auto compute tare weight and net weight from Packaging Type
  const grossWght = Number(form.grossWeight || 0);
  const boraCount = Number(form.boraCount || 0);
  const looseKg = Number(form.looseStockKg || 0);
  const unitTare = getPackagingUnitTare(form.packaging, form.customTareRate);

  const articleTareWeight = Math.round(boraCount * unitTare * 100) / 100;
  const netInwardKg = grossWght > 0 ? Math.max(0, grossWght - articleTareWeight) : 0;
  const bagStockKg = Math.max(0, netInwardKg - looseKg);
  const totalValuation = Math.round(netInwardKg * (Number(form.rate) || 0));

  // Item 8: Short Delivery calculation (Challan vs Scale Net Weight)
  const challanNetKg = Number(form.challanWeight || 0);
  const shortfallKg = challanNetKg > 0 ? Math.round((netInwardKg - challanNetKg) * 100) / 100 : 0;
  const shortDeliveryAllowanceKg = Number(tareStandards.varianceAllowanceKg || 50);
  const isShortDelivery = challanNetKg > 0 && shortfallKg < -shortDeliveryAllowanceKg;

  // Change 4: Variance Alert Calculation
  const varianceThresholdKg = Number(tareStandards.varianceAllowanceKg || 50);
  const isVarianceExceeded = grossWght > 0 && articleTareWeight > varianceThresholdKg;
  const variancePct = grossWght > 0 ? ((articleTareWeight / grossWght) * 100).toFixed(1) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (grossWght <= 0) {
      await showAlert('Please enter a valid Gross Weight.', { type: 'warning', title: 'Required Field' });
      return;
    }

    try {
      await recordRmInward({
        grnNo: form.grnNo,
        challanNo: form.challanNo,
        date: form.date,
        supplierName: form.supplierName,
        itemName: form.itemName,
        grade: isReprocessed ? (form.grade || 'Standard') : (form.grade || form.itemName),
        materialForm: form.materialForm,
        materialColor: isReprocessed ? 'Mix' : form.materialColor,
        packaging: form.packaging,
        laminationType: form.laminationType || 'Non-Laminated',
        isLaminated: form.laminationType === 'Laminated',
        batchNumber: form.batchNumber,
        challanWeight: challanNetKg,
        shortfallKg,
        isShortDelivery,
        grossWeight: grossWght,
        noOfArticles: boraCount,
        bagCount: boraCount,
        bagStockKg,
        looseStockKg: looseKg,
        articleType: form.packaging,
        articleWeight: articleTareWeight,
        netWeight: netInwardKg,
        rate: Number(form.rate || 0),
        receivedBy: form.receivedBy,
        remarks: form.remarks
      });

      await showAlert(`Raw Material Inward GRN ${form.grnNo} recorded successfully!\n• Net Inward: ${netInwardKg.toLocaleString()} KG\n• Bags: ${boraCount} bags (${bagStockKg.toLocaleString()} KG)\n• Loose: ${looseKg.toLocaleString()} KG${isShortDelivery ? `\n⚠️ SHORT DELIVERY RECORDED: Shortfall ${Math.abs(shortfallKg).toFixed(1)} KG vs Challan` : ''}\n✓ QC Check auto-scheduled with 24-hr deadline.`, {
        type: 'success',
        title: 'GRN Inward Recorded'
      });
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving RM Inward:', err);
      await showAlert(`Error recording RM Inward: ${err.message}`, { type: 'error' });
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-lg">
        {/* Dark Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon">
              <Package size={18} />
            </div>
            <div>
              <h2 className="modal-title">Raw Material Inward / Purchase Receipt (GRN)</h2>
              <p className="modal-subtitle">
                Record raw polymer receipts with weighbridge gross tare deductions from Excel Raw Material Inward.
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Section 1: Inward Receipt Headers */}
          <div className="mform-section-title">
            <FileText size={14} style={{ color: '#2563eb' }} />
            <span>1. Receipt &amp; Supplier Information</span>
          </div>

          <div className="mform-row mform-col-4">
            <div className="mform-field">
              <label className="mform-label">GRN No. <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                value={form.grnNo}
                onChange={e => set('grnNo', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Challan No.</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. INV-9042"
                value={form.challanNo}
                onChange={e => set('challanNo', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Date <span className="req">*</span></label>
              <input
                type="date"
                className="mform-input"
                value={form.date}
                onChange={e => set('date', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Chl. No. @ Party Name</label>
              <input
                type="text"
                className="mform-input"
                value={`${form.challanNo || 'CHL'} @ ${form.supplierName || 'PARTY'}`}
                readOnly
                style={{ background: '#f1f5f9', color: '#475569', fontWeight: 'bold' }}
              />
            </div>
          </div>

          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Supplier Name <span className="req">*</span></label>
              <SearchableSelect
                value={form.supplierName}
                onChange={val => set('supplierName', val)}
                options={liveVendors.map(v => ({ value: v.name || v.id, label: v.name || v.id, sublabel: v.location || '' }))}
                placeholder="-- Select Supplier --"
                searchPlaceholder="Search supplier name or city..."
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Item Name <span className="req">*</span></label>
              <SearchableSelect
                value={form.itemName}
                onChange={val => set('itemName', val)}
                options={CORE_POLYMER_ITEMS}
                placeholder="-- Select Item --"
                searchPlaceholder="Search item..."
                required
              />
            </div>

            {/* Item 7: Conditional Grade vs Color */}
            {isReprocessed ? (
              <div className="mform-field">
                <label className="mform-label">Grade (Reprocessed) <span className="req">*</span></label>
                <input
                  type="text"
                  className="mform-input"
                  placeholder="e.g. RP Grade 1, Mix Reprocess"
                  value={form.grade}
                  onChange={e => set('grade', e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="mform-field">
                <label className="mform-label">Material Color <span className="req">*</span></label>
                <SearchableSelect
                  value={form.materialColor}
                  onChange={val => set('materialColor', val)}
                  options={MATERIAL_COLORS}
                  placeholder="-- Select Color --"
                  searchPlaceholder="Search color..."
                  required
                />
              </div>
            )}
          </div>

          {/* Row 3: Material Form, Packaging, Batch Number & Challan Billed Net Wt (Item 8) */}
          <div className="mform-row mform-col-4" style={{ marginTop: '4px' }}>
            <div className="mform-field">
              <label className="mform-label">Material Form <span className="req">*</span></label>
              <SearchableSelect
                value={form.materialForm}
                onChange={val => set('materialForm', val)}
                options={MATERIAL_FORMS}
                placeholder="-- Select Form --"
                searchPlaceholder="Search form (Granule, Mamri...)..."
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Packaging Type <span className="req">*</span></label>
              <SearchableSelect
                value={form.packaging}
                onChange={val => set('packaging', val)}
                options={PACKAGING_OPTIONS.map(opt => ({ value: opt.id, label: opt.label }))}
                placeholder="-- Select Packaging --"
                searchPlaceholder="Search packaging..."
                required
              />
              {/* Radio button under packaging type for Laminated or Non-Laminated */}
              <div 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  marginTop: '6px',
                  padding: '4px 8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  width: 'fit-content'
                }}
              >
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', cursor: 'pointer', color: form.laminationType === 'Laminated' ? '#0f172a' : '#64748b', fontWeight: form.laminationType === 'Laminated' ? 600 : 500 }}>
                  <input
                    type="radio"
                    name="laminationType"
                    value="Laminated"
                    checked={form.laminationType === 'Laminated'}
                    onChange={() => set('laminationType', 'Laminated')}
                    style={{ accentColor: '#0f172a', cursor: 'pointer' }}
                  />
                  <span>Laminated</span>
                </label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', cursor: 'pointer', color: form.laminationType === 'Non-Laminated' ? '#0f172a' : '#64748b', fontWeight: form.laminationType === 'Non-Laminated' ? 600 : 500 }}>
                  <input
                    type="radio"
                    name="laminationType"
                    value="Non-Laminated"
                    checked={form.laminationType === 'Non-Laminated'}
                    onChange={() => set('laminationType', 'Non-Laminated')}
                    style={{ accentColor: '#0f172a', cursor: 'pointer' }}
                  />
                  <span>Non-Laminated</span>
                </label>
              </div>
            </div>
            <div className="mform-field">
              <label className="mform-label">Batch Number <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. BATCH-2026-001"
                value={form.batchNumber}
                onChange={e => set('batchNumber', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Challan Billed Wt (KG)</label>
              <input
                type="number"
                step="0.1"
                placeholder="Billed Net Wt (e.g. 1000)"
                className="mform-input"
                value={form.challanWeight}
                onChange={e => set('challanWeight', e.target.value)}
              />
            </div>
          </div>

          {/* Section 2: Scale Weighbridge & Tare Deductions */}
          <div className="mform-section-title" style={{ marginTop: '16px' }}>
            <Calculator size={14} style={{ color: '#ea580c' }} />
            <span>2. Weighbridge Scale, Tare Deductions &amp; Dual Stock (Bag + Loose)</span>
          </div>

          <div className="mform-row mform-col-4">
            <div className="mform-field">
              <label className="mform-label">Gross Weight (G. Wght.) <span className="req">*</span></label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 3000"
                className="mform-input"
                value={form.grossWeight}
                onChange={e => set('grossWeight', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Bag Count (Articles)</label>
              <input
                type="number"
                placeholder="e.g. 60 bags"
                className="mform-input"
                value={form.boraCount}
                onChange={e => set('boraCount', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="mform-label">Auto Tare Deduction</label>
                <span style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 600 }}>
                  {unitTare >= 1 ? `${unitTare}kg` : `${(unitTare * 1000).toFixed(0)}g`}/bag
                </span>
              </div>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: '38px'
              }}>
                <strong style={{ color: articleTareWeight > 0 ? '#dc2626' : '#64748b', fontSize: '0.9rem' }}>
                  -{articleTareWeight} KG
                </strong>
                <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
                  ({form.packaging || 'Woven Bag'})
                </span>
              </div>
            </div>
            <div className="mform-field">
              <label className="mform-label">Loose Qty (KG)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="e.g. 25.0"
                className="mform-input"
                value={form.looseStockKg}
                onChange={e => set('looseStockKg', e.target.value)}
              />
            </div>
          </div>

          {/* Change 4: Variance Alert Banner if Tare exceeds threshold */}
          {isVarianceExceeded && (
            <div style={{
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              borderRadius: '8px',
              padding: '10px 14px',
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#9f1239',
              fontSize: '0.84rem'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, color: '#e11d48' }} />
              <div>
                <strong>⚠️ High Tare / Weight Variance Alert:</strong> Total tare deduction of <strong>{articleTareWeight} KG ({variancePct}%)</strong> exceeds allowable threshold (<strong>{varianceThresholdKg} KG</strong>). Please verify the bag count and gross weight before recording.
              </div>
            </div>
          )}

          {/* Item 8: Short Delivery Warning Banner (Challan vs Net Weight) */}
          {isShortDelivery && (
            <div style={{
              background: '#fff7ed',
              border: '1.5px solid #fdba74',
              borderRadius: '8px',
              padding: '10px 14px',
              marginTop: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#9a3412',
              fontSize: '0.84rem'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, color: '#ea580c' }} />
              <div>
                <strong>⚠️ Short Delivery Warning (ઓછી આવક ચેતવણી):</strong> Supplier challan billed <strong>{challanNetKg.toLocaleString()} KG</strong>, but weighbridge received <strong>{netInwardKg.toLocaleString()} KG</strong> (Shortfall: <strong>{Math.abs(shortfallKg).toFixed(1)} KG</strong>).
                <div style={{ fontSize: '0.76rem', color: '#c2410c', marginTop: '2px' }}>
                  Shortfall exceeds allowable threshold ({shortDeliveryAllowanceKg} KG). Please confirm invoice deduction or contact vendor before sign-off.
                </div>
              </div>
            </div>
          )}

          {/* Live Calculation Banner */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '12px 16px',
            marginTop: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem'
          }}>
            <div>
              <span style={{ color: '#64748b' }}>Tare Weight: </span>
              <strong style={{ color: '#0f172a' }}>{articleTareWeight} KG</strong>
              <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
              <span style={{ color: '#64748b' }}>Stock Division: </span>
              <strong style={{ color: '#16a34a' }}>{boraCount} Bags ({bagStockKg.toLocaleString()} KG)</strong>
              <span style={{ color: '#64748b' }}> + </span>
              <strong style={{ color: '#ea580c' }}>{looseKg.toLocaleString()} KG Loose</strong>
              {challanNetKg > 0 && (
                <>
                  <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
                  <span style={{ color: '#64748b' }}>Challan Billed: </span>
                  <strong style={{ color: isShortDelivery ? '#ea580c' : '#334155' }}>
                    {challanNetKg.toLocaleString()} KG ({shortfallKg >= 0 ? `+${shortfallKg}` : shortfallKg} KG)
                  </strong>
                </>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#64748b' }}>Net Weight: </span>
              <span style={{ color: '#16a34a', fontWeight: '800', fontSize: '1.05rem', marginLeft: '6px' }}>
                {netInwardKg.toLocaleString()} KG
              </span>
              <span style={{ marginLeft: '12px', color: '#2563eb', fontWeight: '700' }}>
                (₹{totalValuation.toLocaleString()})
              </span>
            </div>
          </div>

          {/* Section 3: Personnel & Remarks */}
          <div className="mform-section-title" style={{ marginTop: '16px' }}>
            <Truck size={14} style={{ color: '#16a34a' }} />
            <span>3. Material Valuation &amp; Quality Signatory</span>
          </div>

          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Purchase Rate (₹ / KG)</label>
              <input
                type="number"
                step="0.1"
                className="mform-input"
                value={form.rate}
                onChange={e => set('rate', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Received By</label>
              <SearchableSelect
                value={form.receivedBy}
                onChange={val => set('receivedBy', val)}
                options={personnelList}
                placeholder="-- Select Signatory --"
                searchPlaceholder="Search supervisor..."
              />
            </div>
          </div>

          <div className="mform-field" style={{ marginTop: '8px' }}>
            <label className="mform-label">Remarks</label>
            <input
              type="text"
              className="mform-input"
              placeholder="e.g. Unloaded into Silo A, quality test passed"
              value={form.remarks}
              onChange={e => set('remarks', e.target.value)}
            />
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm" style={{ background: '#16a34a', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} /> Record Inward (GRN)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
