import { useState, useEffect } from 'react';
import { X, Factory, Calculator, FileText, CheckCircle2 } from 'lucide-react';
import { issueRmToFactory } from '../api/inventory.api';
import { subscribePersonnel, DEFAULT_PERSONNEL } from '../api/directory.api';
import '../styles/Modals.css';

function today() {
  return new Date().toISOString().split('T')[0];
}

export default function IssueToFactoryModal({ rmList = [], onClose, onSaved }) {
  const [personnelList, setPersonnelList] = useState(DEFAULT_PERSONNEL);

  useEffect(() => {
    const unsub = subscribePersonnel(setPersonnelList);
    return () => unsub();
  }, []);

  const [form, setForm] = useState({
    slipNo: `ISS-${Math.floor(1000 + Math.random() * 9000)}`,
    date: today(),
    rawMaterialId: rmList.length > 0 ? rmList[0].id : '',
    grossWeight: '',
    articleWeight: '0',
    quantity: '1',
    issuedBy: DEFAULT_PERSONNEL[0],
    remarks: 'Plant Line 1 (Danline Extrusion)'
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const selectedRm = (rmList || []).find(r => r.id === form.rawMaterialId) || (rmList.length > 0 ? rmList[0] : null);

  const grossWght = Number(form.grossWeight || 0);
  const articleWght = Number(form.articleWeight || 0);
  const netWght = grossWght > 0 ? Math.max(0, grossWght - articleWght) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (grossWght <= 0) {
      alert('Please enter a valid Gross Weight to issue.');
      return;
    }

    if (selectedRm && netWght > (Number(selectedRm.availFactory) || 0)) {
      if (!confirm(`Warning: Net issued weight (${netWght} KG) exceeds available factory stock (${selectedRm.availFactory} KG). Proceed anyway?`)) {
        return;
      }
    }

    try {
      await issueRmToFactory({
        slipNo: form.slipNo,
        date: form.date,
        rawMaterialId: form.rawMaterialId || selectedRm?.id,
        itemName: selectedRm?.name || 'Raw Material',
        grade: selectedRm?.grade || '',
        grossWeight: grossWght,
        articleWeight: articleWght,
        netWeight: netWght,
        quantity: Number(form.quantity || 1),
        issuedBy: form.issuedBy,
        remarks: form.remarks
      });

      alert(`Issue Slip ${form.slipNo} recorded successfully! Issued ${netWght.toLocaleString()} KG to factory.`);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Error saving factory issue:', err);
      alert(`Error issuing material to factory: ${err.message}`);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md">
        {/* Dark Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: '#7c3aed' }}>
              <Factory size={18} />
            </div>
            <div>
              <h2 className="modal-title">Issue Raw Material to Factory</h2>
              <p className="modal-subtitle">
                Issue raw polymer from factory silo to internal extrusion machines (from Excel Issue To Factory).
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Row 1: Slip No & Date */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Slip No. <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                value={form.slipNo}
                onChange={e => set('slipNo', e.target.value)}
                required
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
          </div>

          {/* Row 2: Select Material */}
          <div className="mform-field">
            <label className="mform-label">Item Name <span className="req">*</span></label>
            <select
              className="mform-select"
              value={form.rawMaterialId}
              onChange={e => set('rawMaterialId', e.target.value)}
              required
            >
              {rmList.map(rm => (
                <option key={rm.id} value={rm.id}>
                  {rm.name} ^ {rm.grade || rm.brand} (Avail: {Number(rm.availFactory || 0).toLocaleString()} KG)
                </option>
              ))}
            </select>
          </div>

          {/* Row 3: Scale Weights */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Gross Weight <span className="req">*</span></label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 50"
                className="mform-input"
                value={form.grossWeight}
                onChange={e => set('grossWeight', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Article Weight</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 8"
                className="mform-input"
                value={form.articleWeight}
                onChange={e => set('articleWeight', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Quantity</label>
              <input
                type="number"
                placeholder="e.g. 10"
                className="mform-input"
                value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
              />
            </div>
          </div>

          {/* Calculation Banner */}
          <div style={{
            background: '#f5f3ff',
            border: '1px solid #ddd6fe',
            borderRadius: '8px',
            padding: '12px 16px',
            marginTop: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.85rem'
          }}>
            <span style={{ color: '#6b21a8' }}>Net Weight:</span>
            <span style={{ color: '#7c3aed', fontWeight: '800', fontSize: '1.1rem' }}>
              {netWght.toLocaleString()} KG
            </span>
          </div>

          {/* Row 4: Issuer & Remarks */}
          <div className="mform-row mform-col-2" style={{ marginTop: '14px' }}>
            <div className="mform-field">
              <label className="mform-label">Issued By</label>
              <select
                className="mform-select"
                value={form.issuedBy}
                onChange={e => set('issuedBy', e.target.value)}
              >
                {personnelList.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="mform-field">
              <label className="mform-label">Remarks</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Machine 2 Rope Extrusion"
                value={form.remarks}
                onChange={e => set('remarks', e.target.value)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn confirm" style={{ background: '#7c3aed' }}>
              <CheckCircle2 size={16} /> Issue to Factory
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
