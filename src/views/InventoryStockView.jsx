import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Layers, Package, History, GitBranch, Search, Plus, ArrowUpRight,
  AlertTriangle, ArrowUpDown, ChevronRight, Filter, Download,
  CheckCircle2, ArrowRight, Truck, FileText
} from 'lucide-react';
import NewJobWorkModal from '../modals/NewJobWorkModal';
import SalesOrderModal from '../modals/SalesOrderModal';
import AddRawMaterialModal from '../modals/AddRawMaterialModal';
import AddProductSkuModal from '../modals/AddProductSkuModal';
import MaterialDetailDrawer from '../drawers/MaterialDetailDrawer';
import AddFinishedGoodsStockModal from '../modals/AddFinishedGoodsStockModal';
import { useWorkflow } from '../context/WorkflowContext';
import { subscribeRawMaterials, subscribeFinishedGoods, subscribeStockMovements, addRawMaterial, addFinishedGood, updateFgStock, logStockMovement } from '../api/inventory.api';
import { subscribeJobWorks } from '../api/jobwork.api';
import { subscribeDispatches } from '../api/sales.api';
import { exportToCsv } from '../utils/exportCsv';
import '../styles/InventoryStock.css';



export default function InventoryStockView({ onOpenJobWork, onOpenSalesOrder }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { rmStock, jobWorkStock, fgStock } = useWorkflow();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'rm');

  const [liveRmList, setLiveRmList] = useState([]);
  const [liveFgList, setLiveFgList] = useState([]);
  const [liveMovements, setLiveMovements] = useState([]);
  const [liveJobWorks, setLiveJobWorks] = useState([]);
  const [liveDispatches, setLiveDispatches] = useState([]);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
  }, [location.state]);

  useEffect(() => {
    const unsubRm = subscribeRawMaterials(setLiveRmList);
    const unsubFg = subscribeFinishedGoods(setLiveFgList);
    const unsubMov = subscribeStockMovements(setLiveMovements);
    const unsubJw = subscribeJobWorks(setLiveJobWorks);
    const unsubDc = subscribeDispatches(setLiveDispatches);
    return () => {
      unsubRm();
      unsubFg();
      unsubMov();
      unsubJw();
      unsubDc();
    };
  }, []);

  const [rmSearch, setRmSearch] = useState('');
  const [rmCategoryFilter, setRmCategoryFilter] = useState('All');
  const [fgSearch, setFgSearch] = useState('');
  const [fgCategoryFilter, setFgCategoryFilter] = useState('All');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('All');
  const [traceSearch, setTraceSearch] = useState('JW-2026-0024');
  const [showJWModal, setShowJWModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showAddRmModal, setShowAddRmModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddFgStockModal, setShowAddFgStockModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleOpenDrawer = (item) => {
    setSelectedMaterial(item);
    setIsDrawerOpen(true);
  };

  const triggerJWModal = () => {
    if (onOpenJobWork) onOpenJobWork();
    else setShowJWModal(true);
  };

  const triggerSalesModal = () => {
    if (onOpenSalesOrder) onOpenSalesOrder();
    else {
      setShowSalesModal(true);
    }
  };

  const handleSaveRmModal = async (formData) => {
    try {
      await addRawMaterial({
        code: formData.code,
        name: formData.name,
        category: formData.category,
        brand: formData.brand,
        grade: formData.grade,
        availFactory: Number(formData.initialStock || 0),
        rate: Number(formData.rate || 0),
        reorderLevel: Number(formData.reorderLevel || 1000)
      });
    } catch (err) {
      console.error('Error adding raw material:', err);
    }
  };

  const handleSaveProductModal = async (formData) => {
    try {
      await addFinishedGood({
        code: formData.code,
        name: formData.name,
        category: formData.category,
        diaSize: formData.diaSize,
        colorTracer: formData.colorTracer,
        stockQty: Number(formData.initialStock || 0),
        rate: Number(formData.rate || 0),
        reorderLevel: Number(formData.reorderLevel || 10)
      });
    } catch (err) {
      console.error('Error adding product SKU:', err);
    }
  };

  const handleSaveFgStockModal = async (stockData) => {
    try {
      if (selectedMaterial && selectedMaterial.id) {
        await updateFgStock(selectedMaterial.id, Number(stockData.qty || 0), 0);
        await logStockMovement({
          type: 'Production',
          typeBadge: 'inv-badge-prod',
          icon: '⚙️',
          ref: stockData.batchNo || 'BATCH-FG-INWARD',
          item: selectedMaterial.name,
          batch: stockData.batchNo || 'BATCH-FG-INWARD',
          inward: `+${stockData.qty} Coils`,
          outward: '0',
          location: 'Finished Goods Bay',
          remarks: stockData.notes || 'Inward stock from production'
        });
      } else {
        await addFinishedGood({
          name: 'PP Danline Rope 6mm (Yellow)',
          category: 'Danline Rope',
          stockQty: Number(stockData.qty || 100),
          rate: 2450
        });
      }
    } catch (err) {
      console.error('Error adding finished goods stock:', err);
    }
  };

  const displayRmList = liveRmList.map(rm => ({
    id: rm.id,
    code: rm.code || 'RM-SKU',
    name: rm.name || 'Raw Material',
    desc: rm.desc || `Polymer ${rm.category || 'Granules'}`,
    brand: rm.brand || 'Generic',
    grade: rm.grade || 'Standard',
    availFactory: typeof rm.availFactory === 'number' ? `${rm.availFactory.toLocaleString()} KG` : rm.availFactory || '0 KG',
    atJobWork: typeof rm.atJobWork === 'number' ? `${rm.atJobWork.toLocaleString()} KG` : rm.atJobWork || '0 KG',
    totalBalance: `${((Number(rm.availFactory) || 0) + (Number(rm.atJobWork) || 0)).toLocaleString()} KG`,
    rate: typeof rm.rate === 'number' ? `₹${rm.rate}` : rm.rate || '₹0',
    valuation: `₹${(((Number(rm.availFactory) || 0) + (Number(rm.atJobWork) || 0)) * (Number(rm.rate) || 100)).toLocaleString()}`,
    status: rm.status || (rm.availFactory > 1000 ? 'IN STOCK' : 'LOW STOCK')
  }));

  const uniqueRmCategories = Array.from(new Set(liveRmList.map(r => r.category).filter(Boolean)));
  const uniqueFgCategories = Array.from(new Set(liveFgList.map(f => f.category).filter(Boolean)));

  const { globalSearch } = useWorkflow();
  const activeRmQuery = rmSearch || globalSearch || '';
  const activeFgQuery = fgSearch || globalSearch || '';

  const filteredRm = displayRmList.filter(item => {
    const matchesQuery =
      item.code.toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      item.brand.toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      item.grade.toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(activeRmQuery.toLowerCase());

    const matchesCategory =
      rmCategoryFilter === 'All' ||
      item.name.toLowerCase().includes(rmCategoryFilter.toLowerCase()) ||
      item.desc.toLowerCase().includes(rmCategoryFilter.toLowerCase()) ||
      item.code.toLowerCase().includes(rmCategoryFilter.toLowerCase());

    return matchesQuery && matchesCategory;
  });

  const displayFgList = liveFgList.map(fg => ({
    id: fg.id,
    code: fg.code || 'FG-SKU',
    name: fg.name || 'Finished Good',
    sub: fg.desc || `${fg.category || 'Danline Rope'} • Length: KG/Coil`,
    diaColor: fg.diaColor || '6 mm • Bright Yellow',
    physicalStock: typeof fg.stockQty === 'number' ? `${fg.stockQty.toLocaleString()} Coils` : fg.stockQty || '0 Coils',
    reserved: typeof fg.reservedQty === 'number' ? `${fg.reservedQty.toLocaleString()} Coils` : fg.reservedQty || '0 Coils',
    freeStock: `${Math.max(0, (Number(fg.stockQty) || 0) - (Number(fg.reservedQty) || 0)).toLocaleString()} Coils`,
    rate: typeof fg.rate === 'number' ? `₹${fg.rate.toLocaleString()}` : fg.rate || '₹0',
    valuation: `₹${((Number(fg.stockQty) || 0) * (Number(fg.rate) || 2450)).toLocaleString()}`,
    status: (Number(fg.stockQty) || 0) >= (Number(fg.reorderLevel) || 50) ? 'IN STOCK' : ((Number(fg.stockQty) || 0) > 0 ? 'LOW STOCK' : 'OUT OF STOCK')
  }));

  const filteredFg = displayFgList.filter(item => {
    const matchesQuery =
      item.code.toLowerCase().includes(activeFgQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(activeFgQuery.toLowerCase()) ||
      item.sub.toLowerCase().includes(activeFgQuery.toLowerCase()) ||
      item.diaColor.toLowerCase().includes(activeFgQuery.toLowerCase());

    const matchesCategory =
      fgCategoryFilter === 'All' ||
      item.name.toLowerCase().includes(fgCategoryFilter.toLowerCase()) ||
      item.sub.toLowerCase().includes(fgCategoryFilter.toLowerCase());

    return matchesQuery && matchesCategory;
  });

  const activeMovementQuery = movementSearch || globalSearch || '';
  const filteredMovements = liveMovements.filter(m => {
    const matchesQuery =
      (m.ref || '').toLowerCase().includes(activeMovementQuery.toLowerCase()) ||
      (m.item || '').toLowerCase().includes(activeMovementQuery.toLowerCase()) ||
      (m.batch || '').toLowerCase().includes(activeMovementQuery.toLowerCase()) ||
      (m.remarks || '').toLowerCase().includes(activeMovementQuery.toLowerCase()) ||
      (m.location || '').toLowerCase().includes(activeMovementQuery.toLowerCase());

    const matchesType =
      movementTypeFilter === 'All' ||
      m.type === movementTypeFilter ||
      (m.typeBadge || '').toLowerCase().includes(movementTypeFilter.toLowerCase());

    return matchesQuery && matchesType;
  });

  const totalRmValuationInr = liveRmList.reduce((sum, rm) => {
    const factory = Number(rm.availFactory) || 0;
    const jw = Number(rm.atJobWork) || 0;
    const rate = Number(rm.rate) || 0;
    return sum + (factory + jw) * rate;
  }, 0);
  const totalRmValuationLakhs = (totalRmValuationInr / 100000).toFixed(2);

  const totalFgValuationInr = liveFgList.reduce((sum, fg) => {
    const stock = Number(fg.stockQty) || 0;
    const rate = Number(fg.rate) || 2450;
    return sum + stock * rate;
  }, 0);
  const totalFgValuationLakhs = (totalFgValuationInr / 100000).toFixed(2);

  const overallValuationInr = totalRmValuationInr + totalFgValuationInr;
  const overallValuationLakhs = (overallValuationInr / 100000).toFixed(2);

  return (
    <div className="inv-hub-container">
      {/* ── Page Header ── */}
      <div className="inv-page-header">
        <div className="inv-header-left">
          <div className="inv-title-row">
            <h1 className="inv-page-title">Inventory &amp; Stock Hub</h1>
            <span className="inv-badge-blue">₹{overallValuationLakhs}L Total Valuation</span>
          </div>
          <p className="inv-page-subtitle">
            Unified management of raw materials (granules/yarn), finished rope stock, warehouse movements, and batch traceability.
          </p>
        </div>
        <div className="inv-header-right">
          <div className="inv-alert-banner">
            <AlertTriangle size={15} />
            {liveRmList.filter(r => (Number(r.availFactory) || 0) <= 1000).length} Items need attention
          </div>
        </div>
      </div>

      {/* ── Top 4 KPI Cards Grid ── */}
      <div className="inv-top-kpis">
        <div
          className={`inv-kpi-card ${activeTab === 'rm' ? 'active-kpi' : ''}`}
          onClick={() => setActiveTab('rm')}
          style={{ cursor: 'pointer' }}
          title="Switch to Raw Materials tab"
        >
          <div className="inv-kpi-card-header">
            <span className="inv-kpi-title">RAW MATERIAL (IN FACTORY)</span>
            <div className="inv-kpi-icon inv-icon-blue"><Layers size={16} /></div>
          </div>
          <div className="inv-kpi-val-row">
            <span className="inv-kpi-num">{rmStock.toLocaleString()}</span>
            <span className="inv-kpi-sublabel">KG</span>
          </div>
          <div className="inv-kpi-sub">₹{totalRmValuationLakhs}L Value</div>
        </div>

        <div
          className={`inv-kpi-card ${activeTab === 'fg' ? 'active-kpi' : ''}`}
          onClick={() => setActiveTab('fg')}
          style={{ cursor: 'pointer' }}
          title="Switch to Finished Goods tab"
        >
          <div className="inv-kpi-card-header">
            <span className="inv-kpi-title">FINISHED GOODS STOCK</span>
            <div className="inv-kpi-icon inv-icon-green"><Package size={16} /></div>
          </div>
          <div className="inv-kpi-val-row">
            <span className="inv-kpi-num">{fgStock.toLocaleString()}</span>
            <span className="inv-kpi-sublabel">Units</span>
          </div>
          <div className="inv-kpi-sub inv-text-green">
            {liveFgList.reduce((a, b) => a + Math.max(0, (Number(b.stockQty) || 0) - (Number(b.reservedQty) || 0)), 0)} Free / {liveFgList.reduce((a, b) => a + (Number(b.reservedQty) || 0), 0)} Reserved
          </div>
        </div>

        <div
          className={`inv-kpi-card ${activeTab === 'movements' ? 'active-kpi' : ''}`}
          onClick={() => setActiveTab('movements')}
          style={{ cursor: 'pointer' }}
          title="Switch to Stock Movements Log tab"
        >
          <div className="inv-kpi-card-header">
            <span className="inv-kpi-title">STOCK MOVEMENTS LOG</span>
            <div className="inv-kpi-icon inv-icon-purple"><History size={16} /></div>
          </div>
          <div className="inv-kpi-val-row">
            <span className="inv-kpi-num">{liveMovements.length}</span>
            <span className="inv-kpi-sublabel">entries</span>
          </div>
          <div className="inv-kpi-sub">Audit Trail Active</div>
        </div>

        <div
          className={`inv-kpi-card ${activeTab === 'traceability' ? 'active-kpi' : ''}`}
          onClick={() => setActiveTab('traceability')}
          style={{ cursor: 'pointer' }}
          title="Switch to Batch Traceability tab"
        >
          <div className="inv-kpi-card-header">
            <span className="inv-kpi-title">BATCH TRACEABILITY</span>
            <div className="inv-kpi-icon inv-icon-indigo"><GitBranch size={16} /></div>
          </div>
          <div className="inv-kpi-val-row">
            <span className="inv-kpi-num">100%</span>
            <span className="inv-kpi-sublabel">traceable</span>
          </div>
          <div className="inv-kpi-sub inv-text-blue">End-to-End Genealogy</div>
        </div>
      </div>

      {/* ── Segmented Tab Bar ── */}
      <div className="inv-tab-bar">
        <button
          className={`inv-tab-btn ${activeTab === 'rm' ? 'active' : ''}`}
          onClick={() => setActiveTab('rm')}
        >
          <Layers size={14} />
          Raw Materials (RM)
          <span className="inv-tab-badge">{displayRmList.length}</span>
        </button>

        <button
          className={`inv-tab-btn ${activeTab === 'fg' ? 'active' : ''}`}
          onClick={() => setActiveTab('fg')}
        >
          <Package size={14} />
          Finished Goods (FG)
          <span className="inv-tab-badge-green">{displayFgList.length}</span>
        </button>

        <button
          className={`inv-tab-btn ${activeTab === 'movements' ? 'active' : ''}`}
          onClick={() => setActiveTab('movements')}
        >
          <History size={14} />
          Stock Movements Ledger
        </button>

        <button
          className={`inv-tab-btn ${activeTab === 'traceability' ? 'active' : ''}`}
          onClick={() => setActiveTab('traceability')}
        >
          <GitBranch size={14} />
          Batch Traceability Explorer
        </button>
      </div>

      {/* ── TAB 1: Raw Materials (RM) ── */}
      {activeTab === 'rm' && (
        <div className="inv-section-card">
          <div className="inv-section-header">
            <div className="inv-title-group">
              <div className="inv-title-row-inner">
                <h2 className="inv-section-title">Raw Materials Inventory</h2>
                <span className="inv-badge-blue">{displayRmList.length} SKU Materials</span>
              </div>
              <p className="inv-section-subtitle">
                Track polymer granules, masterbatches, and additive balances across factory silos and outside Job Worker holdings.
              </p>
            </div>

            <button className="inv-btn-dark-pill" onClick={() => setShowAddRmModal(true)}>
              <Plus size={14} /> Add Raw Material
            </button>
          </div>

          {/* 5 Summary KPI Row */}
          <div className="inv-summary-kpi-grid">
            <div className="inv-skpi-card">
              <div className="inv-skpi-title">TOTAL MATERIAL BALANCE</div>
              <div className="inv-skpi-val-row">
                <span className="inv-skpi-val">{(rmStock + jobWorkStock).toLocaleString()}</span>
                <span className="inv-skpi-unit">KG</span>
              </div>
              <div className="inv-skpi-sub">Physical + Outside</div>
            </div>

            <div className="inv-skpi-card inv-skpi-green">
              <div className="inv-skpi-title inv-skpi-title-green">AVAILABLE IN FACTORY</div>
              <div className="inv-skpi-val-row">
                <span className="inv-skpi-val inv-text-green">{rmStock.toLocaleString()}</span>
                <span className="inv-skpi-unit">KG</span>
              </div>
              <div className="inv-skpi-sub">Ready for Extrusion / JW</div>
            </div>

            <div className="inv-skpi-card inv-skpi-orange">
              <div className="inv-skpi-title inv-skpi-title-orange">OUTSIDE AT JOB WORK</div>
              <div className="inv-skpi-val-row">
                <span className="inv-skpi-val inv-text-orange">{jobWorkStock.toLocaleString()}</span>
                <span className="inv-skpi-unit">KG</span>
              </div>
              <div className="inv-skpi-sub">In process at vendor plants</div>
            </div>

            <div className="inv-skpi-card">
              <div className="inv-skpi-title">TOTAL INVENTORY VALUATION</div>
              <div className="inv-skpi-val-row">
                <span className="inv-skpi-val">₹{totalRmValuationLakhs}</span>
                <span className="inv-skpi-unit">Lakhs</span>
              </div>
              <div className="inv-skpi-sub">₹{totalRmValuationInr.toLocaleString()}</div>
            </div>

            <div className="inv-skpi-card">
              <div className="inv-skpi-title">LOW STOCK REORDER ALERTS</div>
              <div className="inv-skpi-val-row">
                <span className="inv-skpi-val inv-text-red">{liveRmList.filter(r => (Number(r.availFactory) || 0) <= 1000).length}</span>
                <span className="inv-skpi-unit">Items</span>
              </div>
              <div className="inv-skpi-sub inv-text-red">Below buffer safety limits</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="inv-filter-bar">
            <div className="inv-search-input-wrap">
              <Search size={14} className="inv-search-icon" />
              <input
                type="text"
                placeholder="Search Material Code, Grade, Brand, Description..."
                className="inv-filter-search"
                value={rmSearch}
                onChange={e => setRmSearch(e.target.value)}
              />
            </div>

            <select
              className="inv-filter-select"
              value={rmCategoryFilter}
              onChange={e => setRmCategoryFilter(e.target.value)}
            >
              <option value="All">All Polymer Categories</option>
              {uniqueRmCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="inv-table-container">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>MATERIAL CODE</th>
                  <th>NAME &amp; DESCRIPTION</th>
                  <th>BRAND / GRADE</th>
                  <th>AVAILABLE IN FACTORY</th>
                  <th>AT JOB WORK</th>
                  <th>TOTAL BALANCE</th>
                  <th>RATE (₹)</th>
                  <th>VALUATION (₹)</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredRm.map(row => (
                  <tr
                    key={row.code}
                    onClick={() => handleOpenDrawer(row)}
                    style={{ cursor: 'pointer' }}
                    title={`Click to open material side drawer for ${row.code}`}
                  >
                    <td className="td-code">{row.code}</td>
                    <td>
                      <div className="inv-item-name">{row.name}</div>
                      <div className="inv-item-sub">{row.desc}</div>
                    </td>
                    <td>
                      <div className="inv-brand-name">{row.brand}</div>
                      <div className="inv-brand-sub">{row.grade}</div>
                    </td>
                    <td className="td-qty-green">{row.availFactory}</td>
                    <td className="td-qty-orange">{row.atJobWork}</td>
                    <td className="td-qty-blue">{row.totalBalance}</td>
                    <td className="td-rate">{row.rate}</td>
                    <td className="td-valuation">{row.valuation}</td>
                    <td>
                      <span className={`inv-status-badge ${row.status === 'LOW STOCK' ? 'inv-badge-lowstock' : 'inv-badge-instock'}`}>
                        • {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="inv-action-group" onClick={e => e.stopPropagation()}>
                        <button className="inv-btn-issue" onClick={triggerJWModal}>
                          Issue JW
                        </button>
                        <button className="inv-icon-btn" onClick={() => handleOpenDrawer(row)} title="Details">
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: Finished Goods (FG) ── */}
      {activeTab === 'fg' && (
        <div className="inv-section-card">
          <div className="inv-section-header">
            <div className="inv-title-group">
              <div className="inv-title-row-inner">
                <h2 className="inv-section-title">Finished Goods Inventory</h2>
                <span className="inv-tab-badge-green">{liveFgList.length} Product SKUs</span>
              </div>
              <p className="inv-section-subtitle">
                Track manufactured coils, reels, and hanks with free stock vs reserved stock allocation for customer orders.
              </p>
            </div>

            <button className="inv-btn-dark-pill" onClick={() => setShowAddProductModal(true)}>
              <Plus size={14} /> Add New Product SKU
            </button>
          </div>

          {/* 4 Summary Cards Row */}
          <div className="inv-summary-kpi-grid">
            <div className="inv-skpi-card">
              <div className="inv-skpi-title">TOTAL PHYSICAL STOCK</div>
              <div className="inv-skpi-val-row">
                <span className="inv-skpi-val">{fgStock.toLocaleString()}</span>
                <span className="inv-skpi-unit">Units</span>
              </div>
              <div className="inv-skpi-sub">Stored in factory warehouse</div>
            </div>

            <div className="inv-skpi-card">
              <div className="inv-skpi-title">RESERVED FOR ORDERS</div>
              <div className="inv-skpi-val-row">
                <span className="inv-skpi-val inv-text-blue">
                  {liveFgList.reduce((a, b) => a + (Number(b.reservedQty) || 0), 0).toLocaleString()}
                </span>
                <span className="inv-skpi-unit">Units</span>
              </div>
              <div className="inv-skpi-sub">Committed against Sales Orders</div>
            </div>

            <div className="inv-skpi-card inv-skpi-green">
              <div className="inv-skpi-title inv-skpi-title-green">AVAILABLE FREE STOCK</div>
              <div className="inv-skpi-val-row">
                <span className="inv-skpi-val inv-text-green">
                  {liveFgList.reduce((a, b) => a + Math.max(0, (Number(b.stockQty) || 0) - (Number(b.reservedQty) || 0)), 0).toLocaleString()}
                </span>
                <span className="inv-skpi-unit">Units</span>
              </div>
              <div className="inv-skpi-sub">Available to sell immediately</div>
            </div>

            <div className="inv-skpi-card">
              <div className="inv-skpi-title">INVENTORY VALUATION</div>
              <div className="inv-skpi-val-row">
                <span className="inv-skpi-val">₹{totalFgValuationLakhs}</span>
                <span className="inv-skpi-unit">Lakhs</span>
              </div>
              <div className="inv-skpi-sub">₹{totalFgValuationInr.toLocaleString()}</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="inv-filter-bar">
            <div className="inv-search-input-wrap">
              <Search size={14} className="inv-search-icon" />
              <input
                type="text"
                placeholder="Search Product Code, Name, Diameter, Color..."
                className="inv-filter-search"
                value={fgSearch}
                onChange={e => setFgSearch(e.target.value)}
              />
            </div>

            <select
              className="inv-filter-select"
              value={fgCategoryFilter}
              onChange={e => setFgCategoryFilter(e.target.value)}
            >
              <option value="All">All Product Categories</option>
              {uniqueFgCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="inv-table-container">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>PRODUCT CODE</th>
                  <th>PRODUCT SPECIFICATION</th>
                  <th>DIA &amp; COLOR</th>
                  <th>PHYSICAL STOCK</th>
                  <th>RESERVED</th>
                  <th>FREE STOCK</th>
                  <th>RATE / UNIT (₹)</th>
                  <th>STOCK VALUATION</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredFg.map(row => (
                  <tr
                    key={row.code}
                    onClick={() => handleOpenDrawer({
                      type: 'fg',
                      code: row.code,
                      name: row.name,
                      brand: 'Kamani Plastic Industries',
                      grade: row.diaColor,
                      availFactory: row.freeStock,
                      atJobWork: row.reserved,
                      totalBalance: row.physicalStock,
                    })}
                    style={{ cursor: 'pointer' }}
                    title={`Click to open product side drawer for ${row.code}`}
                  >
                    <td className="td-code">{row.code}</td>
                    <td>
                      <div className="inv-item-name">{row.name}</div>
                      <div className="inv-item-sub">{row.sub}</div>
                    </td>
                    <td>{row.diaColor}</td>
                    <td className="td-qty-blue">{row.physicalStock}</td>
                    <td className="td-qty-blue">{row.reserved}</td>
                    <td className="td-qty-green">{row.freeStock}</td>
                    <td className="td-rate">{row.rate}</td>
                    <td className="td-valuation">{row.valuation}</td>
                    <td>
                      <span className={`inv-status-badge ${row.status === 'LOW STOCK' ? 'inv-badge-lowstock' : 'inv-badge-instock'}`}>
                        • {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="inv-action-group" onClick={e => e.stopPropagation()}>
                        <button
                          className="inv-btn-ghost-sm"
                          onClick={() => {
                            setSelectedMaterial({ type: 'fg', code: row.code, name: row.name, freeStock: row.freeStock });
                            setShowAddFgStockModal(true);
                          }}
                        >
                          + Stock
                        </button>
                        <button className="inv-btn-issue" onClick={triggerSalesModal}>
                          Book Order
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Stock Movements Ledger ── */}
      {activeTab === 'movements' && (
        <div className="inv-section-card">
          <div className="inv-section-header">
            <div className="inv-title-group">
              <div className="inv-title-row-inner">
                <h2 className="inv-section-title">Stock Movements &amp; Audit Ledger</h2>
                <span className="inv-badge-blue">7 Recorded Transactions</span>
              </div>
              <p className="inv-section-subtitle">
                Immutable perpetual audit log of all raw material inward, job work dispatches, GRN returns, sales reservations, and customer dispatches.
              </p>
            </div>

            <button className="inv-btn-dark" onClick={() => exportToCsv('Inventory_Stock_Movements_Audit.csv', liveMovements)} style={{ cursor: 'pointer' }}>
              <Download size={14} /> Export Audit Trail
            </button>
          </div>

          {/* Filter Bar */}
          <div className="inv-filter-bar">
            <div className="inv-search-input-wrap">
              <Search size={14} className="inv-search-icon" />
              <input
                type="text"
                placeholder="Search Reference No (JW-..., DSP-..., SO-...), Item, Batch, Notes..."
                className="inv-filter-search"
                value={movementSearch}
                onChange={e => setMovementSearch(e.target.value)}
              />
            </div>

            <select
              className="inv-filter-select"
              value={movementTypeFilter}
              onChange={e => setMovementTypeFilter(e.target.value)}
            >
              <option value="All">All Transaction Types</option>
              <option value="Receipt">Purchase Receipts</option>
              <option value="JWIssue">Job Work Issues</option>
              <option value="JWReturn">Job Work Returns</option>
              <option value="Production">FG Production</option>
              <option value="Dispatch">Customer Dispatches</option>
            </select>
          </div>

          {/* Table */}
          <div className="inv-table-container">
            <table className="inv-table inv-movements-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '95px' }}>DATE &amp; TIME</th>
                  <th style={{ minWidth: '130px' }}>TRANSACTION TYPE</th>
                  <th style={{ minWidth: '160px' }}>REFERENCE DOCUMENT</th>
                  <th style={{ minWidth: '190px' }}>ITEM DESCRIPTION</th>
                  <th style={{ minWidth: '140px' }}>BATCH / LOT</th>
                  <th style={{ minWidth: '90px' }}>INWARD (+)</th>
                  <th style={{ minWidth: '90px' }}>OUTWARD (-)</th>
                  <th style={{ minWidth: '220px' }}>LOCATION</th>
                  <th style={{ minWidth: '280px' }}>AUDIT REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m, i) => (
                  <tr key={i}>
                    <td className="td-date">{m.time}</td>
                    <td>
                      <span className={`inv-status-badge ${m.typeBadge}`}>
                        {m.icon} {m.type}
                      </span>
                    </td>
                    <td className="td-code">{m.ref}</td>
                    <td>
                      <div className="inv-item-name">{m.item}</div>
                    </td>
                    <td><span className="jw-batch-text">{m.batch}</span></td>
                    <td className="td-qty-green">{m.inward}</td>
                    <td className="td-qty-orange">{m.outward}</td>
                    <td className="td-location-cell">{m.location}</td>
                    <td className="td-remarks-cell">{m.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: Batch Traceability Explorer ── */}
      {activeTab === 'traceability' && (
        <div className="inv-trace-container">
          <div className="inv-section-card">
            <div className="inv-section-header">
              <div className="inv-title-group">
                <div className="inv-title-row-inner">
                  <span className="inv-trace-icon">🧬</span>
                  <h2 className="inv-section-title">End-to-End Material Traceability Explorer</h2>
                </div>
                <p className="inv-section-subtitle">
                  Complete forward &amp; backward batch audit from raw polymer granules to final customer dispatch.
                </p>
              </div>

              <div className="inv-search-input-wrap" style={{ maxWidth: '300px' }}>
                <Search size={14} className="inv-search-icon" />
                <input
                  type="text"
                  placeholder="Enter Batch/JW/SO ID..."
                  className="inv-filter-search"
                  value={traceSearch}
                  onChange={e => setTraceSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Fast Trace Presets */}
            {liveJobWorks.length > 0 ? (
              (() => {
                const activeTraceJw = traceSearch.trim()
                  ? liveJobWorks.find(j =>
                      (j.jwNo || j.id || '').toLowerCase().includes(traceSearch.toLowerCase().trim()) ||
                      (j.vendor || '').toLowerCase().includes(traceSearch.toLowerCase().trim())
                    )
                  : liveJobWorks[0];

                if (traceSearch.trim() && !activeTraceJw) {
                  return (
                    <div style={{ padding: '50px 20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', marginTop: '16px' }}>
                      <GitBranch size={40} style={{ marginBottom: '12px', opacity: 0.4, color: '#dc2626' }} />
                      <h3 style={{ color: '#0f172a', marginBottom: '6px' }}>No Trace Lifecycle Found</h3>
                      <p style={{ margin: '0 auto', maxWidth: '420px', fontSize: '0.82rem' }}>
                        No material batch or Job Work records match "<strong>{traceSearch}</strong>". Please search by a valid Job Work ID (e.g. {liveJobWorks[0]?.jwNo || 'JW-2026-340'}).
                      </p>
                      <button
                        onClick={() => setTraceSearch('')}
                        style={{ marginTop: '14px', padding: '6px 14px', borderRadius: '6px', background: '#0f172a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.76rem' }}
                      >
                        Reset Trace Filter
                      </button>
                    </div>
                  );
                }

                const matchingFg = (liveFgList && liveFgList.length > 0) ? liveFgList[0] : null;
                const matchingDc = (liveDispatches && liveDispatches.length > 0) ? liveDispatches[0] : null;

                return (
                  <>
                    <div className="inv-preset-row">
                      <span className="preset-label">FAST TRACE PRESETS:</span>
                      {liveJobWorks.slice(0, 4).map((jw, i) => (
                        <button
                          key={i}
                          className={`preset-btn ${(traceSearch === (jw.jwNo || jw.id)) ? 'active-preset' : ''}`}
                          onClick={() => setTraceSearch(jw.jwNo || jw.id)}
                          style={{
                            cursor: 'pointer',
                            background: (traceSearch === (jw.jwNo || jw.id)) ? '#1e293b' : '#f8fafc',
                            color: (traceSearch === (jw.jwNo || jw.id)) ? '#ffffff' : '#334155',
                            borderColor: (traceSearch === (jw.jwNo || jw.id)) ? '#1e293b' : '#cbd5e1',
                            fontWeight: '600',
                            padding: '6px 12px',
                            borderRadius: '20px'
                          }}
                        >
                          {jw.jwNo || jw.id} ({jw.vendor || 'Vendor'})
                        </button>
                      ))}
                      {traceSearch && (
                        <button
                          className="preset-btn"
                          onClick={() => setTraceSearch('')}
                          style={{ cursor: 'pointer', background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5', padding: '6px 10px', borderRadius: '20px' }}
                        >
                          Clear Filter ✕
                        </button>
                      )}
                    </div>

                    {/* Connected Manufacturing Lifecycle Visualizer */}
                    <div className="inv-visualizer-card" style={{ marginTop: '16px' }}>
                      <div className="inv-vis-header">
                        <div className="inv-vis-title">
                          ⚡ CONNECTED MANUFACTURING LIFECYCLE VISUALIZER
                        </div>
                        <span className="inv-vis-audit-id">Audit ID: {activeTraceJw?.jwNo || activeTraceJw?.id || 'LIVE-AUDIT'}</span>
                      </div>

                      <div className="inv-flow-nodes" style={{ display: 'flex', alignItems: 'center', gap: '12px', overflowX: 'auto', padding: '12px 0' }}>
                        {/* Node 1: Raw Material */}
                        <div className="inv-flow-node" style={{ minWidth: '160px' }}>
                          <div className="node-header">
                            <span className="node-num">1. Raw Material</span>
                            <span className="node-dot dot-blue" />
                          </div>
                          <div className="node-title">{activeTraceJw?.rawMat || 'Reliance Repol'}</div>
                          <div className="node-sub">Code: {activeTraceJw?.rawMaterialId || 'RM-PP-001'}</div>
                          <div className="node-highlight blue">Inward Lot</div>
                        </div>

                        <ArrowRight size={16} className="node-arrow" />

                        {/* Node 2: Job Work Issue */}
                        <div className="inv-flow-node node-active" style={{ minWidth: '170px' }}>
                          <div className="node-header">
                            <span className="node-num">2. Job Work Issue</span>
                            <span className="node-dot dot-orange" />
                          </div>
                          <div className="node-title">{activeTraceJw?.jwNo || 'JW Order'}</div>
                          <div className="node-sub">{activeTraceJw?.vendor || 'Shree Plastic Works'}</div>
                          <div className="node-highlight orange">Dispatched: {activeTraceJw?.sentQty || `${activeTraceJw?.sentQtyKg || 2000} KG`}</div>
                        </div>

                        <ArrowRight size={16} className="node-arrow" />

                        {/* Node 3: GRN Receipt */}
                        <div className="inv-flow-node" style={{ minWidth: '170px' }}>
                          <div className="node-header">
                            <span className="node-num">3. GRN Return</span>
                            <span className="node-dot dot-green" />
                          </div>
                          <div className="node-title">GRN-{activeTraceJw?.jwNo || 'REC'}</div>
                          <div className="node-sub">Recd: {activeTraceJw?.recQty || `${activeTraceJw?.recQtyKg || 0} KG`}</div>
                          <div className="node-highlight green">Status: {activeTraceJw?.status || 'RECEIVED'}</div>
                        </div>

                        <ArrowRight size={16} className="node-arrow" />

                        {/* Node 4: Finished Goods */}
                        <div className="inv-flow-node" style={{ minWidth: '170px' }}>
                          <div className="node-header">
                            <span className="node-num">4. Finished Goods</span>
                            <span className="node-dot dot-blue" />
                          </div>
                          <div className="node-title">{matchingFg?.name || 'PP Danline 6mm'}</div>
                          <div className="node-sub">Code: {matchingFg?.code || 'FG-PPD-06-YL'}</div>
                          <div className="node-highlight blue">{matchingFg ? `${matchingFg.stockQty} Coils` : 'In Stock'}</div>
                        </div>

                        <ArrowRight size={16} className="node-arrow" />

                        {/* Node 5: Outward Dispatch */}
                        <div className="inv-flow-node" style={{ minWidth: '170px' }}>
                          <div className="node-header">
                            <span className="node-num">5. Outward Dispatch</span>
                            <span className="node-dot dot-purple" />
                          </div>
                          <div className="node-title">{matchingDc?.challanNo || matchingDc?.dispatchNo || 'DC-Challan'}</div>
                          <div className="node-sub">{matchingDc?.customer || 'ABC Marine Traders'}</div>
                          <div className="node-highlight green">{matchingDc ? `${matchingDc.dispatchedQtyCoils || 300} Dispatched` : 'Dispatched'}</div>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <GitBranch size={36} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <h3>No Material Batch Traceability Data</h3>
                <p>Add a Raw Material or Issue a Job Work to visualize end-to-end batch genealogy.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Local Modals & Drawers ── */}
      {showJWModal && <NewJobWorkModal onClose={() => setShowJWModal(false)} />}
      {showSalesModal && <SalesOrderModal mode="sales" onClose={() => setShowSalesModal(false)} />}
      {showAddRmModal && <AddRawMaterialModal onClose={() => setShowAddRmModal(false)} onSave={handleSaveRmModal} />}
      {showAddProductModal && <AddProductSkuModal onClose={() => setShowAddProductModal(false)} onSave={handleSaveProductModal} />}
      {showAddFgStockModal && (
        <AddFinishedGoodsStockModal
          material={selectedMaterial}
          onClose={() => setShowAddFgStockModal(false)}
          onSuccess={handleSaveFgStockModal}
        />
      )}
      <MaterialDetailDrawer
        material={selectedMaterial}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onIssueJW={triggerJWModal}
        onAddProduction={() => setShowAddFgStockModal(true)}
      />
    </div>
  );
}
