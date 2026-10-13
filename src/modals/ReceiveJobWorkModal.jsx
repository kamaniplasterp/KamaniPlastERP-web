import { useState, useEffect } from 'react';
import { X, FileText, Calculator, Layers, CheckCircle2, Plus, Trash2, Building, Warehouse, Scale, DollarSign, PackageCheck, AlertTriangle } from 'lucide-react';
import { ARTICLE_TARE_DEFAULTS } from '../api/jobwork.api';
import { subscribeScrapStock } from '../api/inventory.api';
import { 
  subscribePersonnel, 
  subscribeTareStandards, 
  DEFAULT_PERSONNEL, 
  DEFAULT_TARE_STANDARDS 
} from '../api/directory.api';
import { subscribeLocations, DEFAULT_LOCATIONS_LIST } from '../api/locations.api';
import { subscribeProductAttributes, DEFAULT_PRODUCT_ATTRIBUTES } from '../api/productMatrix.api';
import { subscribeProcesses, DEFAULT_PROCESS_LIST } from '../api/process.api';
import '../styles/Modals.css';

export default function ReceiveJobWorkModal({ row, onClose, onSave }) {
  const jwId = row?.jwNo || row?.id || 'JW-ORDER';
  const chNo = row?.chNo || row?.challan || jwId;
  const party = row?.vendor || row?.party || 'Job Worker';
  const defaultRate = Number(row?.ratePerKg || row?.charges || 17.5);
  const pendingMax = Number(row?.balQtyKg !== undefined ? row.balQtyKg : (row?.pendingQty ? parseFloat(String(row.pendingQty).replace(/[^0-9.]/g, '')) : 0));
  const stdBagWeight = Number(row?.standardBagWeightKg || 50);

  const [personnelList, setPersonnelList] = useState(DEFAULT_PERSONNEL);
  const [tareStandards, setTareStandards] = useState(DEFAULT_TARE_STANDARDS);
  const [liveLocations, setLiveLocations] = useState(DEFAULT_LOCATIONS_LIST);
  const [liveProcesses, setLiveProcesses] = useState(DEFAULT_PROCESS_LIST);
  const [productAttrs, setProductAttrs] = useState(DEFAULT_PRODUCT_ATTRIBUTES);

  useEffect(() => {
    const unsubP = subscribePersonnel((list) => {
      setPersonnelList(list);
      if (list && list.length > 0) {
        setForm(f => f.receivedBy ? f : { ...f, receivedBy: list[0] });
      }
    });
    const unsubT = subscribeTareStandards(setTareStandards);
    const unsubL = subscribeLocations((locs) => {
      setLiveLocations(locs);
      const internals = locs.filter(l => l.type === 'INTERNAL');
      if (internals.length > 0) {
        setForm(f => f.targetGodown ? f : { ...f, targetGodown: internals[0].name });
      }
    });
    const unsubAttr = subscribeProductAttributes(setProductAttrs);
    const unsubProc = subscribeProcesses(setLiveProcesses);
    const unsubScrap = subscribeScrapStock((scrap) => {
      if (scrap?.defaultRate) {
        setForm(f => ({ ...f, scrapRatePerKg: String(scrap.defaultRate) }));
      }
    });
    return () => {
      unsubP();
      unsubT();
      unsubL();
      unsubAttr();
      unsubProc();
      unsubScrap();
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

    // Accessories Remaining with worker
    spoolsRemainingKg: '0',
    ldBagsRemainingKg: '0',
    outerBagsRemainingCount: '0',

    // Raw Material with worker & Scrap Rate
    rawMaterialRemainingKg: '0',
    scrapRatePerKg: '70.00',

    // QA & Segregation
    reworkQty: '0',
    rejectionQty: '0',
    scrapQty: '',
    qualityStatus: 'Approved',
    samplePcs: '10',
    sampleWeight: '0.50',

    // Personnel & Finance & Location
    receivedBy: DEFAULT_PERSONNEL[4] || 'RAMILBHAI',
    ratePerKg: String(defaultRate),
    targetGodown: 'KPI Godown',
    location: 'KPI Godown - Main Floor',
    notes: '',

    // Bag Serials
    generateBags: true,
    quality: row?.grade || 'ANDN',
    size: '3x3',
    coilCountPerBag: '12',
    standardBagWeightKg: String(stdBagWeight)
  });

  // Variant Inward Line Items Breakdown (Matching Physical Register Image 2 / 28 MAR)
  const defaultInitBags = Math.max(1, Math.round(pendingMax / (stdBagWeight || 50)));
  const [variantRows, setVariantRows] = useState([
    {
      id: 1,
      quality: row?.grade || 'ANCHOR',
      size: '3x3',
      form: 'Hanks',
      length: 'Standard',
      tracerLine: 'No Tracer Line',
      bagCount: String(defaultInitBags),
      bagWeightKg: String(stdBagWeight || 50),
      totalKg: defaultInitBags * (stdBagWeight || 50)
    }
  ]);

  const handleAddVariantRow = () => {
    const last = variantRows[variantRows.length - 1];
    setVariantRows(prev => [
      ...prev,
      {
        id: Date.now(),
        quality: last?.quality || row?.grade || 'ANCHOR',
        size: '4x3',
        form: last?.form || 'Hanks',
        length: 'Standard',
        tracerLine: 'No Tracer Line',
        bagCount: '10',
        bagWeightKg: String(stdBagWeight || 50),
        totalKg: 10 * (stdBagWeight || 50)
      }
    ]);
  };

  const handleRemoveVariantRow = (idx) => {
    if (variantRows.length <= 1) return;
    setVariantRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleVariantChange = (idx, field, val) => {
    setVariantRows(prev => {
      const updated = [...prev];
      const target = { ...updated[idx], [field]: val };
      const cnt = parseFloat(field === 'bagCount' ? val : target.bagCount) || 0;
      const wt = parseFloat(field === 'bagWeightKg' ? val : target.bagWeightKg) || stdBagWeight;
      target.totalKg = cnt * wt;
      updated[idx] = target;
      return updated;
    });
  };

  const totalVariantBags = variantRows.reduce((sum, r) => sum + (parseFloat(r.bagCount) || 0), 0);
  const totalVariantKg = variantRows.reduce((sum, r) => sum + (parseFloat(r.totalKg) || 0), 0);

  // Multi-article rows (up to 4 rows from Excel JW-Inward)
  const [articleRows, setArticleRows] = useState([
    {
      id: 1,
      articleType: 'BORA',
      count: String(Math.round(pendingMax / (stdBagWeight || 25)) || '1'),
      unitTare: 0.200
    }
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  const applyBreakdownToGross = () => {
    const calculatedGross = totalVariantKg + accessoriesTareDeduction + totalTareKg;
    set('grossWeight', calculatedGross.toFixed(2));
    setArticleRows(prev => prev.map((r, i) => i === 0 ? { ...r, count: String(totalVariantBags) } : r));
  };

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

  // Bora count for packaging reconciliation
  const boraRow = articleRows.find(r => r.articleType === 'BORA');
  const recBoraCount = boraRow ? (parseFloat(boraRow.count) || 0) : 0;

  // Accessories consumption math
  const spoolsSent = Number(row?.spoolsQtyKg || 0);
  const spoolsRemaining = parseFloat(form.spoolsRemainingKg) || 0;
  const spoolsUsed = Math.max(0, spoolsSent - spoolsRemaining);

  const ldBagsSent = Number(row?.ldBagsQtyKg || 0);
  const ldBagsRemaining = parseFloat(form.ldBagsRemainingKg) || 0;
  const ldBagsUsed = Math.max(0, ldBagsSent - ldBagsRemaining);

  const outerBagsSent = Number(row?.outerBagsCount || 0);
  const outerBagsRemaining = parseFloat(form.outerBagsRemainingCount) || 0;
  const outerBagsUsed = Math.max(0, outerBagsSent - outerBagsRemaining);

  const accessoriesTareDeduction = spoolsUsed + ldBagsUsed;

  const gross = parseFloat(form.grossWeight) || 0;
  // Deduct used accessories and standard article tare
  const calculatedNetKg = gross > 0 ? Math.max(0, gross - accessoriesTareDeduction - totalTareKg) : 0;

  // Raw material & Scrap math
  const sentRM = Number(row?.sentQtyKg || pendingMax || 0);
  const rmRemaining = parseFloat(form.rawMaterialRemainingKg) || 0;
  const rmConsumed = Math.max(0, sentRM - rmRemaining);
  const autoCalculatedScrapKg = Math.max(0, rmConsumed - calculatedNetKg);
  const finalScrapKg = form.scrapQty !== '' ? (parseFloat(form.scrapQty) || 0) : autoCalculatedScrapKg;

  const reworkKg = parseFloat(form.reworkQty) || 0;
  const rejectionKg = parseFloat(form.rejectionQty) || 0;
  const acceptedKg = Math.max(0, calculatedNetKg - reworkKg - rejectionKg - finalScrapKg);

  const rateKg = parseFloat(form.ratePerKg) || 0;
  const processingPayable = calculatedNetKg * rateKg;
  const scrapRate = parseFloat(form.scrapRatePerKg) || 70;
  const scrapRebate = finalScrapKg * scrapRate;
  const netPayable = Math.max(0, processingPayable - scrapRebate);

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
      // Always generate sequential bags automatically for every receipt
      let bagsList = [];
      if (totalVariantKg > 0 || calculatedNetKg > 0) {
        let serialCounter = 1;
        const rowsToProcess = (variantRows && variantRows.length > 0 && totalVariantBags > 0)
          ? variantRows
          : [{
              quality: form.quality || row?.grade || 'VIP',
              size: form.size || '3x3',
              form: 'Hanks',
              length: 'Standard',
              tracerLine: 'No Tracer Line',
              bagCount: String(Math.max(1, Math.round(calculatedNetKg / (stdBagWeight || 50)))),
              bagWeightKg: String(stdBagWeight || 50)
            }];

        rowsToProcess.forEach((vr) => {
          const cnt = parseInt(vr.bagCount, 10) || 0;
          const wt = parseFloat(vr.bagWeightKg) || stdBagWeight;
          const coils = Number(form.coilCountPerBag || 12);
          for (let b = 1; b <= cnt; b++) {
            bagsList.push({
              bagNumber: serialCounter++,
              actualWeightKg: wt,
              standardWeightKg: stdBagWeight,
              coilCount: coils,
              stockType: Math.abs(wt - stdBagWeight) <= 0.5 ? 'FIXED' : 'LOOSE',
              quality: vr.quality || form.quality || row?.grade || 'VIP',
              size: vr.size || '3x3',
              form: vr.form || 'Hanks',
              length: vr.length || 'Standard',
              tracerLine: vr.tracerLine || 'No Tracer Line',
              grade: vr.quality || form.quality || row?.grade || 'VIP',
              lotNo: row?.batch || form.inwardSlipNo,
              batch: row?.batch || form.inwardSlipNo,
              sourceChallan: chNo,
              vendor: party,
              location: form.targetGodown
            });
          }
        });
      }

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
          recBoraCount: totalVariantBags > 0 ? totalVariantBags : recBoraCount,
          articleRows: articleRows,
          lineItems: variantRows,
          bagsList,
          recArticleType: articleRows.map(r => r.articleType).join(', '),
          recArticleWeight: totalTareKg,
          recQtyKg: calculatedNetKg,
          acceptedQty: acceptedKg,
          reworkQtyKg: reworkKg,
          rejectionQtyKg: rejectionKg,
          scrapQtyKg: finalScrapKg,
          samplePcs: Number(form.samplePcs || 0),
          sampleWeight: Number(form.sampleWeight || 0),
          receivedBy: form.receivedBy,
          ratePerKg: rateKg,
          value: processingPayable,
          qualityStatus: form.qualityStatus,
          location: form.location,
          notes: form.notes,
          // Accessories Reconciliation
          spoolsRemainingKg: parseFloat(form.spoolsRemainingKg) || 0,
          ldBagsRemainingKg: parseFloat(form.ldBagsRemainingKg) || 0,
          outerBagsRemainingCount: parseFloat(form.outerBagsRemainingCount) || 0,
          rawMaterialRemainingKg: parseFloat(form.rawMaterialRemainingKg) || 0,
          scrapRatePerKg: scrapRate,
          targetGodown: form.targetGodown,
          bagsList: bagsList
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
                {liveProcesses.map(proc => {
                  const pName = proc.processName || proc.name || proc;
                  return <option key={proc.id || pName} value={pName}>{pName}</option>;
                })}
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

          {/* Section 1B: Accessories Usage Reconciliation (Kokda, LD Bags, Outer Thela) */}
          {(spoolsSent > 0 || ldBagsSent > 0 || outerBagsSent > 0) && (
            <div className="mform-section" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '12px 14px', borderRadius: '8px', marginTop: '10px' }}>
              <div className="mform-section-title" style={{ color: '#166534', margin: 0, marginBottom: '8px' }}>
                <PackageCheck size={15} className="msec-icon" style={{ color: '#16a34a' }} />
                ACCESSORIES RECONCILIATION &amp; WEIGHT DEDUCTION (KOKDA, LD BAGS, THELA)
              </div>
              <p style={{ fontSize: '0.75rem', color: '#15803d', margin: '0 0 10px 0' }}>
                Enter remaining accessories returned by worker. System will deduce used accessories tare from gross inward weight.
              </p>

              <div className="mform-row mform-col-3">
                <div className="mform-field">
                  <label className="mform-label">
                    Kokda (Spools) Left (KG)
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 4 }}>(Sent: {spoolsSent} kg)</span>
                  </label>
                  <input
                    type="number" step="0.1" min="0" max={spoolsSent || 9999}
                    className="mform-input"
                    value={form.spoolsRemainingKg}
                    onChange={e => set('spoolsRemainingKg', e.target.value)}
                  />
                  <div className="mform-hint" style={{ color: '#15803d', fontWeight: 600 }}>
                    Used Kokda: {spoolsUsed.toFixed(1)} KG
                  </div>
                </div>

                <div className="mform-field">
                  <label className="mform-label">
                    LD Bags Left (KG)
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 4 }}>(Sent: {ldBagsSent} kg)</span>
                  </label>
                  <input
                    type="number" step="0.1" min="0" max={ldBagsSent || 9999}
                    className="mform-input"
                    value={form.ldBagsRemainingKg}
                    onChange={e => set('ldBagsRemainingKg', e.target.value)}
                  />
                  <div className="mform-hint" style={{ color: '#15803d', fontWeight: 600 }}>
                    Used LD: {ldBagsUsed.toFixed(1)} KG
                  </div>
                </div>

                <div className="mform-field">
                  <label className="mform-label">
                    Outer Thela Left (Qty)
                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 4 }}>(Sent: {outerBagsSent})</span>
                  </label>
                  <input
                    type="number" min="0" max={outerBagsSent || 9999}
                    className="mform-input"
                    value={form.outerBagsRemainingCount}
                    onChange={e => set('outerBagsRemainingCount', e.target.value)}
                  />
                  <div className="mform-hint" style={{ color: '#15803d', fontWeight: 600 }}>
                    Used Thela: {outerBagsUsed} bags
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '8px', padding: '6px 10px', background: 'rgba(22, 101, 52, 0.08)', borderRadius: '6px', fontSize: '0.78rem', color: '#166534', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>Total Accessories Tare Deducted:</strong> {spoolsUsed.toFixed(1)} kg (Spools) + {ldBagsUsed.toFixed(1)} kg (LD)</span>
                <span style={{ fontWeight: 700, color: '#15803d' }}>= {accessoriesTareDeduction.toFixed(1)} KG</span>
              </div>
            </div>
          )}

          {/* Weight & Multi-Article Tare Matrix (Sheet: JW-Inward Multi Article Rows) */}
          <div className="mform-section" style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: '14px', borderRadius: '8px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div className="mform-section-title" style={{ color: '#c2410c', margin: 0 }}>
                <Calculator size={15} className="msec-icon" style={{ color: '#ea580c' }} />
                INWARD WEIGHT &amp; NET PRODUCT RECONCILIATION
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
                <label className="mform-label">Gross Received (KG) <span className="req">*</span></label>
                <input
                  type="number" step="0.1" className="mform-input"
                  value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)}
                  min="0.1" required
                />
              </div>
              <div className="mform-field">
                <label className="mform-label">No. of Bags Received</label>
                <input
                  type="number" className="mform-input"
                  value={recBoraCount}
                  readOnly
                  style={{ background: '#f8fafc', fontWeight: 'bold' }}
                />
              </div>
              <div className="mform-field">
                <label className="mform-label">Total Tare (Acc + Bags)</label>
                <div className="mform-calc-field" style={{ background: '#fef3c7', borderColor: '#fcd34d' }}>
                  <span className="calc-value" style={{ color: '#b45309', fontWeight: 'bold' }}>
                    {(totalTareKg + accessoriesTareDeduction).toFixed(2)} KG
                  </span>
                </div>
              </div>
              <div className="mform-field">
                <label className="mform-label" style={{ color: '#9a3412', fontWeight: 'bold' }}>Net Finished Product</label>
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
                <div>Article Tare</div>
                <div style={{ textAlign: 'right', paddingRight: '6px' }}>Total Article Tare</div>
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
                        <option value="BORA">BORA ({tareStandards.bora || 0.200} KG)</option>
                        <option value="PLASTIC CONE">PLASTIC CONE ({tareStandards.plasticCone || 0.025} KG)</option>
                        <option value="KHALI BAG">KHALI BAG ({tareStandards.khaliBag || 0.120} KG)</option>
                        <option value="THELI">THELI ({tareStandards.theli || 0.015} KG)</option>
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

          {/* Section 2B: Raw Material Consumption & Scrap Rebate Settlement */}
          <div className="mform-section" style={{ background: '#f8fafc', border: '1px solid #cbd5e1', padding: '14px', borderRadius: '8px', marginTop: '12px' }}>
            <div className="mform-section-title" style={{ color: '#1e293b', margin: 0, marginBottom: '8px' }}>
              <Scale size={15} className="msec-icon" style={{ color: '#3b82f6' }} />
              RAW MATERIAL CONSUMPTION &amp; SCRAP REBATE SETTLEMENT
            </div>

            <div className="mform-row mform-col-4">
              <div className="mform-field">
                <label className="mform-label">
                  Unused RM at Worker (KG)
                  <span style={{ fontSize: '11px', color: '#64748b', marginLeft: 4 }}>(Sent: {sentRM} kg)</span>
                </label>
                <input
                  type="number" step="0.1" min="0" max={sentRM || 9999}
                  className="mform-input"
                  placeholder="e.g. 50.0"
                  value={form.rawMaterialRemainingKg}
                  onChange={e => set('rawMaterialRemainingKg', e.target.value)}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Consumed: {rmConsumed.toFixed(1)} KG</span>
              </div>

              <div className="mform-field">
                <label className="mform-label">Calculated Scrap (KG)</label>
                <input
                  type="number" step="0.1" min="0"
                  className="mform-input"
                  placeholder={autoCalculatedScrapKg.toFixed(1)}
                  value={form.scrapQty}
                  onChange={e => set('scrapQty', e.target.value)}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Auto: {autoCalculatedScrapKg.toFixed(1)} KG</span>
              </div>

              <div className="mform-field">
                <label className="mform-label">Scrap Rate (₹ / KG)</label>
                <input
                  type="number" step="1" min="0"
                  className="mform-input"
                  value={form.scrapRatePerKg}
                  onChange={e => set('scrapRatePerKg', e.target.value)}
                />
                <span style={{ fontSize: '11px', color: '#64748b' }}>Standard ₹70/kg</span>
              </div>

              <div className="mform-field">
                <label className="mform-label" style={{ color: '#b91c1c' }}>Scrap Rebate Deduction</label>
                <div className="mform-calc-field" style={{ background: '#fef2f2', borderColor: '#fca5a5' }}>
                  <span className="calc-value" style={{ color: '#dc2626', fontWeight: 'bold' }}>
                    - ₹{scrapRebate.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Inward Variant Breakdown & Sequential Bag Allocation (Image 2 style) */}
          <div className="mform-section" style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '14px', borderRadius: '8px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div className="mform-section-title" style={{ color: '#1e40af', margin: 0 }}>
                <Layers size={15} className="msec-icon" style={{ color: '#2563eb' }} />
                LINE-ITEM VARIANT BREAKDOWN (IMAGE 2 / 28 MAR REGISTER)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={applyBreakdownToGross}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Auto-fill gross and bora count from this breakdown"
                >
                  <Calculator size={12} /> Set Gross from Breakdown ({totalVariantKg.toFixed(1)} KG)
                </button>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '4px 10px', borderRadius: '4px', border: '1px solid #86efac' }}>
                  ✓ Auto-Generating Bag Serials
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e40af' }}>Target Godown:</label>
                <select
                  className="mform-select"
                  value={form.targetGodown}
                  onChange={e => set('targetGodown', e.target.value)}
                  style={{ width: '160px', padding: '4px 8px', fontSize: '0.78rem' }}
                  required
                >
                  {liveLocations.filter(l => l.type === 'INTERNAL').map(l => (
                    <option key={l.id || l.locationCode} value={l.name}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e40af' }}>Coils/Bag:</label>
                <input
                  type="number" min="1"
                  value={form.coilCountPerBag}
                  onChange={e => set('coilCountPerBag', e.target.value)}
                  style={{ width: '65px', padding: '4px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.78rem' }}
                />
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '4px 8px', borderRadius: '4px' }}>
                  Total: {totalVariantBags} Bags • {totalVariantKg.toFixed(1)} KG
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div style={{ background: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', overflowX: 'auto', marginBottom: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '6px 8px' }}>Quality</th>
                    <th style={{ padding: '6px 8px' }}>Size</th>
                    <th style={{ padding: '6px 8px' }}>Form</th>
                    <th style={{ padding: '6px 8px' }}>Length</th>
                    <th style={{ padding: '6px 8px' }}>Tracer Line</th>
                    <th style={{ padding: '6px 8px', width: '70px' }}>Bags</th>
                    <th style={{ padding: '6px 8px', width: '85px' }}>Bag Wt (KG)</th>
                    <th style={{ padding: '6px 8px', width: '85px', textAlign: 'right' }}>Total KG</th>
                    <th style={{ padding: '6px 8px', width: '35px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {variantRows.map((vr, idx) => (
                    <tr key={vr.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 6px' }}>
                        <select
                          value={vr.quality}
                          onChange={e => handleVariantChange(idx, 'quality', e.target.value)}
                          style={{ width: '100%', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem' }}
                        >
                          {(productAttrs.qualities || ['ANCHOR', 'VIP', 'EVEREST']).map(q => (
                            <option key={q} value={q}>{q}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <select
                          value={vr.size}
                          onChange={e => handleVariantChange(idx, 'size', e.target.value)}
                          style={{ width: '85px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                        >
                          {(productAttrs.sizes || ['3x3', '4x3', '1.5', '2', '4', '6', '7.5']).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <select
                          value={vr.form}
                          onChange={e => handleVariantChange(idx, 'form', e.target.value)}
                          style={{ width: '90px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem' }}
                        >
                          {(productAttrs.forms || ['Hanks', 'Packet', 'Cone']).map(f => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <select
                          value={vr.length}
                          onChange={e => handleVariantChange(idx, 'length', e.target.value)}
                          style={{ width: '85px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem' }}
                        >
                          {(productAttrs.lengths || ['Standard', '100 Mtr', '200 Mtr']).map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <select
                          value={vr.tracerLine}
                          onChange={e => handleVariantChange(idx, 'tracerLine', e.target.value)}
                          style={{ width: '110px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem' }}
                        >
                          {(productAttrs.tracerLines || ['No Tracer Line', 'Single Red Line']).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          type="number" min="1"
                          value={vr.bagCount}
                          onChange={e => handleVariantChange(idx, 'bagCount', e.target.value)}
                          style={{ width: '60px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '4px 6px' }}>
                        <input
                          type="number" step="0.5"
                          value={vr.bagWeightKg}
                          onChange={e => handleVariantChange(idx, 'bagWeightKg', e.target.value)}
                          style={{ width: '70px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                        {Number(vr.totalKg || 0).toFixed(1)} KG
                      </td>
                      <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                        {variantRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVariantRow(idx)}
                            style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 2 }}
                            title="Remove row"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={handleAddVariantRow}
              style={{ background: '#f8fafc', border: '1px dashed #3b82f6', color: '#2563eb', borderRadius: '4px', padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={13} /> Add Product Variant Row (Anchor 4x3, 6x3T, etc.)
            </button>
          </div>

          {/* Section 4: Rates, Net Payable & Signatories */}
          <div className="mform-row mform-col-4" style={{ marginTop: '12px' }}>
            <div className="mform-field">
              <label className="mform-label">Processing Rate (₹ / KG) <span className="req">*</span></label>
              <input type="number" step="0.01" className="mform-input" value={form.ratePerKg} onChange={e => set('ratePerKg', e.target.value)} required />
            </div>

            <div className="mform-field">
              <label className="mform-label">Gross Processing Fee</label>
              <div className="mform-calc-field">
                <span className="calc-value">₹{processingPayable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="mform-field">
              <label className="mform-label" style={{ color: '#047857', fontWeight: 'bold' }}>Net Payable to Vendor</label>
              <div className="mform-calc-field" style={{ background: '#ecfdf5', borderColor: '#6ee7b7' }}>
                <span className="calc-value" style={{ color: '#059669', fontWeight: 'bold' }}>
                  ₹{netPayable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
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
