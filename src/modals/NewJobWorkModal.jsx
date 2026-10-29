import { useState, useEffect } from 'react';
import { X, Calculator, Truck, FileText, Layers, UserCheck, Warehouse, Scale, PackageCheck, Plus, CheckCircle2 } from 'lucide-react';
import { createJobWork, ARTICLE_TARE_DEFAULTS, JW_PROCESS_LIST, getNextChallanNumber } from '../api/jobwork.api';
import { subscribeRawMaterials } from '../api/inventory.api';
import { 
  subscribeVendors, 
  subscribePersonnel, 
  subscribeTareStandards, 
  subscribeCompanyProfile,
  subscribeJobWorkRates,
  getPartyRateByProcess,
  DEFAULT_PERSONNEL, 
  DEFAULT_TARE_STANDARDS,
  DEFAULT_COMPANY_PROFILE 
} from '../api/directory.api';
import { subscribeProcesses } from '../api/process.api';
import { subscribeLocations } from '../api/locations.api';
import SearchableSelect from '../components/SearchableSelect';
import { showAlert } from '../context/CustomAlertContext';
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
  const [personnelList, setPersonnelList] = useState(DEFAULT_PERSONNEL);
  const [tareStandards, setTareStandards] = useState(DEFAULT_TARE_STANDARDS);
  const [liveProcesses, setLiveProcesses] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(DEFAULT_COMPANY_PROFILE);
  const [liveJwRates, setLiveJwRates] = useState([]);

  useEffect(() => {
    const unsubRm = subscribeRawMaterials(setLiveMaterials);
    const unsubVe = subscribeVendors(setLiveVendors);
    const unsubPers = subscribePersonnel(setPersonnelList);
    const unsubTare = subscribeTareStandards(setTareStandards);
    const unsubRates = subscribeJobWorkRates(setLiveJwRates);
    const unsubProc = subscribeProcesses((procs) => {
      setLiveProcesses(procs);
      if (procs && procs.length > 0) {
        setForm(f => {
          if (!f.processId || !f.processType) {
            const first = procs[0];
            return {
              ...f,
              department: first.processName || f.department,
              processType: first.processName,
              processId: first.processCode || first.id,
              isFixedWeight: Boolean(first.isFixedWeight),
              standardBagWeightKg: String(first.standardBagWeightKg || 50),
              bLossPct: first.expectedScrapPct !== undefined ? String(first.expectedScrapPct) : f.bLossPct
            };
          }
          return f;
        });
      }
    });
    const unsubLoc = subscribeLocations(setLiveLocations);
    const unsubComp = subscribeCompanyProfile((profile) => {
      setCompanyProfile(profile);
      if (profile?.jwPrefix) {
        setForm(f => ({ ...f, challanSeries: profile.jwPrefix }));
      }
    });

    getNextChallanNumber().then(nextCh => {
      if (nextCh?.baseChallan) {
        setForm(f => ({
          ...f,
          challanNo: nextCh.baseChallan,
          subChalNo: nextCh.subChallan || '1'
        }));
      }
    });

    return () => {
      unsubRm();
      unsubVe();
      unsubPers();
      unsubTare();
      unsubRates();
      unsubProc();
      unsubLoc();
      unsubComp();
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
    // Challan Headers matching Image 1 format (000010126 / 1 / 2)
    challanSeries: 'JW-2026-',
    challanNo: '',
    subChalNo: '1',
    workOrder: `WO-${Math.floor(1000 + Math.random() * 9000)}`,
    department: 'Job Work Extrusion',
    challanDate: today(),
    durationDays: '5',
    expectedReturn: addDays(5),

    // Source Location & Routing (supporting Double Job Work)
    sourceLocation: '',
    isDoubleJobWork: false,

    // Party & Material
    jwParty: '',
    rawMaterial: '',
    grade: '',
    processType: '',
    processId: '',
    isFixedWeight: true,
    standardBagWeightKg: '50',

    // Accessories Dispatched (Kokda, LD Bags, Outer Thela)
    includeAccessories: false,
    spoolsCount: '',
    spoolsQtyKg: '',
    ldBagsQtyKg: '',
    outerBagsCount: '',

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
    stockSource: '',
    issuedBy: DEFAULT_PERSONNEL[0],
    approvedBy: 'FINAL APPROVED',
    remarks: ''
  });

  const displayVendors = liveVendors;

  const selMaterial = liveMaterials.find(m => m.id === form.rawMaterial);
  const selParty = displayVendors.find(p => p.id === form.jwParty);

  // Calculations
  const grossWght = parseFloat(form.grossWeight) || 0;
  const boraCnt = parseFloat(form.boraCount) || 0;
  const tareRate = form.articleType === 'CUSTOM'
    ? (parseFloat(form.customTareRate) || 0)
    : getUnitTare(form.articleType);
  
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
    const procKey = form.processId || form.processType;
    
    // Priority: 1. Party-Specific Rate Master -> 2. Vendor Specific Contract Rate -> 3. Vendor Base Rate
    const partyMasterRate = getPartyRateByProcess(p?.name || partyId, form.processType, liveJwRates) ??
      getPartyRateByProcess(p?.name || partyId, form.processId, liveJwRates);
    const contractRate = p?.rateContracts?.[procKey] || p?.rateContracts?.[form.processType];
    
    const newRate = partyMasterRate !== null
      ? String(partyMasterRate)
      : (contractRate !== undefined 
          ? String(contractRate) 
          : (p && p.rate !== undefined 
              ? String(p.rate) 
              : form.processingRate));

    setForm(f => ({
      ...f,
      jwParty: partyId,
      processingRate: newRate
    }));
  };

  const handleProcessSelect = (procIdentifier) => {
    const matched = liveProcesses.find(p => p.id === procIdentifier || p.processCode === procIdentifier || p.processName === procIdentifier);
    const p = displayVendors.find(v => v.id === form.jwParty);
    const procKey = matched ? (matched.processCode || matched.processName) : procIdentifier;
    const procName = matched ? matched.processName : procIdentifier;

    const partyMasterRate = p ? (
      getPartyRateByProcess(p.name || p.id, procName, liveJwRates) ??
      getPartyRateByProcess(p.name || p.id, procKey, liveJwRates)
    ) : null;
    const contractRate = p?.rateContracts?.[procKey] || p?.rateContracts?.[matched?.processName] || p?.rateContracts?.[matched?.processCode];

    const determinedRate = partyMasterRate !== null
      ? String(partyMasterRate)
      : (contractRate !== undefined
          ? String(contractRate)
          : (p?.rate !== undefined
              ? String(p.rate)
              : form.processingRate));

    if (matched) {
      setForm(f => ({
        ...f,
        department: matched.processName,
        processType: matched.processName,
        processId: matched.processCode || matched.id,
        processingRate: determinedRate,
        isFixedWeight: Boolean(matched.isFixedWeight),
        standardBagWeightKg: String(matched.standardBagWeightKg || 50),
        bLossPct: matched.expectedScrapPct !== undefined ? String(matched.expectedScrapPct) : f.bLossPct
      }));
    } else {
      setForm(f => ({
        ...f,
        department: procIdentifier,
        processType: procIdentifier,
        processingRate: determinedRate
      }));
    }
  };

  const handleSourceLocationSelect = (locName) => {
    const matched = liveLocations.find(l => l.name === locName || l.locationCode === locName);
    const isDouble = matched ? matched.type === 'JOB_WORKER' : false;
    setForm(f => ({
      ...f,
      sourceLocation: locName,
      isDoubleJobWork: isDouble
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
      await showAlert('Please enter a valid Gross Weight greater than 0 KG.', { type: 'warning', title: 'Required Field' });
      return;
    }
    const availInFactory = Number(selMaterial?.availFactory) || 0;
    if (selMaterial && netWeight > availInFactory) {
      await showAlert(`Cannot issue ${netWeight.toLocaleString()} KG! Factory stock only has ${availInFactory.toLocaleString()} KG available.`, { type: 'warning', title: 'Insufficient Stock' });
      return;
    }

    const vendorLabel = selParty ? (selParty.name || selParty.label || 'Job Worker') : 'Job Worker';
    const matLabel = selMaterial ? (selMaterial.name || selMaterial.label || 'Raw Material') : 'Raw Material';
    const finalRate = Number(form.processingRate) || (selParty?.rate ? Number(selParty.rate) : currentRate);

    try {
      const autoNum = Math.floor(1000 + Math.random() * 9000);
      const formattedChallan = form.challanNo ? `${form.challanNo} / ${form.subChalNo || '1'}` : String(autoNum);
      const payload = {
        jwNo: `CH-${form.challanNo || autoNum}`,
        chNo: formattedChallan,
        challanNo: form.challanNo || String(autoNum),
        challanSeries: form.challanSeries,
        subChalNo: form.subChalNo || '1',
        workOrder: form.workOrder,
        department: form.department,
        // Routing & Locations
        sourceLocation: form.sourceLocation || 'KPI Godown',
        isDoubleJobWork: Boolean(form.isDoubleJobWork),
        vendor: vendorLabel,
        vendorId: form.jwParty || null,
        targetLocation: vendorLabel,
        // Process linkage
        process: form.processType,
        processId: form.processId || '',
        isFixedWeight: Boolean(form.isFixedWeight),
        standardBagWeightKg: Number(form.standardBagWeightKg || 50),
        // Dispatched Accessories
        spoolsCount: Number(form.spoolsCount || 0),
        spoolsQtyKg: Number(form.spoolsQtyKg || 0),
        ldBagsQtyKg: Number(form.ldBagsQtyKg || 0),
        outerBagsCount: Number(form.outerBagsCount || 0),
        // Material & Weights
        rawMat: matLabel,
        grade: form.grade || selMaterial?.grade || '',
        rawMaterialId: form.rawMaterial || null,
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
        stockSource: form.sourceLocation || form.stockSource || 'Factory Silo Bay A-1',
        issuedBy: form.issuedBy || 'SURESHBHAI',
        approvedBy: form.approvedBy || 'FINAL APPROVED',
        remarks: form.remarks || ''
      };

      if (onSave) {
        await onSave(payload);
      } else {
        await createJobWork(payload);
      }
      await showAlert(`Job Work Outward Challan ${payload.jwNo} generated successfully for ${vendorLabel} (${netWeight.toFixed(2)} KG)!`, {
        type: 'success',
        title: 'Challan Generated'
      });
    } catch (err) {
      console.error('Error creating job work:', err);
      await showAlert('Failed to issue Job Work Challan. Please check connection.', { type: 'error' });
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
                <label className="mform-label">Department</label>
                <select className="mform-select" value={form.department} onChange={e => handleProcessSelect(e.target.value)}>
                  {liveProcesses.map(proc => {
                    const pName = proc.processName || proc.name || proc;
                    return <option key={proc.id || pName} value={pName}>{pName}</option>;
                  })}
                </select>
              </div>

              <div className="mform-field">
                <label className="mform-label">Work Order</label>
                <input type="text" className="mform-input" value={form.workOrder} onChange={e => set('workOrder', e.target.value)} required />
              </div>
              <div className="mform-field">
                <label className="mform-label">Challan Series</label>
                <select className="mform-select" value={form.challanSeries} onChange={e => set('challanSeries', e.target.value)}>
                  <option value={companyProfile?.jwPrefix || 'JW-2026-'}>
                    {companyProfile?.jwPrefix || 'JW-2026-'} (Company Standard)
                  </option>
                  <option value="CH-">CH- (Direct Challan)</option>
                  <option value="EXT-">EXT- (Extrusion Issue)</option>
                </select>
              </div>
            </div>

            <div className="mform-row mform-col-4" style={{ marginTop: '10px' }}>
              <div className="mform-field">
                <label className="mform-label">Challan Base No. (Padded)</label>
                <input 
                  type="text" 
                  className="mform-input" 
                  value={form.challanNo} 
                  onChange={e => set('challanNo', e.target.value)} 
                  placeholder="000010126" 
                  style={{ fontWeight: 700, fontFamily: 'monospace' }}
                />
              </div>
              <div className="mform-field">
                <label className="mform-label">Sub Challan</label>
                <input 
                  type="text" 
                  className="mform-input" 
                  value={form.subChalNo} 
                  onChange={e => set('subChalNo', e.target.value)} 
                  placeholder="1" 
                  style={{ fontWeight: 700, textAlign: 'center' }}
                />
              </div>
              <div className="mform-field">
                <label className="mform-label">Challan Reference (Image 1)</label>
                <input 
                  type="text" 
                  className="mform-input" 
                  value={`${form.challanNo || '000010126'} / ${form.subChalNo || '1'}`} 
                  readOnly 
                  style={{ background: '#f8fafc', fontWeight: 'bold', color: '#1e293b', fontFamily: 'monospace' }} 
                />
              </div>
              <div className="mform-field">
                <label className="mform-label">Date <span className="req">*</span></label>
                <input type="date" className="mform-input" value={form.challanDate} onChange={e => set('challanDate', e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Section 2: Party & Material Details */}
          <div className="mform-section">
            <div className="mform-section-title">
              <Layers size={15} className="msec-icon" />
              LOCATION ROUTING, VENDOR &amp; MATERIAL SPECIFICATIONS
            </div>

            <div className="mform-row mform-col-2">
              <div className="mform-field">
                <label className="mform-label">
                  <Warehouse size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  Source Godown / Origin <span className="req">*</span>
                </label>
                <SearchableSelect
                  value={form.sourceLocation}
                  onChange={val => handleSourceLocationSelect(val)}
                  options={liveLocations.map(loc => ({
                    value: loc.name,
                    label: loc.name,
                    sublabel: loc.type === 'JOB_WORKER' ? '⚡ Outside Job Worker / Double JW' : 'Internal Godown'
                  }))}
                  placeholder="-- Select Origin Location --"
                  searchPlaceholder="Search warehouse, silo, job worker site..."
                  required
                />
                {form.isDoubleJobWork && (
                  <div className="mform-hint" style={{ color: '#ea580c', fontWeight: 600 }}>
                    ⚡ Double Job Work Active: Dispatched directly from third-party processor site!
                  </div>
                )}
              </div>

              <div className="mform-field">
                <label className="mform-label">Target Vendor / Job Worker <span className="req">*</span></label>
                <SearchableSelect
                  value={form.jwParty}
                  onChange={val => handlePartySelect(val)}
                  options={displayVendors.map(p => ({
                    value: p.id,
                    label: p.name || 'Vendor',
                    sublabel: `${p.location || 'Gujarat'} • ${p.processBadge || 'Processor'}`
                  }))}
                  placeholder="-- Select Vendor / Job Worker --"
                  searchPlaceholder="Search vendor name, city or process..."
                  required
                />
                {selParty && (
                  <div className="mform-hint">
                    Location: {selParty.location || 'Gujarat'} • GST: {selParty.gst || 'N/A'}
                  </div>
                )}
              </div>
            </div>

            <div className="mform-row mform-col-2" style={{ marginTop: '10px' }}>
              <div className="mform-field">
                <label className="mform-label">Raw Material <span className="req">*</span></label>
                <SearchableSelect
                  value={form.rawMaterial}
                  onChange={val => handleMaterialSelect(val)}
                  options={liveMaterials.map(m => ({
                    value: m.id,
                    label: `${m.name || 'Raw Material'} (${m.grade || m.code || m.id})`,
                    sublabel: `Stock: ${m.availFactory || 0} KG • ${m.brand || ''}`
                  }))}
                  placeholder="-- Select Polymer Material --"
                  searchPlaceholder="Search raw material, grade, brand..."
                  required
                />
                {selMaterial && (
                  <div className="mform-hint">
                    Grade: <span className="hint-green">{selMaterial.grade || 'Standard'}</span> • Available: <span className="hint-green">{selMaterial.availFactory || 0} KG</span>
                  </div>
                )}
              </div>

              <div className="mform-field">
                <label className="mform-label">
                  <Scale size={13} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                  Process Master <span className="req">*</span>
                </label>
                <SearchableSelect
                  value={form.processType}
                  onChange={val => handleProcessSelect(val)}
                  options={liveProcesses.map(p => ({
                    value: p.processName,
                    label: p.processName,
                    sublabel: p.isFixedWeight ? `Fixed: ${p.standardBagWeightKg} KG/bag` : 'Variable weight'
                  }))}
                  placeholder="-- Select Process Master --"
                  searchPlaceholder="Search processes (e.g. Yarn, Twine, Extrusion)..."
                  required
                />
                {form.isFixedWeight && (
                  <div className="mform-hint" style={{ color: '#2563eb', fontWeight: 500 }}>
                    ✓ Standard Fixed Bag Weight: {form.standardBagWeightKg} KG per bag
                  </div>
                )}
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
                <label className="mform-label">Gross Weight <span className="req">*</span></label>
                <input
                  type="number" step="0.1" className="mform-input" placeholder="e.g. 5000"
                  value={form.grossWeight} onChange={e => set('grossWeight', e.target.value)}
                  min="0.1" required
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">No. of BORA</label>
                <input
                  type="number" className="mform-input" placeholder="e.g. 200"
                  value={form.boraCount} onChange={e => set('boraCount', e.target.value)}
                  min="0"
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">Article Type</label>
                <SearchableSelect
                  value={form.articleType}
                  onChange={val => set('articleType', val)}
                  options={[
                    { value: 'BORA', label: 'BORA (0.200 KG / Bag)' },
                    { value: 'PLASTIC CONE', label: 'PLASTIC CONE (0.025 KG / Cone)' },
                    { value: 'KHALI BAG', label: 'KHALI BAG (0.120 KG / Bag)' },
                    { value: 'THELI', label: 'THELI (0.015 KG / Bag)' },
                    { value: 'CUSTOM', label: 'Custom Tare Rate' },
                    { value: 'NONE', label: 'NONE (Zero Tare)' }
                  ]}
                  placeholder="-- Select Article Type --"
                  searchPlaceholder="Search article type..."
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">Article Weight</label>
                <div className="mform-calc-field">
                  <span className="calc-value">{articleTareWeight.toFixed(2)} KG</span>
                  <span className="calc-note">({boraCnt} × {tareRate} kg)</span>
                </div>
              </div>
            </div>

            {/* Net Weight & Burning Loss Row */}
            <div className="mform-row mform-col-4" style={{ marginTop: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
              <div className="mform-field">
                <label className="mform-label" style={{ fontWeight: 'bold', color: '#1e293b' }}>Net Weight</label>
                <div className="mform-calc-field" style={{ background: '#e0f2fe', borderColor: '#38bdf8' }}>
                  <span className="calc-value" style={{ color: '#0284c7', fontWeight: 'bold' }}>
                    {netWeight.toFixed(2)} KG
                  </span>
                </div>
              </div>

              <div className="mform-field">
                <label className="mform-label">B. Loss %</label>
                <input
                  type="number" step="0.1" min="0" max="50" className="mform-input" placeholder="0.0"
                  value={form.bLossPct} onChange={e => set('bLossPct', e.target.value)}
                />
              </div>

              <div className="mform-field">
                <label className="mform-label">B. Loss</label>
                <div className="mform-calc-field">
                  <span className="calc-value">{bLossKg.toFixed(2)} KG</span>
                  <span className="calc-note">Process Loss</span>
                </div>
              </div>

              <div className="mform-field">
                <label className="mform-label" style={{ fontWeight: 'bold', color: '#15803d' }}>Net Weight (final)</label>
                <div className="mform-calc-field" style={{ background: '#dcfce7', borderColor: '#86efac' }}>
                  <span className="calc-value" style={{ color: '#15803d', fontWeight: 'bold' }}>
                    {netOutwardExpectedKg.toFixed(2)} KG
                  </span>
                </div>
              </div>
            </div>

            {/* Sample Pieces & Count Row */}
            <div className="mform-row mform-col-4" style={{ marginTop: '12px' }}>
              <div className="mform-field">
                <label className="mform-label">PCs.</label>
                <input type="number" className="mform-input" placeholder="Optional" value={form.pieces} onChange={e => set('pieces', e.target.value)} />
              </div>
              <div className="mform-field">
                <label className="mform-label">Auto Pcs</label>
                <input type="text" className="mform-input" readOnly style={{ background: '#f8fafc', fontWeight: 'bold' }} value={form.pieces || (boraCnt ? `${boraCnt * 10} PCs` : '—')} />
              </div>
              <div className="mform-field">
                <label className="mform-label">Sample PCs.</label>
                <input type="number" className="mform-input" placeholder="e.g. 10" value={form.samplePcs} onChange={e => set('samplePcs', e.target.value)} />
              </div>
              <div className="mform-field">
                <label className="mform-label">Sample Pcs Weight</label>
                <input type="number" step="0.01" className="mform-input" placeholder="e.g. 0.50" value={form.sampleWeight} onChange={e => set('sampleWeight', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Section 3B: Dispatched Accessories & Packaging Materials (Kokda, LD Bags, Outer Thela) */}
          <div className="mform-section" style={{ background: '#f0fdf4', padding: '14px', borderRadius: '8px', border: '1px solid #bbf7d0', marginTop: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.includeAccessories ? 12 : 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 600, color: '#166534', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  style={{ width: 16, height: 16, accentColor: '#16a34a', cursor: 'pointer' }}
                  checked={form.includeAccessories}
                  onChange={e => set('includeAccessories', e.target.checked)}
                />
                Include Dispatched Accessories (Kokda Spools, LD Inner Bags, Outer Thela)
              </label>
              <span style={{ fontSize: '11px', color: '#15803d' }}>
                {form.includeAccessories ? '✓ Accessories Ledger Dispatched' : 'No accessories sent'}
              </span>
            </div>

            {form.includeAccessories && (
              <div className="mform-row mform-col-4" style={{ marginTop: '10px' }}>
                <div className="mform-field">
                  <label className="mform-label">Kokda (Spools) Wt (KG)</label>
                  <input
                    type="number" step="0.1" min="0" className="mform-input" placeholder="e.g. 50.0"
                    value={form.spoolsQtyKg} onChange={e => set('spoolsQtyKg', e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Plastic rolls / tubes</span>
                </div>
                <div className="mform-field">
                  <label className="mform-label">Kokda (Spools) Count</label>
                  <input
                    type="number" min="0" className="mform-input" placeholder="e.g. 200"
                    value={form.spoolsCount} onChange={e => set('spoolsCount', e.target.value)}
                  />
                </div>
                <div className="mform-field">
                  <label className="mform-label">LD Inner Bags (KG)</label>
                  <input
                    type="number" step="0.1" min="0" className="mform-input" placeholder="e.g. 25.0"
                    value={form.ldBagsQtyKg} onChange={e => set('ldBagsQtyKg', e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Inner thin polybags</span>
                </div>
                <div className="mform-field">
                  <label className="mform-label">Outer Thela / Bags (Qty)</label>
                  <input
                    type="number" min="0" className="mform-input" placeholder="e.g. 50"
                    value={form.outerBagsCount} onChange={e => set('outerBagsCount', e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>Big outer packing bags</span>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Financials & Rate Master */}
          <div className="mform-row mform-col-3" style={{ marginTop: '14px' }}>
            <div className="mform-field">
              <label className="mform-label">Processing Rate (₹ / KG) <span className="req">*</span></label>
              <input type="number" step="0.01" className="mform-input" placeholder="5.00" value={form.processingRate} onChange={e => set('processingRate', e.target.value)} required />
              <div className="mform-hint" style={{ color: '#059669', fontWeight: 500 }}>
                {(() => {
                  const p = displayVendors.find(v => v.id === form.jwParty);
                  const procKey = form.processId || form.processType;
                  const partyMasterRate = p ? (
                    getPartyRateByProcess(p.name || p.id, form.processType, liveJwRates) ??
                    getPartyRateByProcess(p.name || p.id, procKey, liveJwRates)
                  ) : null;
                  if (partyMasterRate !== null && String(partyMasterRate) === String(form.processingRate)) {
                    return `✓ From JW Rate Master for ${form.processType} (${p?.name || 'Party'})`;
                  }
                  const contractRate = p?.rateContracts?.[procKey] || p?.rateContracts?.[form.processType];
                  if (contractRate !== undefined && String(contractRate) === String(form.processingRate)) {
                    return `✓ Rate Contract for ${p?.name || 'Vendor'} (${form.processType})`;
                  }
                  if (p && String(p.rate) === String(form.processingRate)) {
                    return `✓ Vendor Base Rate for ${p.name || 'Vendor'}`;
                  }
                  return form.processingRate ? `✓ Rate for ${form.processType}` : 'Rate from JW Rate Master';
                })()}
              </div>
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
                <SearchableSelect
                  value={form.issuedBy}
                  onChange={val => set('issuedBy', val)}
                  options={personnelList}
                  placeholder="-- Select Signatory --"
                  searchPlaceholder="Search supervisor..."
                />
              </div>
              <div className="mform-field">
                <label className="mform-label">Final Approval</label>
                <input type="text" className="mform-input" value={form.approvedBy} onChange={e => set('approvedBy', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Remarks */}
          <div className="mform-field" style={{ marginTop: '10px' }}>
            <label className="mform-label">Remarks</label>
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

