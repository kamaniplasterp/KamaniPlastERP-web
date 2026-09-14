import { useState, useEffect } from 'react';
import { X, Calculator, Truck, FileText, Layers, UserCheck } from 'lucide-react';
import { createJobWork, ARTICLE_TARE_DEFAULTS, JW_PROCESS_LIST, AUTHORIZED_PERSONS } from '../api/jobwork.api';
import { subscribeRawMaterials } from '../api/inventory.api';
import { subscribeVendors } from '../api/directory.api';
import '../styles/Modals.css';

function today() {
  return new Date().toISOString().split('T')[0];
}
function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + Number(n || 0));
  return d.toISOString().split('T')[0];
}

export default function NewJobWorkModal({ onClose, onSave }) {
  const [liveMaterials, setLiveMaterials] = useState([]);
  const [liveVendors, setLiveVendors] = useState([]);

  useEffect(() => {
    const unsubRm = subscribeRawMaterials(setLiveMaterials);
    const unsubVe = subscribeVendors(setLiveVendors);
    return () => {
      unsubRm();
      unsubVe();
    };
  }, []);

  const [form, setForm] = useState({
    // Challan Headers
    challanSeries: 'JW-2026-',
    subChalNo: '1',
    workOrder: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
    department: 'Job Work Extrusion',
    challanDate: today(),
    durationDays: '5',
    expectedReturn: addDays(5),

    // Party & Material
    jwParty: '',
    rawMaterial: '',
    grade: '',
    processType: JW_PROCESS_LIST[0],

    // Weight & Packaging
    grossWeight: '',
    boraCount: '',
    articleType: 'BORA',
    customTareRate: '',
    bLossPct: '0',

    // Sample & Pieces
    pieces: '',
    samplePcs: '10',
    sampleWeight: '0.5',

    // Financials
    processingRate: '',
    freight: '',

    // Logistics & Administration
    batchNo: `BATCH-2026-${Math.floor(Math.random() * 900 + 100)}`,
    vehicleNo: '',
    stockSource: 'Factory Silo Bay A-1',
    issuedBy: AUTHORIZED_PERSONS[0],
    approvedBy: 'FINAL APPROVED',
    remarks: ''
  });

  const displayVendors = liveVendors.length > 0 ? liveVendors : [
    { id: 'V1', name: 'GALAXY.ENTERPRISE', location: 'Morbi, Gujarat', gst: '24AABCS9912K1Z4', rate: 17.5 },
    { id: 'V2', name: 'RAMJIBHAI', location: 'Rajkot, Gujarat', gst: '24AABCP1234K1Z5', rate: 17.0 },
    { id: 'V3', name: 'HIMMATBHAI', location: 'Jamnagar, Gujarat', gst: '24AABCK5678K1Z6', rate: 17.0 },
    { id: 'V4', name: 'CHIRIMIRIPLASTICS', location: 'Dhoraji, Gujarat', gst: '24AABCC1111K1Z7', rate: 16.5 }
  ];

  const selMaterial = liveMaterials.find(m => m.id === form.rawMaterial);
  const selParty = displayVendors.find(p => p.id === form.jwParty);

  // Calculations
  const grossWght = parseFloat(form.grossWeight) || 0;
  const boraCnt = parseFloat(form.boraCount) || 0;
  const tareRate = form.articleType === 'CUSTOM'
    ? (parseFloat(form.customTareRate) || 0)
    : (ARTICLE_TARE_DEFAULTS[form.articleType] !== undefined ? ARTICLE_TARE_DEFAULTS[form.articleType] : 0.200);
  
  const articleTareWeight = boraCnt * tareRate;
  const netWeight = grossWght > 0 ? Math.max(0, grossWght - articleTareWeight) : 0;
  
  const bLossPercentage = parseFloat(form.bLossPct) || 0;
  const bLossKg = netWeight * (bLossPercentage / 100);
  const netOutwardExpectedKg = Math.max(0, netWeight - bLossKg);

  const currentRate = form.processingRate !== '' ? parseFloat(form.processingRate) || 0 : (selParty?.rate ? Number(selParty.rate) : 17.5);
  const totalPayable = netWeight * currentRate + (parseFloat(form.freight) || 0);

  const set = (key, val) => {
    setForm(f => {
      const updated = { ...f, [key]: val };
      if (key === 'durationDays') {
        updated.expectedReturn = addDays(val);
      }
      return updated;
    });
  };

  // Close on Escape
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const handlePartySelect = (partyId) => {
    const p = displayVendors.find(v => v.id === partyId);
    setForm(f => ({
      ...f,
      jwParty: partyId,
      processingRate: p && p.rate !== undefined ? String(p.rate) : f.processingRate
    }));
  };

  const handleMaterialSelect = (matId) => {
    const m = liveMaterials.find(item => item.id === matId);
    setForm(f => ({
      ...f,
      rawMaterial: matId,
      grade: m?.grade || f.grade
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (netWeight <= 0 && grossWght <= 0) {
      alert('Please enter a valid Gross Weight greater than 0 KG.');
      return;
    }
    const availInFactory = Number(selMaterial?.availFactory) || 0;
    if (selMaterial && netWeight > availInFactory) {
      alert(`Cannot issue ${netWeight.toLocaleString()} KG! Factory stock only has ${availInFactory.toLocaleString()} KG available.`);
      return;
    }

    const vendorLabel = selParty ? (selParty.name || selParty.label || 'Job Worker') : 'Job Worker';
    const matLabel = selMaterial ? (selMaterial.name || selMaterial.label || 'Raw Material') : 'Raw Material';
    const finalRate = Number(form.processingRate) || (selParty?.rate ? Number(selParty.rate) : currentRate);

    try {
      const autoNum = Math.floor(1000 + Math.random() * 9000);
      const payload = {
        jwNo: `${form.challanSeries}${autoNum}`,
        chNo: String(autoNum),
        challanSeries: form.challanSeries,
        subChalNo: form.subChalNo || '1',
        workOrder: form.workOrder,
        department: form.department,
        vendor: vendorLabel,
        vendorId: form.jwParty || null,
        rawMat: matLabel,
        grade: form.grade || selMaterial?.grade || '',
        rawMaterialId: form.rawMaterial || null,
        process: form.processType,
        grossWeight: grossWght,
        boraCount: boraCnt,
        articleType: form.articleType,
        articleWeight: articleTareWeight,
        sentQtyKg: netWeight,
        bLossPct: bLossPercentage,
        bLossKg: bLossKg,
        netOutwardKg: netOutwardExpectedKg,
        expectedFg: `${netOutwardExpectedKg.toFixed(2)} KG`,
        pieces: Number(form.pieces || 0),
        samplePcs: Number(form.samplePcs || 0),
        sampleWeight: Number(form.sampleWeight || 0),
        charges: finalRate,
        ratePerKg: finalRate,
        totalCharges: totalPayable,
        date: form.challanDate || today(),
        durationDays: Number(form.durationDays || 5),
        expectedReturn: form.expectedReturn || '',
        batch: form.batchNo || '',
        vehicleNo: form.vehicleNo || '',
        stockSource: form.stockSource || 'Factory Silo Bay A-1',
        issuedBy: form.issuedBy || 'SURESHBHAI',
        approvedBy: form.approvedBy || 'FINAL APPROVED',
        remarks: form.remarks || ''
      };

      if (onSave) {
        await onSave(payload);
      } else {
        await createJobWork(payload);
      }
      alert(`Job Work Outward Challan ${payload.jwNo} generated successfully for ${vendorLabel} (${netWeight.toFixed(2)} KG)!`);
    } catch (err) {
      console.error('Error creating job work:', err);
      alert('Failed to issue Job Work Challan. Please check connection.');
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-xl" style={{ maxWidth: '960px', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="modal-header-dark">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: '#3b82f6', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px' }}>
                RULE 55 CGST
              </span>
              <h2 className="modal-title">Job Work Outward Challan Entry</h2>
            </div>
            <p className="modal-subtitle">Generate statutory outward delivery challan with Gross/Net weights, Tare, B.Loss &amp; Sample pieces</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Section 1: Challan & Classification */}
          <div className="mform-section">
            <div className="mform-section-title">
              <FileText size={15} className="msec-icon" />
              CHALLAN &amp; PROCESS CLASSIFICATION
            </div>
            <div className="mform-row mform-col-4">
              <div className="mform-field">
                <label className="mform-label">Challan Series</label>
                <select className="mform-select" value={form.challanSeries} onChange={e => set('challanSeries', e.target.value)}>
                  <option value="JW-2026-">JW-2026- (Standard)</option>
                  <option value="CH-">CH- (Direct Challan)</option>
                  <option value="EXT-">EXT- (Extrusion Issue)</option>
                </select>
              </div>
              <div className="mform-field">
                <label className="mform-label">Sub Challan No.</label>
                <input type="text" className="mform-input" value={form.subChalNo} onChange={e => set('subChalNo', e.target.value)} placeholder="1" />
              </div>
              <div className="mform-field">
                <label className="mform-label">Work Order No.</label>
                <input type="text" className="mform-input" value={form.workOrder} onChange={e => set('workOrder', e.target.value)} required />
              </div>
              <div className="mform-field">
                <label className="mform-label">Department</label>
                <select className="mform-select" value={form.department} onChange={e => set('department', e.target.value)}>
                  <option value="Job Work Extrusion">Job Work Extrusion</option>
                  <option value="Tape Spinning">Tape Spinning</option>
                  <option value="Twisting & Winding">Twisting &amp; Winding</option>
                  <option value="Rope Laying">Rope Laying</option>
                </select>
              </div>
            </div>

            <div className="mform-row mform-col-3" style={{ marginTop: '10px' }}>
              <div className="mform-field">
                <label className="mform-label">Challan Date <span className="req">*</span></label>
                <input type="date" className="mform-input" value={form.challanDate} onChange={e => set('challanDate', e.target.value)} required />
              </div>
              <div className="mform-field">
                <label className="mform-label">Duration (Days)</label>
                <input type="number" className="mform-input" min="1" max="90" value={form.durationDays} onChange={e => set('durationDays', e.target.value)} />
              </div>
              <div className="mform-field">
                <label className="mform-label">Expected Return Date</label>
                <input type="date" className="mform-input" value={form.expectedReturn} onChange={e => set('expectedReturn', e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Section 2: Party & Material Details */}
          <div className="mform-section">
            <div className="mform-section-title">
              <Layers size={15} className="msec-icon" />
              VENDOR &amp; RAW MATERIAL SPECIFICATIONS
            </div>
            <div className="mform-row mform-col-2">
              <div className="mform-field">
                <label className="mform-label">Job Work Party (Vendor) <span className="req">*</span></label>
                <select className="mform-select" value={form.jwParty} onChange={e => handlePartySelect(e.target.value)} required>
                  <option value="">-- Select Vendor / Job Worker --</option>
                  {displayVendors.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name || 'Vendor'} ({p.location || 'Gujarat'})
                    </option>
                  ))}
                </select>
                {selParty && (
                  <div className="mform-hint">
                    Location: {selParty.location || 'Gujarat'} • GST: {selParty.gst || 'N/A'}
                  </div>
                )}
              </div>

              <div className="mform-field">
                <label className="mform-label">Select Raw Material <span className="req">*</span></label>
                <select className="mform-select" value={form.rawMaterial} onChange={e => handleMaterialSelect(e.target.value)} required>
                  <option value="">-- Select Polymer Material --</option>
                  {liveMaterials.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name || 'Raw Material'} ({m.grade || m.code || m.id}) - Stock: {m.availFactory || 0} KG
                    </option>
                  ))}
                </select>
                {selMaterial && (
                  <div className="mform-hint">
                    Grade: <span className="hint-green">{selMaterial.grade || 'Standard'}</span> • Available: <span className="hint-green">{selMaterial.availFactory || 0} KG</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mform-row mform-col-2" style={{ marginTop: '10px' }}>
              <div className="mform-field">
                <label className="mform-label">Process Name (Matching Master) <span className="req">*</span></label>
                <select className="mform-select" value={form.processType} onChange={e => set('processType', e.target.value)} required>
                  {JW_PROCESS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="mform-field">
                <label className="mform-label">Material Grade Spec</label>
                <input type="text" className="mform-input" placeholder="e.g. 8MFI, HD, HMEL OG, MB6501, ABC12" value={form.grade} onChange={e => set('grade', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section 3: Weight, Packaging Tare & B.Loss Matrix */}
          <div className="mform-section" style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div className="mform-section-title" style={{ color: '#0f172a' }}>
              <Calculator size={15} className="msec-icon" style={{ color: '#2563eb' }} />
              WEIGHT, PACKAGING TARE &amp; BURNING LOSS (B.LOSS) CALCULATION
            </div>
            
            <div className="mform-row mform-col-4">
              <div className="mform-field">
                <label className="mform-label">Gross Weight (KG) <span className="req">*</span></label>
                <input
                  type="number" step="0.1" className="mform-input" placeholder="e.g. 5000"
                  value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)}
                  min="0.1" required
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">No. of BORA / Bags</label>
                <input
                  type="number" className="mform-input" placeholder="e.g. 200"
                  value={form.boraCount} onChange={e => set('boraCount', e.target.value)}
                  min="0"
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">Article / Packaging Type</label>
                <select className="mform-select" value={form.articleType} onChange={e => set('articleType', e.target.value)}>
                  <option value="BORA">BORA (0.200 KG / Bag)</option>
                  <option value="PLASTIC CONE">PLASTIC CONE (0.025 KG / Cone)</option>
                  <option value="KHALI BAG">KHALI BAG (0.120 KG / Bag)</option>
                  <option value="THELI">THELI (0.015 KG / Bag)</option>
                  <option value="CUSTOM">Custom Tare Rate</option>
                  <option value="NONE">NONE (Zero Tare)</option>
                </select>
              </div>

              <div className="mform-field">
                <label className="mform-label">Calculated Tare (KG)</label>
                <div className="mform-calc-field">
                  <span className="calc-value">{articleTareWeight.toFixed(2)} KG</span>
                  <span className="calc-note">({boraCnt} × {tareRate} kg)</span>
                </div>
              </div>
            </div>

            {/* Net Weight & Burning Loss Row */}
            <div className="mform-row mform-col-4" style={{ marginTop: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
              <div className="mform-field">
                <label className="mform-label" style={{ fontWeight: 'bold', color: '#1e293b' }}>Net Dispatch Weight</label>
                <div className="mform-calc-field" style={{ background: '#e0f2fe', borderColor: '#38bdf8' }}>
                  <span className="calc-value" style={{ color: '#0284c7', fontWeight: 'bold' }}>
                    {netWeight.toFixed(2)} KG
                  </span>
                </div>
              </div>

              <div className="mform-field">
                <label className="mform-label">B.Loss % (Burning/Process)</label>
                <input
                  type="number" step="0.1" min="0" max="50" className="mform-input" placeholder="0.0"
                  value={form.bLossPct} onChange={e => set('bLossPct', e.target.value)}
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">B.Loss Weight (KG)</label>
                <div className="mform-calc-field">
                  <span className="calc-value">{bLossKg.toFixed(2)} KG</span>
                  <span className="calc-note">Process Loss</span>
                </div>
              </div>

              <div className="mform-field">
                <label className="mform-label" style={{ fontWeight: 'bold', color: '#15803d' }}>Net Outward Returnable</label>
                <div className="mform-calc-field" style={{ background: '#dcfce7', borderColor: '#86efac' }}>
                  <span className="calc-value" style={{ color: '#15803d', fontWeight: 'bold' }}>
                    {netOutwardExpectedKg.toFixed(2)} KG
                  </span>
                </div>
              </div>
            </div>

            {/* Sample Pieces & Count Row */}
            <div className="mform-row mform-col-3" style={{ marginTop: '12px' }}>
              <div className="mform-field">
                <label className="mform-label">Total Pieces (PCs.)</label>
                <input type="number" className="mform-input" placeholder="Optional" value={form.pieces} onChange={e => set('pieces', e.target.value)} />
              </div>
              <div className="mform-field">
                <label className="mform-label">Sample Pieces (Smpl PCs.)</label>
                <input type="number" className="mform-input" placeholder="e.g. 10" value={form.samplePcs} onChange={e => set('samplePcs', e.target.value)} />
              </div>
              <div className="mform-field">
                <label className="mform-label">Sample Pcs Weight (KG)</label>
                <input type="number" step="0.01" className="mform-input" placeholder="e.g. 0.50" value={form.sampleWeight} onChange={e => set('sampleWeight', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section 4: Financials & Rate Master */}
          <div className="mform-row mform-col-3" style={{ marginTop: '14px' }}>
            <div className="mform-field">
              <label className="mform-label">Processing Rate (₹ / KG) <span className="req">*</span></label>
              <input type="number" step="0.01" className="mform-input" placeholder="17.50" value={form.processingRate} onChange={e => set('processingRate', e.target.value)} required />
              <div className="mform-hint">From JW Rate Master for {form.processType}</div>
            </div>
            <div className="mform-field">
              <label className="mform-label">Freight / Other Charges (₹)</label>
              <input type="number" className="mform-input" placeholder="0" value={form.freight} onChange={e => set('freight', e.target.value)} />
            </div>
            <div className="mform-field">
              <label className="mform-label">Total Payable Value (₹)</label>
              <div className="mform-calc-field">
                <span className="calc-value calc-total">₹{totalPayable > 0 ? totalPayable.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '0'}</span>
              </div>
            </div>
          </div>

          {/* Section 5: Logistics & Authorizations */}
          <div className="mform-section" style={{ marginTop: '14px' }}>
            <div className="mform-section-title">
              <Truck size={15} className="msec-icon" />
              LOGISTICS &amp; STATUTORY AUTHORIZATION
            </div>
            <div className="mform-row mform-col-4">
              <div className="mform-field">
                <label className="mform-label">Batch / Lot No.</label>
                <input type="text" className="mform-input" value={form.batchNo} onChange={e => set('batchNo', e.target.value)} />
              </div>
              <div className="mform-field">
                <label className="mform-label">Vehicle Number</label>
                <input type="text" className="mform-input" placeholder="e.g. GJ-03-XX-1234" value={form.vehicleNo} onChange={e => set('vehicleNo', e.target.value)} />
              </div>
              <div className="mform-field">
                <label className="mform-label">Issued By</label>
                <select className="mform-select" value={form.issuedBy} onChange={e => set('issuedBy', e.target.value)}>
                  {AUTHORIZED_PERSONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="mform-field">
                <label className="mform-label">Final Approval</label>
                <input type="text" className="mform-input" value={form.approvedBy} onChange={e => set('approvedBy', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="mform-field" style={{ marginTop: '10px' }}>
            <label className="mform-label">Processing Instructions &amp; Challan Remarks</label>
            <textarea className="mform-textarea" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Enter process specs, yarn denier, twist count, and delivery terms..." />
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="mfooter-btn confirm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <UserCheck size={16} />
              Issue Rule 55 Delivery Challan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

