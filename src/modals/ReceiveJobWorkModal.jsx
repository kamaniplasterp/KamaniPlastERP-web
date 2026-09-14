import { useState, useEffect } from 'react';
import { X, FileText, Calculator, Layers, CheckCircle2, Plus, Trash2, Building } from 'lucide-react';
import { ARTICLE_TARE_DEFAULTS } from '../api/jobwork.api';
import { 
  subscribePersonnel, 
  subscribeTareStandards, 
  DEFAULT_PERSONNEL, 
  DEFAULT_TARE_STANDARDS 
} from '../api/directory.api';
import '../styles/Modals.css';

const DEPARTMENT_OPTIONS = ['EXTRUSION', 'TWISTING', 'ROPE', 'WINDING', 'PACKING'];

export default function ReceiveJobWorkModal({ row, onClose, onSave }) {
  const jwId = row?.jwNo || row?.id || 'JW-ORDER';
  const chNo = row?.chNo || row?.challan || jwId;
  const party = row?.vendor || row?.party || 'Job Worker';
  const defaultRate = Number(row?.ratePerKg || row?.charges || 17.5);
  const pendingMax = Number(row?.balQtyKg !== undefined ? row.balQtyKg : (row?.pendingQty ? parseFloat(String(row.pendingQty).replace(/[^0-9.]/g, '')) : 0));

  const [personnelList, setPersonnelList] = useState(DEFAULT_PERSONNEL);
  const [tareStandards, setTareStandards] = useState(DEFAULT_TARE_STANDARDS);

  useEffect(() => {
    const unsubP = subscribePersonnel(setPersonnelList);
    const unsubT = subscribeTareStandards(setTareStandards);
    return () => {
      unsubP();
      unsubT();
    };
  }, []);

  const getUnitTare = (type) => {
    if (type === 'BORA') return Number(tareStandards.bora || 0.200);
    if (type === 'PLASTIC CONE') return Number(tareStandards.plasticCone || 0.025);
    if (type === 'KHALI BAG') return Number(tareStandards.khaliBag || 0.120);
    if (type === 'THELI') return Number(tareStandards.theli || 0.015);
    return Number(ARTICLE_TARE_DEFAULTS[type] || 0);
  };

  const [form, setForm] = useState({
    inwardSlipNo: `SLIP-${Math.floor(1000 + Math.random() * 9000)}`,
    inwardDate: new Date().toISOString().split('T')[0],
    department: row?.department || 'EXTRUSION',
    subChalNo: row?.subChalNo || '1',
    itemLabel: row?.material ? `${row.material} -> FINISHED YARN` : 'ANCHOR YARN ^ YARN HANK ^ F BLUE',

    // Gross Weight
    grossWeight: String(pendingMax || ''),

    // QA & Segregation
    reworkQty: '0',
    rejectionQty: '0',
    scrapQty: '0',
    qualityStatus: 'Approved',
    samplePcs: '10',
    sampleWeight: '0.50',

    // Personnel & Finance
    receivedBy: DEFAULT_PERSONNEL[4] || 'RAMILBHAI',
    ratePerKg: String(defaultRate),
    location: 'WIP Finished Goods Bay 2',
    notes: ''
  });

  // Multi-article rows (up to 4 rows from Excel JW-Inward)
  const [articleRows, setArticleRows] = useState([
    {
      id: 1,
      articleType: 'BORA',
      count: String(Math.round(pendingMax / 25) || '1'),
      unitTare: 0.200
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  // Article row handlers
  const handleAddArticleRow = () => {
    if (articleRows.length >= 4) {
      alert('Maximum 4 article packaging groups allowed.');
      return;
    }
    const defaultType = 'PLASTIC CONE';
    setArticleRows(prev => [
      ...prev,
      {
        id: Date.now(),
        articleType: defaultType,
        count: '10',
        unitTare: getUnitTare(defaultType)
      }
    ]);
  };

  const handleRemoveArticleRow = (idx) => {
    if (articleRows.length <= 1) return;
    setArticleRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleArticleChange = (idx, field, val) => {
    setArticleRows(prev => {
      const updated = [...prev];
      const target = { ...updated[idx], [field]: val };
      if (field === 'articleType') {
        target.unitTare = getUnitTare(val);
      }
      updated[idx] = target;
      return updated;
    });
  };

  // Compute total article tare weight across all rows
  const totalTareKg = articleRows.reduce((sum, r) => {
    const cnt = parseFloat(r.count) || 0;
    const ut = parseFloat(r.unitTare) || 0;
    return sum + (cnt * ut);
  }, 0);

  // Bora count for packaging reconciliation (find Bora row)
  const boraRow = articleRows.find(r => r.articleType === 'BORA');
  const recBoraCount = boraRow ? (parseFloat(boraRow.count) || 0) : 0;

  const gross = parseFloat(form.grossWeight) || 0;
  const calculatedNetKg = gross > 0 ? Math.max(0, gross - totalTareKg) : 0;

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
          department: form.department,
          subChalNo: form.subChalNo,
          itemLabel: form.itemLabel,
          recGrossWeight: gross,
          recBoraCount: recBoraCount,
          articleRows: articleRows,
          recArticleType: articleRows.map(r => r.articleType).join(', '),
          recArticleWeight: totalTareKg,
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
      <div className="modal-dialog modal-lg" style={{ maxWidth: '900px', maxHeight: '92vh', overflowY: 'auto' }}>
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
                <h2 className="modal-title">Job Work Inward Slip Entry (Sheet: JW-Inward)</h2>
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
          {/* Slip Header Row: 5 Columns with Department, Party Name, Challan No, Sub Challan No. + Date, Date */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">
                <Building size={12} style={{ display: 'inline', marginRight: 4 }} />
                Department <span className="req">*</span>
              </label>
              <select
                className="mform-select"
                value={form.department}
                onChange={e => set('department', e.target.value)}
                required
              >
                {DEPARTMENT_OPTIONS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="mform-field">
              <label className="mform-label">Party Name</label>
              <input type="text" className="mform-input" value={party} readOnly style={{ background: '#f1f5f9', fontWeight: 'bold' }} />
            </div>

            <div className="mform-field">
              <label className="mform-label">Date <span className="req">*</span></label>
              <input type="date" className="mform-input" value={form.inwardDate} onChange={e => set('inwardDate', e.target.value)} required />
            </div>
          </div>

          <div className="mform-row mform-col-2" style={{ marginTop: '8px' }}>
            <div className="mform-field">
              <label className="mform-label">Challan No. <span className="req">*</span></label>
              <input type="text" className="mform-input" value={form.inwardSlipNo} onChange={e => set('inwardSlipNo', e.target.value)} required />
            </div>

            <div className="mform-field">
              <label className="mform-label">Sub Challan No. + Date</label>
              <input type="text" className="mform-input" value={`${form.subChalNo} + ${form.inwardDate}`} onChange={e => set('subChalNo', e.target.value)} />
            </div>
          </div>

          {/* Returned Item Specification */}
          <div className="mform-field" style={{ marginTop: '8px' }}>
            <label className="mform-label">Item Name <span className="req">*</span></label>
            <input
              type="text" className="mform-input"
              value={form.itemLabel} onChange={e => set('itemLabel', e.target.value)}
              placeholder="e.g. ANCHOR YARN ^ YARN HANK ^ F BLUE" required
            />
          </div>

          {/* Weight & Multi-Article Tare Matrix (Sheet: JW-Inward Multi Article Rows) */}
          <div className="mform-section" style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '14px', borderRadius: '8px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className="mform-section-title" style={{ color: '#c2410c', margin: 0 }}>
                <Calculator size={15} className="msec-icon" style={{ color: '#ea580c' }} />
                INWARD WEIGHT &amp; PACKAGING TARE MATRIX (MULTI-ARTICLE)
              </div>
              <button
                type="button"
                onClick={handleAddArticleRow}
                style={{
                  background: '#ea580c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer'
                }}
                disabled={articleRows.length >= 4}
              >
                <Plus size={13} /> Add Article Row ({articleRows.length}/4)
              </button>
            </div>

            {/* Gross Weight Row */}
            <div className="mform-row mform-col-4" style={{ marginBottom: '10px' }}>
              <div className="mform-field">
                <label className="mform-label">Gross Weight <span className="req">*</span></label>
                <input
                  type="number" step="0.1" className="mform-input"
                  value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)}
                  min="0.1" required
                />
              </div>
              <div className="mform-field">
                <label className="mform-label">No. of BORA</label>
                <input
                  type="number" className="mform-input"
                  value={recBoraCount}
                  readOnly
                  style={{ background: '#f8fafc', fontWeight: 'bold' }}
                />
              </div>
              <div className="mform-field">
                <label className="mform-label">Final Article Weight</label>
                <div className="mform-calc-field" style={{ background: '#fef3c7', borderColor: '#fcd34d' }}>
                  <span className="calc-value" style={{ color: '#b45309', fontWeight: 'bold' }}>
                    {totalTareKg.toFixed(3)} KG
                  </span>
                </div>
              </div>
              <div className="mform-field">
                <label className="mform-label" style={{ color: '#9a3412', fontWeight: 'bold' }}>Net Weight</label>
                <div className="mform-calc-field" style={{ background: '#ffedd5', borderColor: '#fdba74' }}>
                  <span className="calc-value" style={{ color: '#ea580c', fontWeight: 'bold' }}>
                    {calculatedNetKg.toFixed(2)} KG
                  </span>
                </div>
              </div>
            </div>

            {/* Article Rows Table */}
            <div style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #fed7aa', padding: '8px', marginBottom: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '8px', fontSize: '0.72rem', fontWeight: 'bold', color: '#9a3412', marginBottom: '6px', textTransform: 'uppercase' }}>
                <div>Article Type</div>
                <div>No. of Articles</div>
                <div>Article Weight</div>
                <div style={{ textAlign: 'right', paddingRight: '6px' }}>Final Weight</div>
                <div></div>
              </div>
              {articleRows.map((ar, idx) => {
                const rowTare = ((parseFloat(ar.count) || 0) * (parseFloat(ar.unitTare) || 0)).toFixed(3);
                return (
                  <div key={ar.id || idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                    <div>
                      <select
                        className="mform-select"
                        value={ar.articleType}
                        onChange={e => handleArticleChange(idx, 'articleType', e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '5px 8px' }}
                      >
                        <option value="BORA">BORA (0.200 KG)</option>
                        <option value="PLASTIC CONE">PLASTIC CONE (0.025 KG)</option>
                        <option value="KHALI BAG">KHALI BAG (0.120 KG)</option>
                        <option value="THELI">THELI (0.015 KG)</option>
                        <option value="NONE">NONE (Zero Tare)</option>
                      </select>
                    </div>

                    <div>
                      <input
                        type="number"
                        min="0"
                        className="mform-input"
                        placeholder="No. of Articles"
                        value={ar.count}
                        onChange={e => handleArticleChange(idx, 'count', e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '5px 8px' }}
                      />
                    </div>

                    <div>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        className="mform-input"
                        placeholder="Tare/Unit"
                        value={ar.unitTare}
                        onChange={e => handleArticleChange(idx, 'unitTare', e.target.value)}
                        style={{ fontSize: '0.8rem', padding: '5px 8px' }}
                      />
                    </div>

                    <div style={{ fontSize: '0.82rem', fontWeight: 'bold', color: '#0369a1', textAlign: 'right', paddingRight: '6px' }}>
                      = {rowTare} KG
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleRemoveArticleRow(idx)}
                        disabled={articleRows.length <= 1}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: articleRows.length <= 1 ? '#cbd5e1' : '#ef4444',
                          cursor: articleRows.length <= 1 ? 'not-allowed' : 'pointer'
                        }}
                        title="Remove Article Row"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rejection / Rework segregation */}
            <div className="mform-row mform-col-4" style={{ marginTop: '8px', borderTop: '1px dashed #fdba74', paddingTop: '10px' }}>
              <div className="mform-field">
                <label className="mform-label">Rework</label>
                <input type="number" step="0.1" className="mform-input" value={form.reworkQty} onChange={e => set('reworkQty', e.target.value)} />
              </div>

              <div className="mform-field">
                <label className="mform-label">Rejection (KG)</label>
                <input type="number" step="0.1" className="mform-input" value={form.rejectionQty} onChange={e => set('rejectionQty', e.target.value)} />
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
                <label className="mform-label">PCs.</label>
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
              <label className="mform-label">Rate <span className="req">*</span></label>
              <input type="number" step="0.01" className="mform-input" value={form.ratePerKg} onChange={e => set('ratePerKg', e.target.value)} required />
            </div>

            <div className="mform-field">
              <label className="mform-label">Value</label>
              <div className="mform-calc-field">
                <span className="calc-value calc-total">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="mform-field">
              <label className="mform-label">Received By <span className="req">*</span></label>
              <select className="mform-select" value={form.receivedBy} onChange={e => set('receivedBy', e.target.value)}>
                {personnelList.map(p => <option key={p} value={p}>{p}</option>)}
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
              <label className="mform-label">Remarks</label>
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
