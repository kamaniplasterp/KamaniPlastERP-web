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
import RawMaterialInwardModal from '../modals/RawMaterialInwardModal';
import IssueToFactoryModal from '../modals/IssueToFactoryModal';
import AddProductSkuModal from '../modals/AddProductSkuModal';
import MaterialDetailDrawer from '../drawers/MaterialDetailDrawer';
import AddFinishedGoodsStockModal from '../modals/AddFinishedGoodsStockModal';
import { useWorkflow } from '../context/WorkflowContext';
import { 
  subscribeRawMaterials, 
  subscribeFinishedGoods, 
  subscribeStockMovements, 
  subscribeRmInwards,
  subscribeRmFactoryIssues,
  addRawMaterial, 
  addFinishedGood, 
  updateFgStock, 
  logStockMovement 
} from '../api/inventory.api';
import { subscribeJobWorks } from '../api/jobwork.api';
import { subscribeSalesOrders, subscribeDispatches } from '../api/sales.api';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { exportToCsv } from '../utils/exportCsv';
import '../styles/InventoryStock.css';



export default function InventoryStockView({ onOpenJobWork, onOpenSalesOrder }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { rmStock, jobWorkStock, fgStock } = useWorkflow();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'rm');
  const [rmSubView, setRmSubView] = useState('ledger'); // 'ledger' | 'inward' | 'issue'

  const [liveRmList, setLiveRmList] = useState([]);
  const [liveFgList, setLiveFgList] = useState([]);
  const [liveMovements, setLiveMovements] = useState([]);
  const [liveJobWorks, setLiveJobWorks] = useState([]);
  const [liveDispatches, setLiveDispatches] = useState([]);
  const [liveOrders, setLiveOrders] = useState([]);
  const [liveRmInwards, setLiveRmInwards] = useState([]);
  const [liveRmIssues, setLiveRmIssues] = useState([]);

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
    const unsubSo = subscribeSalesOrders(setLiveOrders);
    const unsubInw = subscribeRmInwards(setLiveRmInwards);
    const unsubIss = subscribeRmFactoryIssues(setLiveRmIssues);
    return () => {
      unsubRm();
      unsubFg();
      unsubMov();
      unsubJw();
      unsubDc();
      unsubSo();
      unsubInw();
      unsubIss();
    };
  }, []);

  const [rmSearch, setRmSearch] = useState('');
  const [rmCategoryFilter, setRmCategoryFilter] = useState('All');
  const [fgSearch, setFgSearch] = useState('');
  const [fgCategoryFilter, setFgCategoryFilter] = useState('All');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('All');
  const [traceSearch, setTraceSearch] = useState('');
  const [showJWModal, setShowJWModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showAddRmModal, setShowAddRmModal] = useState(false);
  const [showRmInwardModal, setShowRmInwardModal] = useState(false);
  const [showIssueFactoryModal, setShowIssueFactoryModal] = useState(false);
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
    const qtyNum = Number(stockData.qty || 0);
    if (qtyNum <= 0) {
      alert('Please enter a valid inward quantity greater than 0.');
      return;
    }

    try {
      const target = liveFgList.find(f => 
        (selectedMaterial?.id && f.id === selectedMaterial.id) ||
        (selectedMaterial?.code && f.code === selectedMaterial.code) ||
        (selectedMaterial?.name && f.name === selectedMaterial.name)
      );

      const targetId = target?.id || selectedMaterial?.id;
      const targetName = target?.name || selectedMaterial?.name || 'Finished Goods';

      if (targetId) {
        await updateFgStock(targetId, qtyNum, 0);
      } else {
        await addFinishedGood({
          code: selectedMaterial?.code || `FG-${Math.floor(100 + Math.random() * 900)}`,
          name: targetName,
          category: selectedMaterial?.category || 'Danline Rope',
          stockQty: qtyNum,
          rate: Number(selectedMaterial?.rate || 245)
        });
      }

      await logStockMovement({
        type: 'Production',
        typeBadge: 'inv-badge-prod',
        icon: '⚙️',
        ref: stockData.batchNo || `BATCH-FG-${Math.floor(Math.random() * 900 + 100)}`,
        item: targetName,
        batch: stockData.batchNo || 'BATCH-FG-INWARD',
        inward: `+${qtyNum} Coils`,
        outward: '0',
        location: 'Finished Goods Bay',
        remarks: stockData.notes || 'Inward stock from production'
      });

      alert(`Successfully added ${qtyNum} Coils for ${targetName}!`);
      setShowAddFgStockModal(false);
      setIsDrawerOpen(false);
    } catch (err) {
      console.error('Error adding finished goods stock:', err);
      alert('Failed to update finished goods stock. Please try again.');
    }
  };

  const displayRmList = liveRmList.map(rm => {
    const rawName = rm.name || '';
    const rawGrade = rm.grade || rm.brand || '';
    
    // Inward from GRNs
    const matchingInwards = liveRmInwards.filter(inw => 
      inw.itemName === rawName || 
      inw.grade === rawGrade || 
      (inw.itemName && rawName && inw.itemName.toLowerCase().includes(rawName.toLowerCase()))
    );
    const totalInwardKg = matchingInwards.reduce((sum, i) => sum + (Number(i.netWeight) || 0), 0) || (Number(rm.availFactory || 0) + Number(rm.atJobWork || 0));

    // Outward at JW
    const totalOutwardAtJw = Number(rm.atJobWork || 0);

    // Factory issue
    const matchingIssues = liveRmIssues.filter(iss => 
      iss.rawMaterialId === rm.id || 
      iss.itemName === rawName
    );
    const totalFactoryIssueKg = matchingIssues.reduce((sum, i) => sum + (Number(i.netWeight) || 0), 0);

    const factoryBalanceKg = Number(rm.availFactory || 0);
    const rateNum = Number(rm.rate) || 112;
    const valuationNum = (factoryBalanceKg + totalOutwardAtJw) * rateNum;

    return {
      id: rm.id,
      code: rm.code || 'RM-SKU',
      name: rawName || 'Raw Material',
      desc: rm.desc || `Polymer ${rm.category || 'Granules'}`,
      brand: rm.brand || 'Generic',
      grade: rawGrade || 'Standard',
      inwardKg: `${totalInwardKg.toLocaleString()} KG`,
      inwardKgNum: totalInwardKg,
      outwardAtJw: `${totalOutwardAtJw.toLocaleString()} KG`,
      outwardAtJwNum: totalOutwardAtJw,
      factoryIssueKg: `${totalFactoryIssueKg.toLocaleString()} KG`,
      factoryIssueKgNum: totalFactoryIssueKg,
      availFactory: `${factoryBalanceKg.toLocaleString()} KG`,
      availFactoryNum: factoryBalanceKg,
      totalBalance: `${(factoryBalanceKg + totalOutwardAtJw).toLocaleString()} KG`,
      rate: `₹${rateNum}`,
      rateNum,
      valuation: `₹${valuationNum.toLocaleString()}`,
      valuationNum,
      status: factoryBalanceKg > (Number(rm.reorderLevel) || 1000) ? 'IN STOCK' : factoryBalanceKg > 0 ? 'LOW STOCK' : 'OUT OF STOCK'
    };
  });

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

  const filteredRmInwards = liveRmInwards.filter(inw => {
    const matchesQuery =
      (inw.grnNo || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (inw.challanNo || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (inw.supplierName || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (inw.itemName || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (inw.grade || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (inw.receivedBy || '').toLowerCase().includes(activeRmQuery.toLowerCase());
    return matchesQuery;
  });

  const filteredRmIssues = liveRmIssues.filter(iss => {
    const matchesQuery =
      (iss.slipNo || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (iss.itemName || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (iss.grade || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (iss.issuedBy || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (iss.remarks || '').toLowerCase().includes(activeRmQuery.toLowerCase());
    return matchesQuery;
  });

  // RM Stock Comp (Module 13: Excel Sheet 'RM Stock Comp' Reconciliation)
  const rmCompList = liveRmList.map(rm => {
    const itemName = rm.name || '';
    const grade = rm.grade || '';

    // Inwards for this item
    const matchingInwards = liveRmInwards.filter(inw => 
      (inw.itemName || '').toLowerCase() === itemName.toLowerCase() ||
      (inw.rawMaterialId && inw.rawMaterialId === rm.id)
    );
    const totalInwardKg = matchingInwards.reduce((s, inw) => s + (Number(inw.netWeight) || 0), 0);

    // Factory issues for this item
    const matchingIssues = liveRmIssues.filter(iss => 
      (iss.itemName || '').toLowerCase() === itemName.toLowerCase() ||
      (iss.rawMaterialId && iss.rawMaterialId === rm.id)
    );
    const totalIssueKg = matchingIssues.reduce((s, iss) => s + (Number(iss.netWeight) || 0), 0);

    // Job work movements for this item
    const matchingJobWorks = liveJobWorks.filter(jw => 
      (jw.material || '').toLowerCase().includes(itemName.toLowerCase()) ||
      (jw.rawMaterialId && jw.rawMaterialId === rm.id)
    );
    const jwOutwardKg = matchingJobWorks.reduce((s, jw) => s + (Number(jw.inputQty) || 0), 0);
    const jwInwardKg = matchingJobWorks.reduce((s, jw) => s + (Number(jw.recQtyKg) || Number(jw.receivedQty) || 0), 0);

    const initialStock = Number(rm.initialStock) || 0;
    const computedBal = Math.max(0, initialStock + totalInwardKg - totalIssueKg - jwOutwardKg + jwInwardKg);
    const ledgerBal = Number(rm.availFactory) || 0;
    const variance = ledgerBal - computedBal;

    return {
      id: rm.id,
      code: rm.code || 'RM',
      name: itemName,
      grade: grade,
      category: rm.category || 'Polymer',
      initialStock,
      totalInwardKg,
      totalIssueKg,
      jwOutwardKg,
      jwInwardKg,
      computedBal,
      ledgerBal,
      variance
    };
  });

  const filteredRmComp = rmCompList.filter(item => {
    return (
      (item.code || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (item.name || '').toLowerCase().includes(activeRmQuery.toLowerCase()) ||
      (item.grade || '').toLowerCase().includes(activeRmQuery.toLowerCase())
    );
  });

  // Auto-heal completed orders and FG reservations in Firestore
  useEffect(() => {
    if (!db) return;

    // 1. If an order is fully dispatched or completed, ensure reservedCoils and balanceCoils are 0 in Firestore
    liveOrders.forEach(async (o) => {
      const ordered = Number(o.orderedQtyCoils) || 0;
      const disp = Number(o.dispatchedCoils) || 0;
      const isCompleted = o.status === 'COMPLETED' || (disp >= ordered && ordered > 0);
      if (isCompleted && (Number(o.reservedCoils) > 0 || Number(o.balanceCoils) > 0)) {
        try {
          await updateDoc(doc(db, 'salesOrders', o.id), {
            reserved: '0 Coils',
            reservedCoils: 0,
            balance: '0 Coils',
            balanceCoils: 0,
            status: 'COMPLETED',
            statusClass: 'pill-completed',
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn('Error auto-healing completed SO in Firestore:', e);
        }
      }
    });

    // 2. If an FG SKU has no active open orders, ensure reservedQty in Firestore is 0
    liveFgList.forEach(async (fg) => {
      const hasOpenOrder = liveOrders.some(o => 
        o.status !== 'COMPLETED' && 
        o.status !== 'DELIVERED' && 
        o.status !== 'DISPATCHED' && 
        o.status !== 'CANCELLED' && 
        (Number(o.balanceCoils) > 0 || (o.balanceCoils === undefined && (Number(o.orderedQtyCoils) - Number(o.dispatchedCoils || 0) > 0))) &&
        (
          (o.fgSkuId && (o.fgSkuId === fg.id || o.fgSkuId === fg.code)) || 
          (o.fgSkuCode && (o.fgSkuCode === fg.code || o.fgSkuCode === fg.id)) || 
          (o.itemSummary && fg.name && o.itemSummary.toLowerCase().trim() === fg.name.toLowerCase().trim())
        )
      );
      if (!hasOpenOrder && Number(fg.reservedQty) > 0) {
        try {
          await updateDoc(doc(db, 'finishedGoods', fg.id), {
            reservedQty: 0,
            freeStockQty: Number(fg.stockQty) || 0,
            updatedAt: serverTimestamp()
          });
        } catch (e) {
          console.warn('Error auto-healing FG reserved stock in Firestore:', e);
        }
      }
    });
  }, [liveOrders, liveFgList]);

  const displayFgList = liveFgList.map(fg => {
    // Dynamically match active, unfulfilled sales orders to this SKU
    const matchingOrders = liveOrders.filter(o => 
      o.status !== 'COMPLETED' && 
      o.status !== 'DELIVERED' && 
      o.status !== 'DISPATCHED' && 
      o.status !== 'CANCELLED' && 
      (Number(o.balanceCoils) > 0 || (o.balanceCoils === undefined && (Number(o.orderedQtyCoils) - Number(o.dispatchedCoils || 0) > 0))) &&
      (
        (o.fgSkuId && (o.fgSkuId === fg.id || o.fgSkuId === fg.code)) || 
        (o.fgSkuCode && (o.fgSkuCode === fg.code || o.fgSkuCode === fg.id)) || 
        (o.itemSummary && fg.name && o.itemSummary.toLowerCase().trim() === fg.name.toLowerCase().trim())
      )
    );

    const calculatedReservedFromOrders = matchingOrders.reduce((sum, o) => {
      const ordered = Number(o.orderedQtyCoils) || 0;
      const disp = Number(o.dispatchedCoils) || 0;
      const bal = typeof o.balanceCoils === 'number' ? o.balanceCoils : Math.max(0, ordered - disp);
      const res = typeof o.reservedCoils === 'number' ? Math.min(o.reservedCoils, bal) : bal;
      return sum + Math.max(0, res);
    }, 0);

    // If no pending orders exist for this SKU, reservation is strictly 0
    const finalReservedCoils = matchingOrders.length > 0 
      ? Math.max(0, calculatedReservedFromOrders)
      : 0;
    const physicalQty = Number(fg.stockQty) || 0;
    const freeQty = Math.max(0, physicalQty - finalReservedCoils);

    return {
      id: fg.id,
      code: fg.code || 'FG-SKU',
      name: fg.name || 'Finished Good',
      sub: fg.desc || `${fg.category || 'Danline Rope'} • Length: KG/Coil`,
      diaColor: fg.diaColor || '6 mm • Bright Yellow',
      physicalStock: `${physicalQty.toLocaleString()} Coils`,
      physicalStockNum: physicalQty,
      reserved: `${finalReservedCoils.toLocaleString()} Coils`,
      reservedNum: finalReservedCoils,
      freeStock: `${freeQty.toLocaleString()} Coils`,
      freeStockNum: freeQty,
      rate: typeof fg.rate === 'number' ? `₹${fg.rate.toLocaleString()}` : fg.rate || '₹0',
      valuation: `₹${(physicalQty * (Number(fg.rate) || 2450)).toLocaleString()}`,
      status: physicalQty >= (Number(fg.reorderLevel) || 50) ? 'IN STOCK' : (physicalQty > 0 ? 'LOW STOCK' : 'OUT OF STOCK')
    };
  });

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
                <h2 className="inv-section-title">Raw Materials Inventory &amp; Registers</h2>
                <span className="inv-badge-blue">{displayRmList.length} SKU Materials</span>
              </div>
              <p className="inv-section-subtitle">
                Excel-aligned Raw Material Inward (GRN), Factory Issue Consumption, and Job Worker Outward balance.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                className="inv-btn-dark-pill" 
                onClick={() => setShowRmInwardModal(true)}
                style={{ background: '#16a34a', color: '#ffffff', borderColor: '#16a34a' }}
                title="Record Raw Material Inward with Gross/Tare Deductions"
              >
                <Plus size={14} /> Inward RM (GRN)
              </button>
              <button 
                className="inv-btn-dark-pill" 
                onClick={() => setShowIssueFactoryModal(true)}
                style={{ background: '#7c3aed', color: '#ffffff', borderColor: '#7c3aed' }}
                title="Issue Material to Factory Extrusion Plant"
              >
                <Plus size={14} /> Issue to Factory
              </button>
            </div>
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

          {/* Sub-view Selector Tabs for RM Module */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '14px 0 10px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
            <button
              onClick={() => setRmSubView('ledger')}
              style={{
                background: rmSubView === 'ledger' ? '#0f172a' : '#f1f5f9',
                color: rmSubView === 'ledger' ? '#ffffff' : '#475569',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              📊 RM Stock Ledger (Excel: RM Stock)
            </button>
            <button
              onClick={() => setRmSubView('inward')}
              style={{
                background: rmSubView === 'inward' ? '#16a34a' : '#f1f5f9',
                color: rmSubView === 'inward' ? '#ffffff' : '#475569',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              📥 Inward Register (GRN) ({liveRmInwards.length})
            </button>
            <button
              onClick={() => setRmSubView('issue')}
              style={{
                background: rmSubView === 'issue' ? '#7c3aed' : '#f1f5f9',
                color: rmSubView === 'issue' ? '#ffffff' : '#475569',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              🏭 Issue to Factory Register ({liveRmIssues.length})
            </button>
            <button
              onClick={() => setRmSubView('comp')}
              style={{
                background: rmSubView === 'comp' ? '#ea580c' : '#f1f5f9',
                color: rmSubView === 'comp' ? '#ffffff' : '#475569',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              ⚖️ Stock Reconciliation (Sheet: RM Stock Comp)
            </button>
          </div>

          {/* Filter Bar */}
          <div className="inv-filter-bar">
            <div className="inv-search-input-wrap">
              <Search size={14} className="inv-search-icon" />
              <input
                type="text"
                placeholder="Search Item Name, Grade, Supplier, GRN No..."
                className="inv-filter-search"
                value={rmSearch}
                onChange={e => setRmSearch(e.target.value)}
              />
            </div>

            {rmSubView === 'ledger' && (
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
            )}

            <button 
              className="jw-btn-ghost" 
              onClick={() => {
                if (rmSubView === 'ledger') exportToCsv('RM_Stock_Ledger.csv', filteredRm);
                else if (rmSubView === 'inward') exportToCsv('RM_Inward_Register.csv', filteredRmInwards);
                else exportToCsv('RM_Factory_Issue_Register.csv', filteredRmIssues);
              }}
              style={{ cursor: 'pointer', marginLeft: 'auto' }}
            >
              <Download size={13} /> Export CSV
            </button>
          </div>

          {/* SUB-VIEW 1: RM Stock Balance Ledger (Sheets: RM Stock & RM stock comp) */}
          {rmSubView === 'ledger' && (
            <div className="inv-table-container">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>ITEM NAME</th>
                    <th>GRADE</th>
                    <th style={{ textAlign: 'right' }}>INWARD</th>
                    <th style={{ textAlign: 'right' }}>OUTWARD</th>
                    <th style={{ textAlign: 'right' }}>ISSUE</th>
                    <th style={{ textAlign: 'right' }}>BALANCE</th>
                    <th style={{ textAlign: 'right' }}>RATE</th>
                    <th style={{ textAlign: 'right' }}>VALUATION</th>
                    <th>STATUS</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRm.map(row => (
                    <tr
                      key={row.id || row.code}
                      onClick={() => handleOpenDrawer(row)}
                      style={{ cursor: 'pointer' }}
                      title={`Click to open material side drawer for ${row.name} ^ ${row.grade}`}
                    >
                      <td>
                        <div className="inv-item-name" style={{ fontWeight: '700' }}>{row.name}</div>
                        <div className="inv-item-sub">{row.code} • {row.brand}</div>
                      </td>
                      <td>
                        <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: '700', color: '#1e293b' }}>
                          {row.grade}
                        </span>
                      </td>
                      <td className="td-qty" style={{ textAlign: 'right', fontWeight: '600' }}>{row.inwardKg}</td>
                      <td className="td-qty-orange" style={{ textAlign: 'right', fontWeight: '600' }}>{row.outwardAtJw}</td>
                      <td className="td-qty" style={{ textAlign: 'right', color: '#7c3aed', fontWeight: '600' }}>{row.factoryIssueKg}</td>
                      <td className="td-qty-green" style={{ textAlign: 'right', fontWeight: '700', fontSize: '0.92rem' }}>{row.availFactory}</td>
                      <td className="td-rate" style={{ textAlign: 'right' }}>{row.rate}</td>
                      <td className="td-valuation" style={{ textAlign: 'right', fontWeight: '700' }}>{row.valuation}</td>
                      <td>
                        <span className={`inv-status-badge ${row.status === 'LOW STOCK' ? 'inv-badge-lowstock' : (row.status === 'OUT OF STOCK' ? 'inv-badge-out' : 'inv-badge-instock')}`}>
                          • {row.status}
                        </span>
                      </td>
                      <td>
                        <div className="inv-action-group" onClick={e => e.stopPropagation()}>
                          <button className="inv-btn-issue" onClick={triggerJWModal} title="Issue to Job Worker">
                            Issue JW
                          </button>
                          <button 
                            className="inv-btn-issue" 
                            style={{ background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }} 
                            onClick={() => setShowIssueFactoryModal(true)}
                            title="Issue to Factory"
                          >
                            Issue Plant
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* SUB-VIEW 2: Raw Material Inward Register (Sheet: Raw Material Inward) */}
          {rmSubView === 'inward' && (
            <div className="inv-table-container">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>GRN NO.</th>
                    <th>CHALLAN NO.</th>
                    <th>DATE</th>
                    <th>CHL. NO. @ PARTY NAME</th>
                    <th>SUPPLIER NAME</th>
                    <th>ITEM NAME</th>
                    <th>GRADE</th>
                    <th style={{ textAlign: 'right' }}>GROSS WEIGHT (G. WGHT.)</th>
                    <th style={{ textAlign: 'right' }}>NO. OF ARTICLES</th>
                    <th>ARTICLE TYPE</th>
                    <th style={{ textAlign: 'right' }}>ARTICLE WEIGHT (ART. WGHT.)</th>
                    <th style={{ textAlign: 'right' }}>NET WEIGHT (N. WGHT.)</th>
                    <th>RECEIVED BY</th>
                    <th>REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRmInwards.length === 0 ? (
                    <tr>
                      <td colSpan="14" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No Raw Material Inward records found. Click <strong>+ Inward RM (GRN)</strong> to record your first polymer receipt.
                      </td>
                    </tr>
                  ) : (
                    filteredRmInwards.map((inw, idx) => (
                      <tr key={inw.id || idx}>
                        <td className="td-code" style={{ fontWeight: '700', color: '#16a34a' }}>{inw.grnNo}</td>
                        <td>{inw.challanNo || '-'}</td>
                        <td>{inw.date}</td>
                        <td style={{ fontSize: '0.78rem', color: '#475569', fontWeight: '600' }}>
                          {inw.challanNo ? `${inw.challanNo} @ ${inw.supplierName}` : `- @ ${inw.supplierName}`}
                        </td>
                        <td style={{ fontWeight: '600' }}>{inw.supplierName}</td>
                        <td>{inw.itemName}</td>
                        <td>
                          <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600' }}>
                            {inw.grade}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{Number(inw.grossWeight || 0).toLocaleString()} KG</td>
                        <td style={{ textAlign: 'right' }}>{inw.noOfArticles || 0}</td>
                        <td>{inw.articleType || 'BORA'}</td>
                        <td style={{ textAlign: 'right', color: '#dc2626' }}>-{inw.articleWeight || 0} KG</td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: '#16a34a' }}>
                          {Number(inw.netWeight || 0).toLocaleString()} KG
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                            👤 {inw.receivedBy || 'SURESHBHAI'}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.75rem', color: '#64748b' }}>{inw.remarks || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SUB-VIEW 3: Issue To Factory Register (Sheet: Issue To Factory) */}
          {rmSubView === 'issue' && (
            <div className="inv-table-container">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>SLIP NO.</th>
                    <th>DATE</th>
                    <th>ITEM NAME</th>
                    <th style={{ textAlign: 'right' }}>GROSS WEIGHT</th>
                    <th style={{ textAlign: 'right' }}>ARTICLE WEIGHT</th>
                    <th style={{ textAlign: 'right' }}>NET WEIGHT</th>
                    <th style={{ textAlign: 'right' }}>QUANTITY</th>
                    <th>ISSUED BY</th>
                    <th>REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRmIssues.length === 0 ? (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No Factory Issue records found. Click <strong>+ Issue to Factory</strong> to record internal extrusion consumption.
                      </td>
                    </tr>
                  ) : (
                    filteredRmIssues.map((iss, idx) => (
                      <tr key={iss.id || idx}>
                        <td className="td-code" style={{ fontWeight: '700', color: '#7c3aed' }}>{iss.slipNo}</td>
                        <td>{iss.date}</td>
                        <td style={{ fontWeight: '600' }}>{iss.itemName} {iss.grade ? `^ ${iss.grade}` : ''}</td>
                        <td style={{ textAlign: 'right' }}>{Number(iss.grossWeight || 0).toLocaleString()} KG</td>
                        <td style={{ textAlign: 'right', color: '#dc2626' }}>-{iss.articleWeight || 0} KG</td>
                        <td style={{ textAlign: 'right', fontWeight: '800', color: '#7c3aed' }}>
                          {Number(iss.netWeight || 0).toLocaleString()} KG
                        </td>
                        <td style={{ textAlign: 'right' }}>{iss.quantity || 1}</td>
                        <td>
                          <span style={{ fontSize: '0.75rem', background: '#f5f3ff', color: '#6b21a8', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                            👤 {iss.issuedBy || 'SURESHBHAI'}
                          </span>
                        </td>
                        <td>{iss.remarks || 'Plant Extrusion Line'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* SUB-VIEW 4: RM Stock Comp / Reconciliation (Sheet: RM Stock Comp) */}
          {rmSubView === 'comp' && (
            <div className="inv-table-container">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>RM CODE</th>
                    <th>ITEM NAME</th>
                    <th>GRADE / SPEC</th>
                    <th style={{ textAlign: 'right' }}>INITIAL (KG)</th>
                    <th style={{ textAlign: 'right' }}>TOTAL INWARD (KG)</th>
                    <th style={{ textAlign: 'right' }}>TOTAL ISSUE (KG)</th>
                    <th style={{ textAlign: 'right' }}>JW OUTWARD (KG)</th>
                    <th style={{ textAlign: 'right' }}>JW INWARD (KG)</th>
                    <th style={{ textAlign: 'right', background: '#f8fafc' }}>COMPUTED BAL</th>
                    <th style={{ textAlign: 'right', background: '#f0f9ff' }}>LEDGER BAL</th>
                    <th style={{ textAlign: 'right' }}>VARIANCE</th>
                    <th style={{ textAlign: 'center' }}>AUDIT STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRmComp.length === 0 ? (
                    <tr>
                      <td colSpan="12" style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>
                        No matching raw materials found for reconciliation.
                      </td>
                    </tr>
                  ) : (
                    filteredRmComp.map((comp, idx) => {
                      const isMatch = Math.abs(comp.variance) < 0.01;
                      return (
                        <tr key={comp.id || idx}>
                          <td className="td-code" style={{ fontWeight: '700' }}>{comp.code}</td>
                          <td style={{ fontWeight: '600' }}>{comp.name}</td>
                          <td><span className="inv-badge-gray">{comp.grade || 'Standard'}</span></td>
                          <td style={{ textAlign: 'right' }}>{comp.initialStock.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 'bold' }}>
                            +{comp.totalInwardKg.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', color: '#7c3aed', fontWeight: 'bold' }}>
                            -{comp.totalIssueKg.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', color: '#ea580c' }}>
                            -{comp.jwOutwardKg.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', color: '#0284c7' }}>
                            +{comp.jwInwardKg.toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800', background: '#f8fafc' }}>
                            {comp.computedBal.toLocaleString()} KG
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800', color: '#0284c7', background: '#f0f9ff' }}>
                            {comp.ledgerBal.toLocaleString()} KG
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '800', color: isMatch ? '#16a34a' : '#dc2626' }}>
                            {isMatch ? '0.00 KG' : `${comp.variance > 0 ? '+' : ''}${comp.variance.toLocaleString()} KG`}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isMatch ? (
                              <span style={{ background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>
                                ✓ BALANCED
                              </span>
                            ) : (
                              <span style={{ background: '#fee2e2', color: '#b91c1c', padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '700' }}>
                                ⚠ VARIANCE
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
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
                  {displayFgList.reduce((a, b) => a + b.reservedNum, 0).toLocaleString()}
                </span>
                <span className="inv-skpi-unit">Units</span>
              </div>
              <div className="inv-skpi-sub">Committed against Sales Orders</div>
            </div>

            <div className="inv-skpi-card inv-skpi-green">
              <div className="inv-skpi-title inv-skpi-title-green">AVAILABLE FREE STOCK</div>
              <div className="inv-skpi-val-row">
                <span className="inv-skpi-val inv-text-green">
                  {displayFgList.reduce((a, b) => a + b.freeStockNum, 0).toLocaleString()}
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
                      id: row.id,
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
                            setSelectedMaterial({ id: row.id, type: 'fg', code: row.code, name: row.name, freeStock: row.freeStock });
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
      {showRmInwardModal && <RawMaterialInwardModal onClose={() => setShowRmInwardModal(false)} />}
      {showIssueFactoryModal && <IssueToFactoryModal rmList={liveRmList} onClose={() => setShowIssueFactoryModal(false)} />}
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
