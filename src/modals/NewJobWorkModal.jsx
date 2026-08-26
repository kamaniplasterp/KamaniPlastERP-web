import { useState, useEffect } from 'react';
import { X, Calculator } from 'lucide-react';
import { createJobWork } from '../api/jobwork.api';
import { subscribeRawMaterials } from '../api/inventory.api';
import { subscribeVendors } from '../api/directory.api';
import '../styles/Modals.css';

const PROCESS_TYPES = [
  'Tape Extrusion & Spinning',
  'Monofilament Extrusion',
  'Rope Twisting & Laying',
  'Yarn Winding & Twisting',
  'Weaving & Netting',
];

function today() {
  return new Date().toISOString().split('T')[0];
}
function addDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
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
    rawMaterial: '',
    jwParty: '',
    processType: PROCESS_TYPES[0],
    challanDate: today(),
    expectedReturn: addDays(5),
    dispatchQty: '',
    wastage: '',
    processingRate: '',
    freight: '',
    batchNo: `BATCH-2026-${Math.floor(Math.random() * 900 + 100)}`,
    vehicleNo: '',
    stockSource: 'Silo Bay A-1',
    remarks: '',
  });

  const displayVendors = liveVendors.length > 0 ? liveVendors : [
    { id: 'V1', name: 'Shree Plastic Works', location: 'Morbi, Gujarat', gst: '24AABCS9912K1Z4' },
    { id: 'V2', name: 'Patel Rope Processing', location: 'Rajkot, Gujarat', gst: '24AABCP1234K1Z5' },
    { id: 'V3', name: 'Krishna Extrusion Works', location: 'Jamnagar, Gujarat', gst: '24AABCK5678K1Z6' }
  ];

  const selMaterial = liveMaterials.find(m => m.id === form.rawMaterial);
  const selParty = displayVendors.find(p => p.id === form.jwParty);
  const dispatchQty = parseFloat(form.dispatchQty) || 0;
  const wastageKg = dispatchQty * (parseFloat(form.wastage) || 0) / 100;
  const targetOutput = Math.max(0, dispatchQty - wastageKg);
  const totalPayable = dispatchQty * (parseFloat(form.processingRate) || 0) + (parseFloat(form.freight) || 0);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Close on Escape
  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (dispatchQty <= 0) {
      alert('Please enter a valid dispatch quantity greater than 0 KG.');
      return;
    }
    const availInFactory = Number(selMaterial?.availFactory) || 0;
    if (selMaterial && dispatchQty > availInFactory) {
      alert(`Cannot issue ${dispatchQty.toLocaleString()} KG! Factory stock only has ${availInFactory.toLocaleString()} KG available.`);
      return;
    }

    const vendorLabel = selParty ? (selParty.name || selParty.label || 'Shree Plastic Works') : 'Shree Plastic Works';
    const matLabel = selMaterial ? (selMaterial.name || selMaterial.label || 'PP Granules') : 'PP Granules (Raffia Grade)';
    try {
      const payload = {
        vendor: vendorLabel,
        vendorId: form.jwParty || null,
        rawMat: matLabel,
        rawMaterialId: form.rawMaterial || null,
        sentQtyKg: dispatchQty,
        expectedFg: `${targetOutput.toFixed(0)} KG`,
        batch: form.batchNo,
        remarks: form.remarks,
        process: form.processType,
        charges: parseFloat(form.processingRate) || 8.5
      };
      if (onSave) {
        await onSave(payload);
      } else {
        await createJobWork(payload);
      }
      alert(`Job Work Order created for ${vendorLabel} (${dispatchQty} KG)!`);
    } catch (err) {
      console.error('Error creating job work:', err);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-lg">
        {/* Header */}
        <div className="modal-header-dark">
          <div>
            <h2 className="modal-title">Issue New Job Work Order</h2>
            <p className="modal-subtitle">Create outward delivery challan &amp; transfer raw material from factory to Job Worker</p>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Row 1 */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Select Raw Material <span className="req">*</span></label>
              <select className="mform-select" value={form.rawMaterial} onChange={e => set('rawMaterial', e.target.value)} required>
                <option value="">-- Select Material --</option>
                {liveMaterials.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name || 'Raw Material'} ({m.code || m.id}) - Avail: {m.availFactory || 0} KG
                  </option>
                ))}
              </select>
              {selMaterial && (
                <div className="mform-hint">
                  Available in Factory: <span className="hint-green">{selMaterial.availFactory || 0} KG</span>
                </div>
              )}
            </div>
            <div className="mform-field">
              <label className="mform-label">Job Work Party (Vendor) <span className="req">*</span></label>
              <select className="mform-select" value={form.jwParty} onChange={e => set('jwParty', e.target.value)} required>
                <option value="">-- Select Vendor --</option>
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
          </div>

          {/* Row 2 */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Process Type <span className="req">*</span></label>
              <select className="mform-select" value={form.processType} onChange={e => set('processType', e.target.value)} required>
                {PROCESS_TYPES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="mform-field">
              <label className="mform-label">Challan Date <span className="req">*</span></label>
              <input type="date" className="mform-input" value={form.challanDate} onChange={e => set('challanDate', e.target.value)} required />
            </div>
            <div className="mform-field">
              <label className="mform-label">Expected Return Date <span className="req">*</span></label>
              <input type="date" className="mform-input" value={form.expectedReturn} onChange={e => set('expectedReturn', e.target.value)} required />
            </div>
          </div>

          {/* Quantity & Yield Section */}
          <div className="mform-section">
            <div className="mform-section-title">
              <Calculator size={15} className="msec-icon" />
              QUANTITY &amp; YIELD ESTIMATES
            </div>
            <div className="mform-row mform-col-3">
              <div className="mform-field">
                <label className="mform-label">Dispatch Quantity (KG) <span className="req">*</span></label>
                <input
                  type="number" className="mform-input" placeholder="0"
                  value={form.dispatchQty} onChange={e => set('dispatchQty', e.target.value)}
                  min="1" max={selMaterial?.available} required
                />
              </div>
              <div className="mform-field">
                <label className="mform-label">Expected Wastage (%)</label>
                <input
                  type="number" className="mform-input" placeholder="0"
                  value={form.wastage} onChange={e => set('wastage', e.target.value)}
                  min="0" max="100" step="0.1"
                />
                {wastageKg > 0 && <div className="mform-hint">Calculated: {wastageKg.toFixed(0)} KG</div>}
              </div>
              <div className="mform-field">
                <label className="mform-label">Target Output (KG)</label>
                <div className="mform-calc-field">
                  <span className="calc-value">{targetOutput > 0 ? `${targetOutput.toFixed(0)} KG` : '—'}</span>
                  {targetOutput > 0 && <span className="calc-note">Net receivable after scrap</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Financial Row */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Processing Rate (₹ / KG) <span className="req">*</span></label>
              <input type="number" className="mform-input" placeholder="0.00" value={form.processingRate} onChange={e => set('processingRate', e.target.value)} min="0" step="0.01" required />
            </div>
            <div className="mform-field">
              <label className="mform-label">Freight / Other Charges (₹)</label>
              <input type="number" className="mform-input" placeholder="0" value={form.freight} onChange={e => set('freight', e.target.value)} min="0" />
            </div>
            <div className="mform-field">
              <label className="mform-label">Total Payable (₹)</label>
              <div className="mform-calc-field">
                <span className="calc-value calc-total">₹{totalPayable > 0 ? totalPayable.toLocaleString('en-IN') : '0'}</span>
              </div>
            </div>
          </div>

          {/* Logistics Row */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Batch / Lot Number</label>
              <input type="text" className="mform-input" value={form.batchNo} onChange={e => set('batchNo', e.target.value)} placeholder="BATCH-2026-XXX" />
            </div>
            <div className="mform-field">
              <label className="mform-label">Vehicle No</label>
              <input type="text" className="mform-input" value={form.vehicleNo} onChange={e => set('vehicleNo', e.target.value)} placeholder="GJ-03-XX-0000" />
            </div>
            <div className="mform-field">
              <label className="mform-label">Stock Source Location</label>
              <input type="text" className="mform-input" value={form.stockSource} onChange={e => set('stockSource', e.target.value)} placeholder="Silo Bay A-1" />
            </div>
          </div>

          {/* Remarks */}
          <div className="mform-field">
            <label className="mform-label">Processing Instructions &amp; Remarks</label>
            <textarea className="mform-textarea" rows={3} value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Enter special processing instructions, quality requirements, tolerance levels..." />
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="mfooter-btn confirm">
              Issue Job Work Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
