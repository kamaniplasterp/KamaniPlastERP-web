import { useState, useEffect } from 'react';
import {
  Search, Plus, Download, Layers, Cog, Warehouse, Edit2, Trash2, Scale,
  MapPin, Users, Sparkles, Check, CheckCircle2, X, SlidersHorizontal,
  ChevronDown, ChevronUp, RefreshCw, Eye
} from 'lucide-react';
import { subscribeProcesses, deleteProcess } from '../api/process.api';
import { subscribeLocations, deleteLocation } from '../api/locations.api';
import { subscribeFinishedGoods } from '../api/inventory.api';
import { 
  subscribeProductAttributes, 
  updateProductAttributes, 
  generateMatrixCombinations, 
  generateSkuCode,
  syncMatrixToFinishedGoods, 
  DEFAULT_PRODUCT_ATTRIBUTES 
} from '../api/productMatrix.api';
import { exportToCsv } from '../utils/exportCsv';
import ProcessMasterModal from '../modals/ProcessMasterModal';
import LocationMasterModal from '../modals/LocationMasterModal';
import '../styles/DirectorySettings.css';
import '../styles/JobWorkHub.css';

export default function ProcessMastersView() {
  const [activeTab, setActiveTab] = useState('processMaster');
  const [processSearch, setProcessSearch] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [matrixSearch, setMatrixSearch] = useState('');

  const [liveProcesses, setLiveProcesses] = useState([]);
  const [liveLocations, setLiveLocations] = useState([]);
  const [productAttrs, setProductAttrs] = useState(DEFAULT_PRODUCT_ATTRIBUTES);

  const [showAddProcessModal, setShowAddProcessModal] = useState(false);
  const [selectedProcessToEdit, setSelectedProcessToEdit] = useState(null);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [selectedLocationToEdit, setSelectedLocationToEdit] = useState(null);

  // Product Matrix state
  const [matrixBaseRate, setMatrixBaseRate] = useState(220);
  const [matrixBagWeight, setMatrixBagWeight] = useState(50.0);
  const [generatedMatrix, setGeneratedMatrix] = useState([]);
  const [isSyncingMatrix, setIsSyncingMatrix] = useState(false);
  const [syncMatrixSuccess, setSyncMatrixSuccess] = useState(null);
  const [newAttrInputs, setNewAttrInputs] = useState({ qualities: '', forms: '', colors: '', sizes: '', lengths: '', tracerLines: '', meterMarkings: '' });
  const [matrixPage, setMatrixPage] = useState(1);
  const [matrixPageSize, setMatrixPageSize] = useState(50);
  const [existingFgList, setExistingFgList] = useState([]);
  const [builderMode, setBuilderMode] = useState('single'); // 'single' | 'batch'
  const [showAttrPools, setShowAttrPools] = useState(false);
  const [showBuilderCard, setShowBuilderCard] = useState(true);
  const [selectedCombos, setSelectedCombos] = useState(new Set());
  const [bulkRateInput, setBulkRateInput] = useState('');

  // Custom Selection State: which items are active for combination generation
  const [selectedAttrs, setSelectedAttrs] = useState({
    qualities: ['VIP'],
    forms: ['Hanks'],
    colors: ['Bright Yellow'],
    sizes: ['3x3'],
    lengths: ['Standard'],
    tracerLines: ['No Tracer Line'],
    meterMarkings: ['Non-Meter Marking']
  });

  // Single Custom SKU Quick Builder State
  const [singleSku, setSingleSku] = useState({
    quality: 'VIP',
    form: 'Hanks',
    color: 'Bright Yellow',
    size: '3x3',
    length: 'Standard',
    tracerLine: 'No Tracer Line',
    meterMarking: 'Non-Meter Marking',
    bagWeight: 50.0,
    rate: 220
  });

  useEffect(() => {
    const unsubProc = subscribeProcesses(setLiveProcesses);
    const unsubLoc = subscribeLocations(setLiveLocations);
    const unsubAttrs = subscribeProductAttributes(setProductAttrs);
    const unsubFg = subscribeFinishedGoods(setExistingFgList);
    return () => {
      unsubProc();
      unsubLoc();
      unsubAttrs();
      unsubFg && unsubFg();
    };
  }, []);

  const filteredProcesses = liveProcesses.filter(p =>
    (p.processName || '').toLowerCase().includes(processSearch.toLowerCase()) ||
    (p.processCode || '').toLowerCase().includes(processSearch.toLowerCase()) ||
    (p.inputItemType || '').toLowerCase().includes(processSearch.toLowerCase()) ||
    (p.outputItemType || '').toLowerCase().includes(processSearch.toLowerCase())
  );

  const filteredLocations = liveLocations.filter(l =>
    (l.name || '').toLowerCase().includes(locationSearch.toLowerCase()) ||
    (l.locationCode || '').toLowerCase().includes(locationSearch.toLowerCase()) ||
    (l.address || '').toLowerCase().includes(locationSearch.toLowerCase()) ||
    (l.contactPerson || '').toLowerCase().includes(locationSearch.toLowerCase())
  );

  const handleDeleteProcess = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete process "${name}"?`)) {
      try {
        await deleteProcess(id);
      } catch (e) {
        alert('Error deleting process: ' + e.message);
      }
    }
  };

  const handleDeleteLocation = async (id, name) => {
    if (window.confirm(`Are you sure you want to delete location "${name}"?`)) {
      try {
        await deleteLocation(id);
      } catch (e) {
        alert('Error deleting location: ' + e.message);
      }
    }
  };

  const handleAddAttribute = async (type, val) => {
    if (!val || !val.trim()) return;
    const clean = val.trim();
    const currentList = productAttrs[type] || [];
    if (currentList.includes(clean)) return;
    const updated = {
      ...productAttrs,
      [type]: [...currentList, clean]
    };
    setProductAttrs(updated);
    setNewAttrInputs(prev => ({ ...prev, [type]: '' }));
    try {
      await updateProductAttributes(updated);
    } catch (err) {
      console.warn('Error updating attribute:', err);
    }
  };

  const handleRemoveAttribute = async (type, val) => {
    const updated = {
      ...productAttrs,
      [type]: (productAttrs[type] || []).filter(item => item !== val)
    };
    setProductAttrs(updated);
    try {
      await updateProductAttributes(updated);
    } catch (err) {
      console.warn('Error removing attribute:', err);
    }
  };

  // Custom Attribute Selection Handlers
  const toggleSelectAttr = (category, val) => {
    setSelectedAttrs(prev => {
      const currentList = prev[category] || [];
      const exists = currentList.includes(val);
      const updated = exists ? currentList.filter(x => x !== val) : [...currentList, val];
      return { ...prev, [category]: updated };
    });
  };

  const selectAllAttrs = (category) => {
    setSelectedAttrs(prev => ({
      ...prev,
      [category]: [...(productAttrs[category] || [])]
    }));
  };

  const clearAllAttrs = (category) => {
    setSelectedAttrs(prev => ({
      ...prev,
      [category]: []
    }));
  };

  // Add a single custom SKU directly
  const handleAddSingleSku = () => {
    const q = singleSku.quality || (productAttrs.qualities?.[0] || 'VIP');
    const f = singleSku.form || (productAttrs.forms?.[0] || 'Hanks');
    const c = singleSku.color || (productAttrs.colors?.[0] || 'Bright Yellow');
    const s = singleSku.size || (productAttrs.sizes?.[0] || '3x3');
    const l = singleSku.length || (productAttrs.lengths?.[0] || 'Standard');
    const t = singleSku.tracerLine || (productAttrs.tracerLines?.[0] || 'No Tracer Line');
    const m = singleSku.meterMarking || (productAttrs.meterMarkings?.[0] || 'Non-Meter Marking');

    const code = generateSkuCode(q, f, c, s, l, t, m);
    const extraDesc = [
      l !== 'Standard' ? l : '', 
      t !== 'No Tracer Line' ? t : '',
      m !== 'Non-Meter Marking' ? m : ''
    ].filter(Boolean).join(' • ');
    const name = `${q} ${f} - ${s} (${c})${extraDesc ? ' [' + extraDesc + ']' : ''}`;

    const newEntry = {
      id: code,
      skuCode: code,
      name,
      quality: q,
      form: f,
      color: c,
      size: s,
      length: l,
      tracerLine: t,
      meterMarking: m,
      category: 'Danline & Fishing Twine',
      standardBagWeightKg: Number(singleSku.bagWeight) || 50.0,
      ratePerKg: Number(singleSku.rate) || 220,
      stockQty: 0
    };

    setGeneratedMatrix(prev => {
      if (prev.some(item => item.skuCode === code)) {
        alert(`SKU ${code} is already in the list.`);
        return prev;
      }
      return [newEntry, ...prev];
    });
    setSyncMatrixSuccess(null);
  };

  const handleRemoveMatrixRow = (skuCode) => {
    setGeneratedMatrix(prev => prev.filter(r => r.skuCode !== skuCode));
    setSelectedCombos(prev => {
      const next = new Set(prev);
      next.delete(skuCode);
      return next;
    });
  };

  const handleClearMatrix = () => {
    if (generatedMatrix.length === 0) return;
    if (window.confirm('Are you sure you want to clear all combinations from this list?')) {
      setGeneratedMatrix([]);
      setSelectedCombos(new Set());
      setSyncMatrixSuccess(null);
    }
  };

  const handleUpdateRowField = (skuCode, field, value) => {
    setGeneratedMatrix(prev => prev.map(row => {
      if (row.skuCode === skuCode) {
        return { ...row, [field]: value };
      }
      return row;
    }));
  };

  // Bulk rate selection handlers (Item 4)
  const toggleSelectCombo = (skuCode) => {
    setSelectedCombos(prev => {
      const next = new Set(prev);
      if (next.has(skuCode)) next.delete(skuCode);
      else next.add(skuCode);
      return next;
    });
  };

  const handleToggleSelectAll = (allFilteredCodes) => {
    setSelectedCombos(prev => {
      const allSelected = allFilteredCodes.every(code => prev.has(code));
      if (allSelected) {
        const next = new Set(prev);
        allFilteredCodes.forEach(c => next.delete(c));
        return next;
      } else {
        const next = new Set(prev);
        allFilteredCodes.forEach(c => next.add(c));
        return next;
      }
    });
  };

  const handleApplyBulkRate = () => {
    const rateNum = Number(bulkRateInput);
    if (isNaN(rateNum) || rateNum <= 0) {
      alert('Please enter a valid rate greater than 0');
      return;
    }
    if (selectedCombos.size === 0) {
      alert('Please select at least one combination first.');
      return;
    }
    setGeneratedMatrix(prev => prev.map(row => {
      if (selectedCombos.has(row.skuCode)) {
        return { ...row, ratePerKg: rateNum };
      }
      return row;
    }));
    alert(`Updated rate to ₹${rateNum}/KG for ${selectedCombos.size} selected combinations.`);
  };

  const handleLoadExistingFg = () => {
    if (!existingFgList || existingFgList.length === 0) {
      alert('No finished goods found in database.');
      return;
    }
    const mapped = existingFgList.map(fg => ({
      id: fg.code || fg.id,
      skuCode: fg.code || fg.id,
      name: fg.name || fg.code,
      quality: fg.quality || 'Standard',
      form: fg.form || 'Hanks',
      color: fg.color || (fg.diaColor && fg.diaColor.includes('•') ? fg.diaColor.split('•')[1]?.trim() : 'Natural'),
      size: fg.size || (fg.diaColor && fg.diaColor.includes('•') ? fg.diaColor.split('•')[0]?.trim() : '3x3'),
      length: fg.length || 'Standard',
      tracerLine: fg.tracerLine || 'None',
      meterMarking: fg.meterMarking || 'Non-Meter Marking',
      standardBagWeightKg: Number(fg.standardBagWeightKg || 50),
      ratePerKg: Number(fg.rate || 220),
      stockQty: fg.stockQty || 0,
      isExisting: true
    }));

    setGeneratedMatrix(prev => {
      const existingCodes = new Set(prev.map(p => p.skuCode));
      const newItems = mapped.filter(c => !existingCodes.has(c.skuCode));
      return [...newItems, ...prev];
    });
    setMatrixPage(1);
    setSyncMatrixSuccess(`Loaded ${mapped.length} catalog SKUs from database.`);
  };

  const handleGenerateBatchMix = () => {
    const selQ = selectedAttrs.qualities?.length ? selectedAttrs.qualities : [productAttrs.qualities?.[0] || 'VIP'];
    const selF = selectedAttrs.forms?.length ? selectedAttrs.forms : [productAttrs.forms?.[0] || 'Hanks'];
    const selC = selectedAttrs.colors?.length ? selectedAttrs.colors : [productAttrs.colors?.[0] || 'Bright Yellow'];
    const selS = selectedAttrs.sizes?.length ? selectedAttrs.sizes : [productAttrs.sizes?.[0] || '3x3'];
    const selL = selectedAttrs.lengths?.length ? selectedAttrs.lengths : ['Standard'];
    const selT = selectedAttrs.tracerLines?.length ? selectedAttrs.tracerLines : ['No Tracer Line'];
    const selM = selectedAttrs.meterMarkings?.length ? selectedAttrs.meterMarkings : ['Non-Meter Marking'];

    const totalCount = selQ.length * selF.length * selC.length * selS.length * selL.length * selT.length * selM.length;
    if (totalCount > 400) {
      if (!window.confirm(`This will generate ${totalCount} custom combinations. Do you want to proceed?`)) {
        return;
      }
    }

    const combos = generateMatrixCombinations(
      selQ,
      selF,
      selC,
      selS,
      matrixBaseRate,
      matrixBagWeight,
      selL,
      selT,
      selM
    );

    setGeneratedMatrix(prev => {
      const existingCodes = new Set(prev.map(p => p.skuCode));
      const newItems = combos.filter(c => !existingCodes.has(c.skuCode));
      return [...newItems, ...prev];
    });
    setMatrixPage(1);
    setSyncMatrixSuccess(null);
  };

  const handleSyncMatrixToFg = async () => {
    if (generatedMatrix.length === 0) return;
    setIsSyncingMatrix(true);
    try {
      const count = await syncMatrixToFinishedGoods(generatedMatrix);
      setSyncMatrixSuccess(`Successfully synced ${count} SKUs to Finished Goods Catalog!`);
    } catch (err) {
      alert('Error syncing to finished goods: ' + err.message);
    } finally {
      setIsSyncingMatrix(false);
    }
  };

  return (
    <div className="ds-container">
      {/* ── Page Header ── */}
      <div className="ds-page-header">
        <div>
          <h1 className="ds-page-title">Process &amp; Plant Masters</h1>
          <p className="ds-page-subtitle">
            Configure manufacturing process conversions, internal &amp; external godowns, and multi-attribute product matrix.
          </p>
        </div>
      </div>

      {/* ── Tabs Bar ── */}
      <div className="ds-tabs-bar">
        <button
          className={`ds-tab-btn ${activeTab === 'processMaster' ? 'active' : ''}`}
          onClick={() => setActiveTab('processMaster')}
        >
          <Cog size={14} />
          Process Master
          <span className="ds-tab-count">{filteredProcesses.length}</span>
        </button>
        <button
          className={`ds-tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
          onClick={() => setActiveTab('locations')}
        >
          <Warehouse size={14} />
          Godowns &amp; Locations
          <span className="ds-tab-count">{filteredLocations.length}</span>
        </button>
        <button
          className={`ds-tab-btn ${activeTab === 'productMatrix' ? 'active' : ''}`}
          onClick={() => setActiveTab('productMatrix')}
        >
          <Layers size={14} />
          Product Matrix
          <span className="ds-tab-count">
            {(productAttrs.qualities?.length || 0)}×{(productAttrs.sizes?.length || 0)}
          </span>
        </button>
      </div>

      {/* ── TAB 1: Process Master ── */}
      {activeTab === 'processMaster' && (
        <>
          <div className="ds-filter-row">
            <div className="ds-search-wrap">
              <Search size={14} className="ds-search-icon" />
              <input
                type="text"
                placeholder="Search processes by name, code, material..."
                className="ds-search-input"
                value={processSearch}
                onChange={e => setProcessSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="ds-records-count">{filteredProcesses.length} processes</span>
              <button className="ds-btn-ghost" onClick={() => exportToCsv('Process_Master.csv', filteredProcesses)}>
                <Download size={13} /> Export CSV
              </button>
              <button className="ds-btn-primary" onClick={() => { setSelectedProcessToEdit(null); setShowAddProcessModal(true); }}>
                <Plus size={13} /> Add Process
              </button>
            </div>
          </div>

          <div className="ds-cards-grid">
            {filteredProcesses.map(proc => (
              <div key={proc.processCode || proc.id} className="ds-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div className="ds-card-header" style={{ alignItems: 'flex-start' }}>
                    <div className="ds-card-title-group">
                      <h3 className="ds-card-name" style={{ fontSize: '1rem', fontWeight: 600 }}>{proc.processName}</h3>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span className="ds-process-badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                          {proc.processCode}
                        </span>
                        {proc.isFixedWeight ? (
                          <span className="ds-process-badge" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', border: '1px solid rgba(59, 130, 246, 0.25)', fontWeight: 600 }}>
                            <Scale size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                            Fixed: {proc.standardBagWeightKg} KG (±{proc.toleranceKg || 1}kg)
                          </span>
                        ) : (
                          <span className="ds-process-badge" style={{ background: 'rgba(100, 116, 139, 0.1)', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.2)' }}>
                            Variable Bag Wt
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        title="Edit Process"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
                        onClick={() => { setSelectedProcessToEdit(proc); setShowAddProcessModal(true); }}
                      >
                        <Edit2 size={14} />
                      </button>
                      {proc.id && (
                        <button
                          title="Delete Process"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                          onClick={() => handleDeleteProcess(proc.id, proc.processName)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Flow items */}
                  <div style={{ margin: '14px 0', padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>INPUT MATERIAL</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{proc.inputItemType}</span>
                    </div>
                    <span style={{ color: '#3b82f6', fontWeight: 700 }}>➔</span>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right' }}>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600 }}>OUTPUT ITEM</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{proc.outputItemType}</span>
                    </div>
                  </div>

                  {proc.description && (
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '4px 0 10px 0', lineHeight: 1.4 }}>
                      {proc.description}
                    </p>
                  )}
                </div>

                <div className="ds-card-footer" style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  <div className="ds-stat-col">
                    <span className="ds-stat-label">PROCESSING RATE</span>
                    <span className="ds-stat-val" style={{ color: '#059669', fontWeight: 700 }}>
                      ₹{Number(proc.defaultRatePerKg || 0).toFixed(2)} / KG
                    </span>
                  </div>
                  <div className="ds-stat-col" style={{ textAlign: 'center' }}>
                    <span className="ds-stat-label">FIXED WEIGHT</span>
                    <span className="ds-stat-val" style={{ color: proc.isFixedWeight ? '#2563eb' : '#64748b', fontWeight: 700 }}>
                      {proc.isFixedWeight ? `${proc.standardBagWeightKg || 50} KG` : 'Loose / Var'}
                    </span>
                  </div>
                  <div className="ds-stat-col" style={{ textAlign: 'right' }}>
                    <span className="ds-stat-label">EXP. SCRAP LOSS</span>
                    <span className="ds-stat-val" style={{ color: '#d97706' }}>
                      {proc.expectedScrapPct !== undefined ? proc.expectedScrapPct : (proc.expectedScrapPercentage ?? 0.5)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TAB 2: Godowns & Locations ── */}
      {activeTab === 'locations' && (
        <>
          <div className="ds-filter-row">
            <div className="ds-search-wrap">
              <Search size={14} className="ds-search-icon" />
              <input
                type="text"
                placeholder="Search godowns by name, code, contact..."
                className="ds-search-input"
                value={locationSearch}
                onChange={e => setLocationSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="ds-records-count">{filteredLocations.length} locations</span>
              <button className="ds-btn-ghost" onClick={() => exportToCsv('Locations_Directory.csv', filteredLocations)}>
                <Download size={13} /> Export CSV
              </button>
              <button className="ds-btn-primary" onClick={() => { setSelectedLocationToEdit(null); setShowAddLocationModal(true); }}>
                <Plus size={13} /> Add Godown / Site
              </button>
            </div>
          </div>

          <div className="ds-cards-grid">
            {filteredLocations.map(loc => (
              <div key={loc.locationCode || loc.id} className="ds-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div className="ds-card-header" style={{ alignItems: 'flex-start' }}>
                    <div className="ds-card-title-group">
                      <h3 className="ds-card-name" style={{ fontSize: '1rem', fontWeight: 600 }}>{loc.name}</h3>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        <span className="ds-process-badge" style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' }}>
                          {loc.locationCode}
                        </span>
                        {loc.type === 'INTERNAL' ? (
                          <span className="ds-process-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)', fontWeight: 600 }}>
                            <Warehouse size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                            Internal Godown
                          </span>
                        ) : (
                          <span className="ds-process-badge" style={{ background: 'rgba(249, 115, 22, 0.1)', color: '#ea580c', border: '1px solid rgba(249, 115, 22, 0.25)', fontWeight: 600 }}>
                            <MapPin size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                            Job Worker Site
                          </span>
                        )}
                        {loc.isDefault && (
                          <span className="ds-process-badge" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 600, border: '1px solid #bfdbfe' }}>
                            Primary RM Silo
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        title="Edit Location"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}
                        onClick={() => { setSelectedLocationToEdit(loc); setShowAddLocationModal(true); }}
                      >
                        <Edit2 size={14} />
                      </button>
                      {loc.id && (
                        <button
                          title="Delete Location"
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}
                          onClick={() => handleDeleteLocation(loc.id, loc.name)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="ds-card-info-list" style={{ marginTop: '12px' }}>
                    <div className="ds-info-item">
                      <MapPin size={13} className="ds-info-icon" />
                      <span>{loc.address || 'Plant Premises, Rajkot'}</span>
                    </div>
                    {loc.contactPerson && (
                      <div className="ds-info-item">
                        <Users size={13} className="ds-info-icon" />
                        <span>Supervisor: {loc.contactPerson}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ds-card-footer" style={{ marginTop: '12px', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  <div className="ds-stat-col">
                    <span className="ds-stat-label">LOCATION TYPE</span>
                    <span className="ds-stat-val" style={{ color: loc.type === 'INTERNAL' ? '#059669' : '#ea580c' }}>
                      {loc.type === 'INTERNAL' ? 'Plant Godown' : 'Third-Party Site'}
                    </span>
                  </div>
                  <div className="ds-stat-col" style={{ textAlign: 'right' }}>
                    <span className="ds-stat-label">CAPACITY</span>
                    <span className="ds-stat-val">
                      {Number(loc.capacityKg || 0).toLocaleString()} KG
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TAB 3: Custom Product Combination Builder ── */}
      {activeTab === 'productMatrix' && (
        <>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: showBuilderCard ? '18px' : 0 }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={20} style={{ color: '#2563eb' }} />
                  Custom Product Combinations &amp; Attribute Master
                </h2>
                <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                  Select your specific product attributes to make custom combinations for production and Finished Goods inventory.
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setShowBuilderCard(prev => !prev)}
                  className="ds-btn-ghost"
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', background: showBuilderCard ? '#eff6ff' : '#f8fafc', color: showBuilderCard ? '#2563eb' : '#475569', fontWeight: 600 }}
                  title="Toggle visibility of combination builder"
                >
                  {showBuilderCard ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showBuilderCard ? 'Hide Combination Builder' : 'Show Combination Builder'}
                </button>

                <button
                  type="button"
                  onClick={handleLoadExistingFg}
                  className="ds-btn-ghost"
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  title="Load already saved finished goods SKUs into list"
                >
                  <RefreshCw size={13} />
                  Load Existing FG Catalog {existingFgList.length > 0 ? `(${existingFgList.length})` : ''}
                </button>

                <button
                  type="button"
                  onClick={() => setShowAttrPools(prev => !prev)}
                  className="ds-btn-ghost"
                  style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px', background: showAttrPools ? '#eff6ff' : '#f8fafc', color: showAttrPools ? '#2563eb' : '#475569' }}
                >
                  <SlidersHorizontal size={13} />
                  {showAttrPools ? 'Hide Attribute Pools' : 'Manage Master Attribute Pools'}
                </button>
              </div>
            </div>

            {/* Collapsible Combination Builder Body (Item 5) */}
            {showBuilderCard && (
              <>
                {/* Builder Mode Switcher */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: '#f1f5f9', padding: '4px', borderRadius: '8px', width: 'fit-content', marginTop: '14px' }}>
                  <button
                    type="button"
                    onClick={() => setBuilderMode('single')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: builderMode === 'single' ? '#ffffff' : 'transparent',
                      color: builderMode === 'single' ? '#0f172a' : '#64748b',
                      boxShadow: builderMode === 'single' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    <Plus size={14} style={{ color: '#2563eb' }} />
                    Build Single Custom Combination
                  </button>

                  <button
                    type="button"
                    onClick={() => setBuilderMode('batch')}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: builderMode === 'batch' ? '#ffffff' : 'transparent',
                      color: builderMode === 'batch' ? '#0f172a' : '#64748b',
                      boxShadow: builderMode === 'batch' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    <SlidersHorizontal size={14} style={{ color: '#7c3aed' }} />
                    Multi-Select Combination Mix
                  </button>
                </div>

                {/* ── MODE 1: Single Custom SKU Direct Selector ── */}
                {builderMode === 'single' && (
                  <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                        Select Attributes to Make 1 Custom Product Combination:
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', display: 'block', marginBottom: '4px' }}>
                          1. Quality
                        </label>
                        <select
                          value={singleSku.quality}
                          onChange={e => setSingleSku(s => ({ ...s, quality: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#fff' }}
                        >
                          {(productAttrs.qualities || []).map(q => <option key={q} value={q}>{q}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#15803d', display: 'block', marginBottom: '4px' }}>
                          2. Form
                        </label>
                        <select
                          value={singleSku.form}
                          onChange={e => setSingleSku(s => ({ ...s, form: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#fff' }}
                        >
                          {(productAttrs.forms || []).map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', display: 'block', marginBottom: '4px' }}>
                          3. Color
                        </label>
                        <select
                          value={singleSku.color}
                          onChange={e => setSingleSku(s => ({ ...s, color: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#fff' }}
                        >
                          {(productAttrs.colors || []).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7e22ce', display: 'block', marginBottom: '4px' }}>
                          4. Size
                        </label>
                        <select
                          value={singleSku.size}
                          onChange={e => setSingleSku(s => ({ ...s, size: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#fff' }}
                        >
                          {(productAttrs.sizes || []).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0e7490', display: 'block', marginBottom: '4px' }}>
                          5. Length
                        </label>
                        <select
                          value={singleSku.length}
                          onChange={e => setSingleSku(s => ({ ...s, length: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#fff' }}
                        >
                          {(productAttrs.lengths || ['Standard']).map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#be185d', display: 'block', marginBottom: '4px' }}>
                          6. Tracer Line
                        </label>
                        <select
                          value={singleSku.tracerLine}
                          onChange={e => setSingleSku(s => ({ ...s, tracerLine: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#fff' }}
                        >
                          {(productAttrs.tracerLines || ['No Tracer Line']).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#059669', display: 'block', marginBottom: '4px' }}>
                          7. Meter Marking
                        </label>
                        <select
                          value={singleSku.meterMarking || 'Non-Meter Marking'}
                          onChange={e => setSingleSku(s => ({ ...s, meterMarking: e.target.value }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#fff' }}
                        >
                          {(productAttrs.meterMarkings || ['Non-Meter Marking', 'Meter Marking']).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>

                      <div style={{ maxWidth: '100px' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Bag Wt (KG)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={singleSku.bagWeight}
                          onChange={e => setSingleSku(s => ({ ...s, bagWeight: Number(e.target.value) }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#fff' }}
                        />
                      </div>

                      <div style={{ maxWidth: '105px' }}>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                          Rate (₹/KG)
                        </label>
                        <input
                          type="number"
                          value={singleSku.rate}
                          onChange={e => setSingleSku(s => ({ ...s, rate: Number(e.target.value) }))}
                          style={{ width: '100%', padding: '6px 8px', border: '1.5px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem', background: '#fff' }}
                        />
                      </div>
                    </div>

                    {/* SKU Code Preview & Add Button Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Generated SKU Code:</span>
                        <code style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.85rem' }}>
                          {generateSkuCode(singleSku.quality, singleSku.form, singleSku.color, singleSku.size, singleSku.length, singleSku.tracerLine, singleSku.meterMarking)}
                        </code>
                        <span style={{ fontSize: '0.78rem', color: '#334155', fontWeight: 600 }}>
                          ({singleSku.quality} {singleSku.form} - {singleSku.size} • {singleSku.color} • {singleSku.meterMarking || 'Non-Meter Marking'})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={handleAddSingleSku}
                        className="ds-btn-primary"
                        style={{ background: '#2563eb', color: '#fff', padding: '7px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', fontWeight: 700 }}
                      >
                        <Plus size={15} /> Add Custom Combination
                      </button>
                    </div>
                  </div>
                )}

                {/* ── MODE 2: Multi-Select Targeted Batch Generator ── */}
                {builderMode === 'batch' && (
                  <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                        Select Multiple Options to Combine (Only Checked Items Will Be Created):
                      </span>
                    </div>

                    {/* 7 Attribute Cards with Checkbox Chips */}
                    {(() => {
                      const renderBatchCard = (num, title, category, activeColor, borderLight) => {
                        const allItems = productAttrs[category] || [];
                        const selItems = selectedAttrs[category] || [];
                        return (
                          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>{num}. {title}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem' }}>
                                <span style={{ color: activeColor, fontWeight: 700 }}>
                                  {selItems.length}/{allItems.length} sel
                                </span>
                                <span>•</span>
                                <button
                                  type="button"
                                  onClick={() => selectAllAttrs(category)}
                                  style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', padding: 0, fontSize: '0.72rem', textDecoration: 'underline' }}
                                >
                                  All
                                </button>
                                <span>•</span>
                                <button
                                  type="button"
                                  onClick={() => clearAllAttrs(category)}
                                  style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, fontSize: '0.72rem', textDecoration: 'underline' }}
                                >
                                  None
                                </button>
                              </div>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              {allItems.map(val => {
                                const isSelected = selItems.includes(val);
                                return (
                                  <span 
                                    key={val} 
                                    onClick={() => toggleSelectAttr(category, val)}
                                    style={{ 
                                      display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                                      background: isSelected ? borderLight : '#f8fafc',
                                      color: isSelected ? activeColor : '#64748b',
                                      border: isSelected ? `1.5px solid ${activeColor}` : '1px solid #cbd5e1',
                                      padding: '2px 8px', borderRadius: '16px', fontSize: '0.74rem',
                                      fontWeight: isSelected ? 700 : 500,
                                      userSelect: 'none'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      style={{ accentColor: activeColor, cursor: 'pointer', margin: 0, width: 12, height: 12 }}
                                    />
                                    {val}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px', marginBottom: '14px' }}>
                          {renderBatchCard('1', 'Qualities', 'qualities', '#1d4ed8', '#eff6ff')}
                          {renderBatchCard('2', 'Forms', 'forms', '#15803d', '#f0fdf4')}
                          {renderBatchCard('3', 'Colors', 'colors', '#b45309', '#fef3c7')}
                          {renderBatchCard('4', 'Sizes', 'sizes', '#7e22ce', '#f3e8ff')}
                          {renderBatchCard('5', 'Lengths', 'lengths', '#0e7490', '#ecfeff')}
                          {renderBatchCard('6', 'Tracer Lines', 'tracerLines', '#be185d', '#fdf2f8')}
                          {renderBatchCard('7', 'Meter Marking', 'meterMarkings', '#059669', '#ecfdf5')}
                        </div>
                      );
                    })()}

                    {/* Batch Action Banner */}
                    {(() => {
                      const qCount = (selectedAttrs.qualities || []).length;
                      const fCount = (selectedAttrs.forms || []).length;
                      const cCount = (selectedAttrs.colors || []).length;
                      const sCount = (selectedAttrs.sizes || []).length;
                      const lCount = Math.max(1, (selectedAttrs.lengths || []).length);
                      const tCount = Math.max(1, (selectedAttrs.tracerLines || []).length);
                      const mCount = Math.max(1, (selectedAttrs.meterMarkings || []).length);
                      const totalCombos = qCount * fCount * cCount * sCount * lCount * tCount * mCount;

                      return (
                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                          <div>
                            <span style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 600 }}>Calculation: </span>
                            <span style={{ fontSize: '0.82rem', color: '#0f172a', fontWeight: 700 }}>
                              {qCount} Qualities × {fCount} Forms × {cCount} Colors × {sCount} Sizes = <span style={{ color: '#2563eb' }}>{totalCombos.toLocaleString()} Custom SKUs</span>
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Bag Wt:</label>
                              <input
                                type="number"
                                step="0.5"
                                value={matrixBagWeight}
                                onChange={e => setMatrixBagWeight(Number(e.target.value))}
                                style={{ width: '60px', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.78rem' }}
                              />
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>KG</span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>Rate:</label>
                              <input
                                type="number"
                                value={matrixBaseRate}
                                onChange={e => setMatrixBaseRate(Number(e.target.value))}
                                style={{ width: '65px', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.78rem' }}
                              />
                              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>₹/KG</span>
                            </div>

                            <button
                              type="button"
                              onClick={handleGenerateBatchMix}
                              className="ds-btn-primary"
                              disabled={totalCombos === 0}
                              style={{ background: '#0f172a', color: '#ffffff', padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                              <Sparkles size={14} /> Generate &amp; Add ({totalCombos}) Combinations
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Collapsible Master Attribute Pools Management */}
                {showAttrPools && (
                  <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '10px', padding: '16px', marginTop: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                          Master Product Attribute Pools (Available in Selectors)
                        </h4>
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          Add or remove options. Any updates automatically appear in the combination builder dropdowns.
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                      {[
                        { num: '1', title: 'Qualities', cat: 'qualities', color: '#1d4ed8' },
                        { num: '2', title: 'Forms', cat: 'forms', color: '#15803d' },
                        { num: '3', title: 'Colors', cat: 'colors', color: '#b45309' },
                        { num: '4', title: 'Sizes', cat: 'sizes', color: '#7e22ce' },
                        { num: '5', title: 'Lengths', cat: 'lengths', color: '#0e7490' },
                        { num: '6', title: 'Tracer Lines', cat: 'tracerLines', color: '#be185d' },
                        { num: '7', title: 'Meter Markings', cat: 'meterMarkings', color: '#059669' }
                      ].map(({ num, title, cat, color }) => (
                        <div key={cat} style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0f172a' }}>{num}. {title}</span>
                            <span style={{ fontSize: '0.7rem', color, fontWeight: 700 }}>
                              {(productAttrs[cat] || []).length} items
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px', minHeight: '30px' }}>
                            {(productAttrs[cat] || []).map(val => (
                              <span
                                key={val}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#f1f5f9', color: '#334155', padding: '2px 7px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 500 }}
                              >
                                {val}
                                <X
                                  size={11}
                                  style={{ cursor: 'pointer', opacity: 0.6 }}
                                  onClick={() => handleRemoveAttribute(cat, val)}
                                  title={`Delete ${val}`}
                                />
                              </span>
                            ))}
                          </div>

                          <div style={{ display: 'flex', gap: '4px' }}>
                            <input
                              type="text"
                              placeholder={`+ Add ${title}...`}
                              value={newAttrInputs[cat] || ''}
                              onChange={e => setNewAttrInputs(prev => ({ ...prev, [cat]: e.target.value }))}
                              onKeyDown={e => e.key === 'Enter' && handleAddAttribute(cat, newAttrInputs[cat])}
                              style={{ flex: 1, padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.74rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleAddAttribute(cat, newAttrInputs[cat])}
                              style={{ padding: '3px 8px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer' }}
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── CARD 2: Custom Product Combinations Table (ALWAYS VISIBLE) ── */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 2px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Custom Product Combinations List
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.74rem', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                    {generatedMatrix.length} combinations
                  </span>
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Review your selected product variants, edit bag weights/rates, or sync them into the Finished Goods inventory.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {generatedMatrix.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="ds-btn-ghost"
                      onClick={handleClearMatrix}
                      style={{ color: '#dc2626', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}
                    >
                      <Trash2 size={13} /> Clear All
                    </button>
                    <button
                      type="button"
                      className="ds-btn-ghost"
                      onClick={() => exportToCsv('Custom_Product_Matrix.csv', generatedMatrix)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.78rem' }}
                    >
                      <Download size={13} /> Export CSV
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="ds-btn-primary"
                  onClick={handleSyncMatrixToFg}
                  disabled={isSyncingMatrix || generatedMatrix.length === 0}
                  style={{ background: generatedMatrix.length === 0 ? '#94a3b8' : '#16a34a', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
                >
                  <Check size={14} />
                  {isSyncingMatrix ? 'Syncing...' : 'Sync to Finished Goods Catalog'}
                </button>
              </div>
            </div>

            {syncMatrixSuccess && (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', padding: '10px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={16} />
                {syncMatrixSuccess}
              </div>
            )}

            {generatedMatrix.length === 0 ? (
              <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '36px 20px', textAlign: 'center', background: '#f8fafc', color: '#64748b' }}>
                <Layers size={36} style={{ color: '#94a3b8', margin: '0 auto 10px auto', display: 'block' }} />
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.92rem', color: '#334155', fontWeight: 600 }}>
                  No Custom Combinations Added Yet
                </h4>
                <p style={{ margin: '0 auto 14px auto', fontSize: '0.8rem', maxWidth: '420px', color: '#64748b' }}>
                  Choose attributes in the builder above and click <strong>&quot;+ Add Custom Combination&quot;</strong>, or load your existing Finished Goods catalog.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={handleAddSingleSku}
                    className="ds-btn-primary"
                    style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                  >
                    <Plus size={13} /> Add &quot;{singleSku.quality} {singleSku.form} - {singleSku.size}&quot;
                  </button>
                  {existingFgList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleLoadExistingFg}
                      className="ds-btn-ghost"
                      style={{ fontSize: '0.78rem', padding: '6px 14px' }}
                    >
                      <RefreshCw size={13} /> Load Existing FG Catalog ({existingFgList.length})
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="ds-filter-row" style={{ padding: '0 0 12px 0' }}>
                  <div className="ds-search-wrap">
                    <Search size={14} className="ds-search-icon" />
                    <input
                      type="text"
                      placeholder="Filter combinations by SKU, Quality, Form, Size, Color..."
                      className="ds-search-input"
                      value={matrixSearch}
                      onChange={e => setMatrixSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Paginated Combinations Table */}
                {(() => {
                  const filteredMatrix = generatedMatrix.filter(m => 
                    (m.skuCode || '').toLowerCase().includes(matrixSearch.toLowerCase()) ||
                    (m.name || '').toLowerCase().includes(matrixSearch.toLowerCase()) ||
                    (m.quality || '').toLowerCase().includes(matrixSearch.toLowerCase()) ||
                    (m.color || '').toLowerCase().includes(matrixSearch.toLowerCase()) ||
                    (m.size || '').toLowerCase().includes(matrixSearch.toLowerCase()) ||
                    (m.length && m.length.toLowerCase().includes(matrixSearch.toLowerCase())) ||
                    (m.tracerLine && m.tracerLine.toLowerCase().includes(matrixSearch.toLowerCase())) ||
                    (m.meterMarking && m.meterMarking.toLowerCase().includes(matrixSearch.toLowerCase()))
                  );
                  const totalPages = Math.ceil(filteredMatrix.length / matrixPageSize) || 1;
                  const safePage = Math.min(matrixPage, totalPages);
                  const paginatedItems = filteredMatrix.slice((safePage - 1) * matrixPageSize, safePage * matrixPageSize);
                  const allVisibleSelected = filteredMatrix.length > 0 && filteredMatrix.every(r => selectedCombos.has(r.skuCode));

                  return (
                    <>
                      <div className="jw-table-container ds-table-container">
                        <table className="jw-ledger-table ds-table">
                          <thead>
                            <tr>
                              <th style={{ width: '38px', textAlign: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={allVisibleSelected}
                                  onChange={() => handleToggleSelectAll(filteredMatrix.map(r => r.skuCode))}
                                  style={{ cursor: 'pointer', accentColor: '#2563eb', width: 14, height: 14 }}
                                  title="Select / Deselect all visible combinations"
                                />
                              </th>
                              <th style={{ width: '35px', textAlign: 'center' }}>#</th>
                              <th>SKU CODE</th>
                              <th>PRODUCT NAME</th>
                              <th>QUALITY</th>
                              <th>FORM</th>
                              <th>COLOR</th>
                              <th>SIZE</th>
                              <th>LENGTH</th>
                              <th>TRACER LINE</th>
                              <th>METER MARKING</th>
                              <th style={{ textAlign: 'right' }}>STD BAG WT</th>
                              <th style={{ textAlign: 'right' }}>RATE (₹/KG)</th>
                              <th style={{ textAlign: 'center' }}>STATUS</th>
                              <th style={{ textAlign: 'center', width: '70px' }}>ACTION</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedItems.map((row, idx) => (
                              <tr key={row.skuCode} style={{ background: selectedCombos.has(row.skuCode) ? 'rgba(37, 99, 235, 0.04)' : undefined }}>
                                <td style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedCombos.has(row.skuCode)}
                                    onChange={() => toggleSelectCombo(row.skuCode)}
                                    style={{ cursor: 'pointer', accentColor: '#2563eb', width: 14, height: 14 }}
                                  />
                                </td>
                                <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600 }}>
                                  {(safePage - 1) * matrixPageSize + idx + 1}
                                </td>
                                <td>
                                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0f172a', fontSize: '0.78rem', background: '#f8fafc', padding: '3px 8px', borderRadius: '5px', border: '1px solid #e2e8f0', display: 'inline-block', whiteSpace: 'nowrap' }}>
                                    {row.skuCode}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap' }}>
                                    {row.name}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>
                                    {row.quality}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #dcfce7', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', display: 'inline-block' }}>
                                    {row.form}
                                  </span>
                                </td>
                                <td style={{ whiteSpace: 'nowrap', color: '#334155', fontWeight: 500 }}>
                                  {row.color}
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  <strong style={{ color: '#0f172a', fontSize: '0.82rem' }}>{row.size}</strong>
                                </td>
                                <td>
                                  <span style={{ background: '#ecfeff', color: '#0e7490', border: '1px solid #cffafe', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block' }}>
                                    {row.length || 'Standard'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{ background: '#fdf2f8', color: '#be185d', border: '1px solid #fce7f3', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-block' }}>
                                    {row.tracerLine || 'None'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{
                                    background: row.meterMarking === 'Meter Marking' ? '#ecfdf5' : '#f8fafc',
                                    color: row.meterMarking === 'Meter Marking' ? '#059669' : '#64748b',
                                    border: row.meterMarking === 'Meter Marking' ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block'
                                  }}>
                                    {row.meterMarking || 'Non-Meter Marking'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '2px 6px' }}>
                                    <input
                                      type="number"
                                      step="0.5"
                                      value={row.standardBagWeightKg}
                                      onChange={e => handleUpdateRowField(row.skuCode, 'standardBagWeightKg', Number(e.target.value))}
                                      style={{ width: '48px', padding: 0, border: 'none', background: 'transparent', fontSize: '0.78rem', fontWeight: 600, textAlign: 'right', color: '#0f172a' }}
                                    />
                                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>KG</span>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '5px', padding: '2px 6px' }}>
                                    <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>₹</span>
                                    <input
                                      type="number"
                                      value={row.ratePerKg}
                                      onChange={e => handleUpdateRowField(row.skuCode, 'ratePerKg', Number(e.target.value))}
                                      style={{ width: '52px', padding: 0, border: 'none', background: 'transparent', fontSize: '0.78rem', fontWeight: 600, textAlign: 'right', color: '#0f172a' }}
                                    />
                                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>/KG</span>
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{
                                    background: syncMatrixSuccess || row.isExisting ? '#dcfce7' : '#fef3c7',
                                    color: syncMatrixSuccess || row.isExisting ? '#15803d' : '#854d0e',
                                    border: syncMatrixSuccess || row.isExisting ? '1px solid #86efac' : '1px solid #fde047',
                                    padding: '3px 9px',
                                    borderRadius: '9999px',
                                    fontSize: '0.68rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.04em',
                                    display: 'inline-block',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {syncMatrixSuccess || row.isExisting ? 'SYNCED' : 'DRAFT'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMatrixRow(row.skuCode)}
                                    title="Delete combination"
                                    style={{
                                      background: '#fee2e2',
                                      border: '1px solid #fecaca',
                                      color: '#dc2626',
                                      cursor: 'pointer',
                                      padding: '5px 8px',
                                      borderRadius: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Floating Action Bar for Bulk Rate Edit (Item 4) */}
                      {selectedCombos.size > 0 && (
                        <div style={{
                          position: 'sticky',
                          bottom: '16px',
                          zIndex: 50,
                          background: '#0f172a',
                          color: '#ffffff',
                          padding: '12px 18px',
                          borderRadius: '10px',
                          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4), 0 8px 10px -6px rgba(15, 23, 42, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px',
                          marginTop: '12px',
                          border: '1px solid #334155'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ background: '#2563eb', color: '#ffffff', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 700 }}>
                              {selectedCombos.size} Combinations Selected
                            </span>
                            <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                              Set uniform rate across selected variants (e.g. all colors):
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1e293b', padding: '5px 10px', borderRadius: '6px', border: '1px solid #475569' }}>
                              <span style={{ color: '#94a3b8', fontSize: '0.8rem', fontWeight: 700 }}>₹</span>
                              <input
                                type="number"
                                placeholder="e.g. 225"
                                value={bulkRateInput}
                                onChange={e => setBulkRateInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleApplyBulkRate()}
                                style={{ width: '80px', background: 'transparent', border: 'none', color: '#ffffff', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
                              />
                              <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>/KG</span>
                            </div>

                            <button
                              type="button"
                              onClick={handleApplyBulkRate}
                              style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '7px 16px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                            >
                              <Check size={14} /> Apply Bulk Rate
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedCombos(new Set())}
                              style={{ background: 'transparent', color: '#94a3b8', border: '1px solid #475569', padding: '7px 12px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
                            >
                              Deselect All
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Pagination Bar */}
                      {filteredMatrix.length > matrixPageSize && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', padding: '8px 4px', fontSize: '0.8rem', color: '#64748b', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            Showing <strong>{(safePage - 1) * matrixPageSize + 1}</strong> to <strong>{Math.min(safePage * matrixPageSize, filteredMatrix.length)}</strong> of <strong>{filteredMatrix.length.toLocaleString()}</strong> combinations
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label style={{ fontSize: '0.75rem' }}>Per page:</label>
                            <select
                              value={matrixPageSize}
                              onChange={e => { setMatrixPageSize(Number(e.target.value)); setMatrixPage(1); }}
                              style={{ padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem' }}
                            >
                              <option value="25">25</option>
                              <option value="50">50</option>
                              <option value="100">100</option>
                            </select>

                            <button
                              type="button"
                              disabled={safePage <= 1}
                              onClick={() => setMatrixPage(p => Math.max(1, p - 1))}
                              style={{ padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: safePage <= 1 ? '#f1f5f9' : '#fff', cursor: safePage <= 1 ? 'not-allowed' : 'pointer' }}
                            >
                              Previous
                            </button>
                            <span>Page <strong>{safePage}</strong> of <strong>{totalPages}</strong></span>
                            <button
                              type="button"
                              disabled={safePage >= totalPages}
                              onClick={() => setMatrixPage(p => Math.min(totalPages, p + 1))}
                              style={{ padding: '4px 10px', border: '1px solid #cbd5e1', borderRadius: '4px', background: safePage >= totalPages ? '#f1f5f9' : '#fff', cursor: safePage >= totalPages ? 'not-allowed' : 'pointer' }}
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </>
      )}

      {/* ── Modals ── */}
      {showAddProcessModal && (
        <ProcessMasterModal
          process={selectedProcessToEdit}
          processToEdit={selectedProcessToEdit}
          onClose={() => { setShowAddProcessModal(false); setSelectedProcessToEdit(null); }}
        />
      )}

      {showAddLocationModal && (
        <LocationMasterModal
          location={selectedLocationToEdit}
          locationToEdit={selectedLocationToEdit}
          onClose={() => { setShowAddLocationModal(false); setSelectedLocationToEdit(null); }}
        />
      )}
    </div>
  );
}
