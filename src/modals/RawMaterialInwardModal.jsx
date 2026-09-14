import { useState, useEffect } from 'react';
import { X, Package, Calculator, Truck, FileText, CheckCircle2 } from 'lucide-react';
import { RM_ITEM_NAMES, RM_GRADES, RM_SUPPLIERS, recordRmInward } from '../api/inventory.api';
import { ARTICLE_TARE_DEFAULTS } from '../api/jobwork.api';
import { 
  subscribePersonnel, 
  subscribeTareStandards, 
  DEFAULT_PERSONNEL, 
  DEFAULT_TARE_STANDARDS 
} from '../api/directory.api';
import '../styles/Modals.css';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function RawMaterialInwardModal({ onClose, onSaved }) {
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
    grnNo: `GRN-${Math.floor(1000 + Math.random() * 9000)}`,
    challanNo: `CHL-${Math.floor(1000 + Math.random() * 9000)}`,
    date: today(),
    supplierName: RM_SUPPLIERS[0],
    itemName: RM_ITEM_NAMES[0],
    grade: RM_GRADES[0],
    grossWeight: '',
    boraCount: '',
    articleType: 'BORA',
    customTareRate: '',
    rate: '112',
    receivedBy: DEFAULT_PERSONNEL[0],
    remarks: ''
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Auto compute tare weight and net weight
  const grossWght = Number(form.grossWeight || 0);
  const boraCount = Number(form.boraCount || 0);
  const unitTare = form.customTareRate !== ''
    ? Number(form.customTareRate)
    : getUnitTare(form.articleType);

  const articleTareWeight = Math.round(boraCount * unitTare * 100) / 100;
  const netInwardKg = grossWght > 0 ? Math.max(0, grossWght - articleTareWeight) : 0;
  const totalValuation = Math.round(netInwardKg * (Number(form.rate) || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (grossWght <= 0) {
      alert('Please enter a valid Gross Weight.');
      return;
    }

    try {
      await recordRmInward({
        grnNo: form.grnNo,
        challanNo: form.challanNo,
        date: form.date,
        supplierName: form.supplierName,
        itemName: form.itemName,
        grade: form.grade,
        grossWeight: grossWght,
        noOfArticles: boraCount,
        articleType: form.articleType,
        articleWeight: articleTareWeight,
        netWeight: netInwardKg,
        rate: Number(form.rate || 0),
        receivedBy: form.receivedBy,
        remarks: form.remarks
      });

      alert(`Raw Material Inward GRN ${form.grnNo} recorded successfully! Net Inward: ${netInwardKg.toLocaleString()} KG.`);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving RM Inward:', err);
      alert(`Error recording RM Inward: ${err.message}`);
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
              <select
                className="mform-select"
                value={form.supplierName}
                onChange={e => set('supplierName', e.target.value)}
                required
              >
                {RM_SUPPLIERS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="mform-field">
              <label className="mform-label">Item Name <span className="req">*</span></label>
              <select
                className="mform-select"
                value={form.itemName}
                onChange={e => set('itemName', e.target.value)}
                required
              >
                {RM_ITEM_NAMES.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div className="mform-field">
              <label className="mform-label">Grade <span className="req">*</span></label>
              <select
                className="mform-select"
                value={form.grade}
                onChange={e => set('grade', e.target.value)}
                required
              >
                {RM_GRADES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Scale Weighbridge & Tare Deductions */}
          <div className="mform-section-title" style={{ marginTop: '16px' }}>
            <Calculator size={14} style={{ color: '#ea580c' }} />
            <span>2. Weighbridge Scale &amp; Article Tare Weight</span>
          </div>

          <div className="mform-row mform-col-3">
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
              <label className="mform-label">No. of Articles</label>
              <input
                type="number"
                placeholder="e.g. 120"
                className="mform-input"
                value={form.boraCount}
                onChange={e => set('boraCount', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Article Type</label>
              <select
                className="mform-select"
                value={form.articleType}
                onChange={e => set('articleType', e.target.value)}
              >
                <option value="BORA">BORA (200g tare / bag)</option>
                <option value="PLASTIC CONE">PLASTIC CONE (25g tare / cone)</option>
                <option value="KHALI BAG">KHALI BAG (120g tare / bag)</option>
                <option value="THELI">THELI (15g tare / sleeve)</option>
                <option value="NONE">NONE (0g tare)</option>
              </select>
            </div>
          </div>

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
              <span style={{ color: '#64748b' }}>Article Weight (Art. Wght.): </span>
              <strong style={{ color: '#0f172a' }}>{articleTareWeight} KG</strong>
              <span style={{ margin: '0 8px', color: '#cbd5e1' }}>|</span>
              <span style={{ color: '#64748b' }}>Rate: </span>
              <strong style={{ color: '#0f172a' }}>₹{form.rate}/KG</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#64748b' }}>Net Weight (N. Wght.): </span>
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
              <select
                className="mform-select"
                value={form.receivedBy}
                onChange={e => set('receivedBy', e.target.value)}
              >
                {personnelList.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
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
