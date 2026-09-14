import { useState } from 'react';
import { X, FileText, Calculator, Layers, CheckCircle2 } from 'lucide-react';
import { ARTICLE_TARE_DEFAULTS, AUTHORIZED_PERSONS } from '../api/jobwork.api';
import '../styles/Modals.css';

export default function ReceiveJobWorkModal({ row, onClose, onSave }) {
  const jwId = row?.jwNo || row?.id || 'JW-ORDER';
  const chNo = row?.chNo || row?.challan || jwId;
  const party = row?.vendor || row?.party || 'Job Worker';
  const defaultRate = Number(row?.ratePerKg || row?.charges || 17.5);
  const pendingMax = Number(row?.balQtyKg !== undefined ? row.balQtyKg : (row?.pendingQty ? parseFloat(String(row.pendingQty).replace(/[^0-9.]/g, '')) : 0));

  const [form, setForm] = useState({
    inwardSlipNo: `SLIP-${Math.floor(1000 + Math.random() * 9000)}`,
    inwardDate: new Date().toISOString().split('T')[0],
    subChalNo: row?.subChalNo || '1',
    itemLabel: row?.material ? `${row.material} -> FINISHED YARN` : 'ANCHOR YARN ^ YARN HANK ^ F BLUE',

    // Weight & Packaging
    grossWeight: String(pendingMax || ''),
    boraCount: String(Math.round(pendingMax / 25) || '0'),
    articleType: 'BORA',
    customTare: '',

    // QA & Segregation
    reworkQty: '0',
    rejectionQty: '0',
    scrapQty: '0',
    qualityStatus: 'Approved',
    samplePcs: '10',
    sampleWeight: '0.50',

    // Personnel & Finance
    receivedBy: AUTHORIZED_PERSONS[4] || 'RAMILBHAI',
    ratePerKg: String(defaultRate),
    location: 'WIP Finished Goods Bay 2',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  // Dynamic tare & net calculations
  const gross = parseFloat(form.grossWeight) || 0;
  const boraCnt = parseFloat(form.boraCount) || 0;
  const tareRate = form.articleType === 'CUSTOM'
    ? (parseFloat(form.customTare) || 0)
    : (ARTICLE_TARE_DEFAULTS[form.articleType] !== undefined ? ARTICLE_TARE_DEFAULTS[form.articleType] : 0.200);

  const calculatedTareKg = boraCnt * tareRate;
  const calculatedNetKg = gross > 0 ? Math.max(0, gross - calculatedTareKg) : 0;

  const reworkKg = parseFloat(form.reworkQty) || 0;
  const rejectionKg = parseFloat(form.rejectionQty) || 0;
  const scrapKg = parseFloat(form.scrapQty) || 0;
  const acceptedKg = Math.max(0, calculatedNetKg - reworkKg - rejectionKg - scrapKg);

  const rateKg = parseFloat(form.ratePerKg) || 0;
  const totalValue = calculatedNetKg * rateKg;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (calculatedNetKg <= 0 && gross <= 0) {
      alert('Please enter a valid Gross / Inward quantity greater than 0 KG.');
      return;
    }

    if (pendingMax > 0 && calculatedNetKg > pendingMax * 1.05) {
      if (!confirm(`Received Net weight (${calculatedNetKg.toFixed(2)} KG) exceeds pending balance (${pendingMax.toFixed(2)} KG) by more than 5%. Do you wish to proceed?`)) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (onSave) {
        await onSave({
          jwId,
          party,
          inwardSlipNo: form.inwardSlipNo,
          inwardDate: form.inwardDate,
          itemLabel: form.itemLabel,
          recGrossWeight: gross,
          recBoraCount: boraCnt,
          recArticleType: form.articleType,
          recArticleWeight: calculatedTareKg,
          recQtyKg: calculatedNetKg,
          acceptedQty: acceptedKg,
          reworkQtyKg: reworkKg,
          rejectionQtyKg: rejectionKg,
          scrapQtyKg: scrapKg,
          samplePcs: Number(form.samplePcs || 0),
          sampleWeight: Number(form.sampleWeight || 0),
          receivedBy: form.receivedBy,
          ratePerKg: rateKg,
          value: totalValue,
          qualityStatus: form.qualityStatus,
          location: form.location,
          notes: form.notes
        });
      }
      onClose();
    } catch (err) {
      console.error('Error in GRN submit:', err);
      alert('Failed to record Job Work Inward Slip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-lg" style={{ maxWidth: '880px', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Dark Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: 'rgba(249, 115, 22, 0.2)', border: '1px solid rgba(249, 115, 22, 0.3)', color: '#f97316' }}>
              <FileText size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: '#f97316', color: '#fff', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '4px' }}>
                  INWARD SLIP
                </span>
                <h2 className="modal-title">Job Work Inward Slip Entry</h2>
              </div>
              <p className="modal-subtitle">Record received processed goods for {jwId} (Challan #{chNo}) from {party}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Slip Header Row */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Inward Slip No. <span className="req">*</span></label>
              <input type="text" className="mform-input" value={form.inwardSlipNo} onChange={e => set('inwardSlipNo', e.target.value)} required />
            </div>
            <div className="mform-field">
              <label className="mform-label">Inward Date <span className="req">*</span></label>
              <input type="date" className="mform-input" value={form.inwardDate} onChange={e => set('inwardDate', e.target.value)} required />
            </div>
            <div className="mform-field">
              <label className="mform-label">Sub Challan Ref</label>
              <input type="text" className="mform-input" value={form.subChalNo} onChange={e => set('subChalNo', e.target.value)} />
            </div>
          </div>

          {/* Returned Item Specification */}
          <div className="mform-field" style={{ marginTop: '8px' }}>
            <label className="mform-label">Processed Finished Goods Item Description <span className="req">*</span></label>
            <input
              type="text" className="mform-input"
              value={form.itemLabel} onChange={e => set('itemLabel', e.target.value)}
              placeholder="e.g. ANCHOR YARN ^ YARN HANK ^ F BLUE" required
            />
          </div>

          {/* Weight & Tare Section */}
          <div className="mform-section" style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '14px', borderRadius: '8px', marginTop: '12px' }}>
            <div className="mform-section-title" style={{ color: '#c2410c' }}>
              <Calculator size={15} className="msec-icon" style={{ color: '#ea580c' }} />
              INWARD WEIGHT &amp; PACKAGING TARE MATRIX
            </div>

            <div className="mform-row mform-col-4">
              <div className="mform-field">
                <label className="mform-label">Gross Weight Received (KG) <span className="req">*</span></label>
                <input
                  type="number" step="0.1" className="mform-input"
                  value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)}
                  min="0.1" required
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">No. of BORA / Bags</label>
                <input
                  type="number" className="mform-input"
                  value={form.boraCount} onChange={e => set('boraCount', e.target.value)}
                  min="0"
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">Article Type</label>
                <select className="mform-select" value={form.articleType} onChange={e => set('articleType', e.target.value)}>
                  <option value="BORA">BORA (0.200 KG / Bag)</option>
                  <option value="PLASTIC CONE">PLASTIC CONE (0.025 KG)</option>
                  <option value="KHALI BAG">KHALI BAG (0.120 KG)</option>
                  <option value="THELI">THELI (0.015 KG)</option>
                  <option value="NONE">NONE (Zero Tare)</option>
                </select>
              </div>

              <div className="mform-field">
                <label className="mform-label" style={{ color: '#9a3412', fontWeight: 'bold' }}>Net Weight Received</label>
                <div className="mform-calc-field" style={{ background: '#ffedd5', borderColor: '#fdba74' }}>
                  <span className="calc-value" style={{ color: '#ea580c', fontWeight: 'bold' }}>
                    {calculatedNetKg.toFixed(2)} KG
                  </span>
                </div>
              </div>
            </div>

            {/* Rejection / Rework segregation */}
            <div className="mform-row mform-col-4" style={{ marginTop: '12px', borderTop: '1px dashed #fdba74', paddingTop: '10px' }}>
              <div className="mform-field">
                <label className="mform-label">Rejection (KG)</label>
                <input type="number" step="0.1" className="mform-input" value={form.rejectionQty} onChange={e => set('rejectionQty', e.target.value)} />
              </div>

              <div className="mform-field">
                <label className="mform-label">Rework (KG)</label>
                <input type="number" step="0.1" className="mform-input" value={form.reworkQty} onChange={e => set('reworkQty', e.target.value)} />
              </div>

              <div className="mform-field">
                <label className="mform-label">Scrap / Wastage (KG)</label>
                <input type="number" step="0.1" className="mform-input" value={form.scrapQty} onChange={e => set('scrapQty', e.target.value)} />
              </div>

              <div className="mform-field">
                <label className="mform-label" style={{ color: '#166534', fontWeight: 'bold' }}>A-Grade Accepted</label>
                <div className="mform-calc-field" style={{ background: '#dcfce7', borderColor: '#86efac' }}>
                  <span className="calc-value" style={{ color: '#16a34a', fontWeight: 'bold' }}>
                    {acceptedKg.toFixed(2)} KG
                  </span>
                </div>
              </div>
            </div>

            {/* QA Sample row */}
            <div className="mform-row mform-col-3" style={{ marginTop: '10px' }}>
              <div className="mform-field">
                <label className="mform-label">Sample Pieces (Smpl PCs.)</label>
                <input type="number" className="mform-input" value={form.samplePcs} onChange={e => set('samplePcs', e.target.value)} />
              </div>
              <div className="mform-field">
                <label className="mform-label">Sample Pcs Weight (KG)</label>
                <input type="number" step="0.01" className="mform-input" value={form.sampleWeight} onChange={e => set('sampleWeight', e.target.value)} />
              </div>
              <div className="mform-field">
                <label className="mform-label">Quality Status</label>
                <select className="mform-select" value={form.qualityStatus} onChange={e => set('qualityStatus', e.target.value)}>
                  <option value="Approved">Approved (A-Grade Passed)</option>
                  <option value="Rework">Rework Required</option>
                  <option value="Rejected">Rejected Consignment</option>
                </select>
              </div>
            </div>
          </div>

          {/* Rates & Personnel */}
          <div className="mform-row mform-col-3" style={{ marginTop: '12px' }}>
            <div className="mform-field">
              <label className="mform-label">Rate (₹ / KG) <span className="req">*</span></label>
              <input type="number" step="0.01" className="mform-input" value={form.ratePerKg} onChange={e => set('ratePerKg', e.target.value)} required />
            </div>

            <div className="mform-field">
              <label className="mform-label">Total Processing Value (₹)</label>
              <div className="mform-calc-field">
                <span className="calc-value calc-total">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="mform-field">
              <label className="mform-label">Received By (Supervisor) <span className="req">*</span></label>
              <select className="mform-select" value={form.receivedBy} onChange={e => set('receivedBy', e.target.value)}>
                {AUTHORIZED_PERSONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Storage & Remarks */}
          <div className="mform-row mform-col-2" style={{ marginTop: '10px' }}>
            <div className="mform-field">
              <label className="mform-label">Stock Location</label>
              <input type="text" className="mform-input" value={form.location} onChange={e => set('location', e.target.value)} />
            </div>
            <div className="mform-field">
              <label className="mform-label">Inspection Remarks</label>
              <input type="text" className="mform-input" placeholder="Yarn strength, denier uniformity, color match..." value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ marginTop: '16px' }}>
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm" style={{ background: '#ea580c', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              Save Job Work Inward Slip
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

