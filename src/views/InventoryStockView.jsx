import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layers, Package, History, GitBranch, Search, Plus, ArrowUpRight,
  AlertTriangle, ArrowUpDown, ChevronRight, Filter, Download,
  CheckCircle2, ArrowRight, Truck, FileText, Scale, BookOpen, Edit3, Check, Calendar,
  Printer, Clock, ShieldCheck, X, CheckSquare, XCircle, MapPin, ClipboardCheck,
  BarChart3, ChevronDown, ChevronUp
} from 'lucide-react';
import NewJobWorkModal from '../modals/NewJobWorkModal';
import SalesOrderModal from '../modals/SalesOrderModal';
import AddRawMaterialModal from '../modals/AddRawMaterialModal';
import RawMaterialInwardModal from '../modals/RawMaterialInwardModal';
import IssueToFactoryModal from '../modals/IssueToFactoryModal';
import AddProductSkuModal from '../modals/AddProductSkuModal';
import MaterialDetailDrawer from '../drawers/MaterialDetailDrawer';
import BagDetailDrawer from '../drawers/BagDetailDrawer';
import GrnDetailView from '../views/GrnDetailView';
import AddFinishedGoodsStockModal from '../modals/AddFinishedGoodsStockModal';
import AddBagBatchModal from '../modals/AddBagBatchModal';
import QcCheckModal from '../modals/QcCheckModal';
import QuickBagLookupModal from '../modals/QuickBagLookupModal';
import HeaderInfoTooltip from '../components/HeaderInfoTooltip';
import PageHeader, { HeaderButton } from '../components/PageHeader';
import { useWorkflow } from '../context/WorkflowContext';
import { 
  subscribeRawMaterials, 
  subscribeFinishedGoods, 
  subscribeStockMovements, 
  subscribeRmInwards,
  subscribeRmFactoryIssues,
  subscribeInventoryBags,
  subscribeScrapStock,
  updateInventoryBag,
  addRawMaterial, 
  addFinishedGood, 
  updateFgStock, 
  logStockMovement 
} from '../api/inventory.api';
import { subscribeJobWorks } from '../api/jobwork.api';
import { subscribeSalesOrders, subscribeDispatches } from '../api/sales.api';
import { subscribeQcChecks, createQcCheck } from '../api/qc.api';
import { printMultipleBagStickers, printSingleBagSticker } from '../utils/stickerPdf';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { exportToCsv } from '../utils/exportCsv';
import { showAlert } from '../context/CustomAlertContext';
import { logAuditEvent } from '../api/audit.api';
import { subscribeTareStandards, DEFAULT_TARE_STANDARDS } from '../api/directory.api';
import '../styles/InventoryStock.css';



export default function InventoryStockView({ onOpenJobWork, onOpenSalesOrder }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { rmStock, jobWorkStock, fgStock } = useWorkflow();

  const [movementsSubView, setMovementsSubView] = useState('history');

  const resolveInvTab = (tabParam) => {
    if (!tabParam) return 'rm';
    if (tabParam === 'traceability') {
      setMovementsSubView('traceability');
      return 'movements';
    }
    if (tabParam === 'movements') {
      return 'movements';
    }
    return tabParam;
  };

  const [activeTab, setActiveTab] = useState(() => resolveInvTab(searchParams.get('tab') || location.state?.tab));
  const [rmSubView, setRmSubView] = useState(location.state?.subView || 'ledger'); // 'ledger' | 'inward' | 'issue'

  const [liveRmList, setLiveRmList] = useState([]);
  const [liveFgList, setLiveFgList] = useState([]);
  const [liveMovements, setLiveMovements] = useState([]);
  const [liveJobWorks, setLiveJobWorks] = useState([]);
  const [liveDispatches, setLiveDispatches] = useState([]);
  const [liveOrders, setLiveOrders] = useState([]);
  const [liveRmInwards, setLiveRmInwards] = useState([]);
  const [liveRmIssues, setLiveRmIssues] = useState([]);
  const [liveBags, setLiveBags] = useState([]);
  const [liveQcChecks, setLiveQcChecks] = useState([]);
  const [scrapInfo, setScrapInfo] = useState({ totalScrapKg: 0, defaultRate: 70 });

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || location.state?.tab;
    if (tabFromUrl) {
      setActiveTab(resolveInvTab(tabFromUrl));
    }
    if (location.state?.subView) {
      setRmSubView(location.state.subView);
    }
    if (location.state?.search) {
      setRmSearch(location.state.search);
    }
  }, [searchParams, location.state]);

  useEffect(() => {
    const unsubRm = subscribeRawMaterials(setLiveRmList);
    const unsubFg = subscribeFinishedGoods(setLiveFgList);
    const unsubMov = subscribeStockMovements(setLiveMovements);
    const unsubJw = subscribeJobWorks(setLiveJobWorks);
    const unsubDc = subscribeDispatches(setLiveDispatches);
    const unsubSo = subscribeSalesOrders(setLiveOrders);
    const unsubInw = subscribeRmInwards(setLiveRmInwards);
    const unsubIss = subscribeRmFactoryIssues(setLiveRmIssues);
    const unsubBags = subscribeInventoryBags(setLiveBags);
    const unsubScrap = subscribeScrapStock(setScrapInfo);
    const unsubQc = subscribeQcChecks(setLiveQcChecks);
    const unsubTare = subscribeTareStandards(setTareStandards);
    return () => {
      unsubRm();
      unsubFg();
      unsubMov();
      unsubJw();
      unsubDc();
      unsubSo();
      unsubInw();
      unsubIss();
      unsubBags();
      unsubScrap();
      unsubQc();
      if (unsubTare) unsubTare();
    };
  }, []);

  const [tareStandards, setTareStandards] = useState(DEFAULT_TARE_STANDARDS);

  const [rmSearch, setRmSearch] = useState('');
  const [rmCategoryFilter, setRmCategoryFilter] = useState('All');
  const [showRmFilterPanel, setShowRmFilterPanel] = useState(false);
  const [showFgFilterPanel, setShowFgFilterPanel] = useState(false);
  const [showQcFilterPanel, setShowQcFilterPanel] = useState(false);
  const [showMovFilterPanel, setShowMovFilterPanel] = useState(false);
  const [fgSearch, setFgSearch] = useState('');
  const [fgCategoryFilter, setFgCategoryFilter] = useState('All');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState('All');
  const [traceSearch, setTraceSearch] = useState('');
  const [bagSearch, setBagSearch] = useState('');
  const [bagStockTypeFilter, setBagStockTypeFilter] = useState('All');
  const [bagLocationFilter, setBagLocationFilter] = useState('All');
  const [qcSearch, setQcSearch] = useState('');
  const [qcStatusFilter, setQcStatusFilter] = useState('All');
  const [showQcModal, setShowQcModal] = useState(false);
  const [selectedQcForModal, setSelectedQcForModal] = useState(null);
  const [bagViewMode, setBagViewMode] = useState('flat'); // 'flat' | 'diary'
  const [showBagFilters, setShowBagFilters] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [showAddBagBatchModal, setShowAddBagBatchModal] = useState(false);
  const [showQuickLookupModal, setShowQuickLookupModal] = useState(false);
  const [editingBagWeightId, setEditingBagWeightId] = useState(null);
  const [editingBagWeightVal, setEditingBagWeightVal] = useState('');

  const handleLocateBagInDiary = (bag) => {
    setActiveTab('bags');
    setBagViewMode('diary');
    setBagSearch(String(bag.bagNumber || ''));
    setShowBagFilters(true);
  };

  const handleStartEditWeight = (bag) => {
    setEditingBagWeightId(bag.id || `bag-${bag.bagNumber}`);
    setEditingBagWeightVal(String(bag.actualWeightKg || bag.standardWeightKg || 50));
  };

  const handleSaveBagWeight = async (bag) => {
    const newWt = parseFloat(editingBagWeightVal);
    if (!isNaN(newWt) && newWt > 0) {
      setLiveBags(prev => prev.map(b => (b.id === bag.id || b.bagNumber === bag.bagNumber) ? { ...b, actualWeightKg: newWt } : b));
      if (bag.id) {
        try {
          await updateInventoryBag(bag.id, { actualWeightKg: newWt });
        } catch (e) {
          console.warn('Firestore update failed for bag weight:', e.message);
        }
      }
    }
    setEditingBagWeightId(null);
  };

  const handleBagsAdded = (newBags) => {
    setLiveBags(prev => [...prev, ...newBags]);
  };

  const [showJWModal, setShowJWModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showAddRmModal, setShowAddRmModal] = useState(false);
  const [showRmInwardModal, setShowRmInwardModal] = useState(false);
  const [showIssueFactoryModal, setShowIssueFactoryModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddFgStockModal, setShowAddFgStockModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedBagForDrawer, setSelectedBagForDrawer] = useState(null);
  const [isBagDrawerOpen, setIsBagDrawerOpen] = useState(false);
  const [selectedInward, setSelectedInward] = useState(null);

  const handleOpenBagDrawer = (bag) => {
    setSelectedBagForDrawer(bag);
    setIsBagDrawerOpen(true);
  };

  const handleUpdateBagWeightFromDrawer = async (bag, newWeight) => {
    setLiveBags(prev => prev.map(b => (b.id === bag.id || b.bagNumber === bag.bagNumber) ? { ...b, actualWeightKg: newWeight } : b));
    setSelectedBagForDrawer(prev => prev ? { ...prev, actualWeightKg: newWeight } : null);
    if (bag.id) {
      try {
        await updateInventoryBag(bag.id, { actualWeightKg: newWeight });
      } catch (e) {
        console.warn('Firestore update failed for bag weight:', e.message);
      }
    }
  };

  const handleUpdateBagLocationFromDrawer = async (bag, newLocation) => {
    setLiveBags(prev => prev.map(b => (b.id === bag.id || b.bagNumber === bag.bagNumber) ? { ...b, location: newLocation } : b));
    setSelectedBagForDrawer(prev => prev ? { ...prev, location: newLocation } : null);
    if (bag.id) {
      try {
        await updateInventoryBag(bag.id, { location: newLocation });
      } catch (e) {
        console.warn('Firestore update failed for bag location:', e.message);
      }
    }
  };

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
        availFactory: Number(formData.openingStock !== undefined ? formData.openingStock : (formData.initialStock || 0)),
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
      await showAlert('Please enter a valid inward quantity greater than 0.', { type: 'warning', title: 'Invalid Quantity' });
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

      await showAlert(`Successfully added ${qtyNum} Coils for ${targetName}!`, { type: 'success', title: 'Stock Added' });
      setShowAddFgStockModal(false);
      setIsDrawerOpen(false);
    } catch (err) {
      console.error('Error adding finished goods stock:', err);
      await showAlert('Failed to update finished goods stock. Please try again.', { type: 'error' });
    }
  };

  const handleUpdateQc = async (inw, newStatus) => {
    const isAccepted = newStatus === 'ACCEPTED';
    const nowIso = new Date().toISOString();

    // 1. Optimistic local state update
    setLiveRmInwards(prev => prev.map(item => {
      if ((item.id && item.id === inw.id) || (item.grnNo && item.grnNo === inw.grnNo)) {
        return { ...item, qcStatus: newStatus, qcEvaluatedAt: nowIso };
      }
      return item;
    }));

    if (selectedInward && ((selectedInward.id && selectedInward.id === inw.id) || (selectedInward.grnNo && selectedInward.grnNo === inw.grnNo))) {
      setSelectedInward(prev => ({ ...prev, qcStatus: newStatus, qcEvaluatedAt: nowIso }));
    }

    try {
      if (inw.id) {
        await updateDoc(doc(db, 'rmInwards', inw.id), {
          qcStatus: newStatus,
          qcEvaluatedAt: nowIso
        });
      }

      const matchQc = liveQcChecks.find(q => (q.grnId && q.grnId === inw.id) || (q.grnNo && q.grnNo === inw.grnNo));
      if (matchQc && matchQc.id) {
        await updateDoc(doc(db, 'qcChecks', matchQc.id), {
          status: isAccepted ? 'APPROVED' : 'REJECTED',
          result: isAccepted ? 'PASS' : 'FAIL',
          approvedBy: 'Admin (KamaniPlastERP)',
          approvedAt: serverTimestamp(),
          checkedAt: serverTimestamp()
        });
      }

      // Record in Real Firestore Audit Trail
      await logAuditEvent({
        category: 'QUALITY_CONTROL',
        action: isAccepted ? 'QC_INSPECTION_ACCEPTED' : 'QC_INSPECTION_REJECTED',
        summary: `Quality Inspection ${isAccepted ? 'ACCEPTED' : 'REJECTED'} for GRN ${inw.grnNo || inw.id} (${inw.itemName || 'Material'} - ${inw.netWeight || inw.grossWeight || 0} KG) by Admin`,
        targetId: inw.grnNo || inw.id,
        details: {
          grnNo: inw.grnNo,
          supplierName: inw.supplierName,
          itemName: inw.itemName,
          netWeight: inw.netWeight,
          qcStatus: newStatus,
          result: isAccepted ? 'PASS' : 'FAIL',
          actionTakenBy: 'Admin'
        }
      });
    } catch (err) {
      console.warn('Error saving QC status or audit:', err.message);
    }
  };

  const handleOpenQcModal = async (inw, initialResult = 'PASS') => {
    let matchQc = liveQcChecks.find(q => (q.grnId && q.grnId === inw.id) || (q.grnNo && q.grnNo === inw.grnNo));

    if (!matchQc) {
      try {
        const newId = await createQcCheck(inw.id, inw);
        matchQc = {
          id: newId || inw.id,
          grnId: inw.id,
          grnNo: inw.grnNo || '',
          challanNo: inw.challanNo || '',
          supplierName: inw.supplierName || '',
          itemName: inw.itemName || '',
          grade: inw.grade || '',
          materialForm: inw.materialForm || 'Granule',
          materialColor: inw.materialColor || 'Natural',
          packaging: inw.packaging || 'Woven Bag',
          batchNumber: inw.batchNumber || '',
          grossWeight: inw.grossWeight || 0,
          netWeight: inw.netWeight || 0,
          status: 'PENDING',
          result: initialResult,
          deadlineAt: inw.date
        };
      } catch (_) {
        matchQc = {
          id: inw.id,
          grnId: inw.id,
          grnNo: inw.grnNo || '',
          challanNo: inw.challanNo || '',
          supplierName: inw.supplierName || '',
          itemName: inw.itemName || '',
          grade: inw.grade || '',
          batchNumber: inw.batchNumber || '',
          grossWeight: inw.grossWeight || 0,
          netWeight: inw.netWeight || 0,
          status: 'PENDING',
          result: initialResult
        };
      }
    } else {
      matchQc = { ...matchQc, result: initialResult };
    }

    setSelectedQcForModal(matchQc);
    setShowQcModal(true);
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
      desc: rm.desc || rm.description || (rm.category ? `Polymer ${rm.category}` : 'Raw Material'),
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
      (jw.rawMat || jw.material || jw.itemName || '').toLowerCase().includes(itemName.toLowerCase()) ||
      (jw.rawMaterialId && jw.rawMaterialId === rm.id)
    );
    const jwOutwardKg = matchingJobWorks.reduce((s, jw) => s + (Number(jw.sentQtyKg) || Number(jw.inputQty) || 0), 0);
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
      diaColor: fg.diaColor || (fg.size ? `${fg.size} • ${fg.color || ''}` : '') || (fg.diaSize ? `${fg.diaSize} • ${fg.colorTracer || ''}` : '') || '-',
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

  // Bags Dual Stock Calculations
  const fixedBags = liveBags.filter(b => b.stockType === 'FIXED');
  const looseBags = liveBags.filter(b => b.stockType === 'LOOSE');
  const totalFixedKg = fixedBags.reduce((sum, b) => sum + (Number(b.actualWeightKg) || Number(b.standardWeightKg) || 0), 0);
  const totalLooseKg = looseBags.reduce((sum, b) => sum + (Number(b.actualWeightKg) || 0), 0);
  const totalBagStockKg = totalFixedKg + totalLooseKg;

  const filteredBags = liveBags.filter(bag => {
    const bagNumStr = `bag ${bag.bagNumber || ''}`.toLowerCase();
    const query = bagSearch.toLowerCase();
    const matchesQuery = 
      bagNumStr.includes(query) ||
      String(bag.bagNumber || '').includes(query) ||
      (bag.inwardSlipNo || '').toLowerCase().includes(query) ||
      (bag.jobWorkNo || '').toLowerCase().includes(query) ||
      (bag.productName || '').toLowerCase().includes(query) ||
      (bag.quality || '').toLowerCase().includes(query) ||
      (bag.form || '').toLowerCase().includes(query) ||
      (bag.size || '').toLowerCase().includes(query) ||
      (bag.lotTitle || '').toLowerCase().includes(query) ||
      (bag.location || '').toLowerCase().includes(query) ||
      (bag.status || '').toLowerCase().includes(query);

    const matchesStockType = bagStockTypeFilter === 'All' || bag.stockType === bagStockTypeFilter;
    const matchesLocation = bagLocationFilter === 'All' || bag.location === bagLocationFilter;

    return matchesQuery && matchesStockType && matchesLocation;
  });

  // Group bags for Physical Diary View matching handwritten sheet
  const diaryLots = (() => {
    const lotMap = new Map();
    filteredBags.forEach(bag => {
      const groupKey = bag.lotGroup || `${bag.inwardSlipNo || 'SLIP-3001'}-${bag.quality || 'Anchor'}-${bag.form || 'Hank'}-${bag.size || '3x3'}-${bag.stockType || 'FIXED'}`;
      if (!lotMap.has(groupKey)) {
        lotMap.set(groupKey, {
          lotId: groupKey,
          quality: bag.quality || 'Anchor',
          form: bag.form || 'Hank',
          size: bag.size || '3x3',
          standardWeightKg: Number(bag.standardWeightKg) || 50,
          coilCount: Number(bag.coilCount) || 12,
          stockType: bag.stockType || 'FIXED',
          location: bag.location || 'KPI Godown',
          inwardSlipNo: bag.inwardSlipNo || 'SLIP-3001',
          receivedAt: bag.receivedAt || '2026-03-30',
          bags: []
        });
      }
      lotMap.get(groupKey).bags.push(bag);
    });

    return Array.from(lotMap.values()).map(lot => {
      lot.bags.sort((a, b) => (Number(a.bagNumber) || 0) - (Number(b.bagNumber) || 0));
      const totalBags = lot.bags.length;
      const minBag = lot.bags[0]?.bagNumber || 1;
      const maxBag = lot.bags[lot.bags.length - 1]?.bagNumber || totalBags;
      const totalActualKg = lot.bags.reduce((sum, b) => sum + (Number(b.actualWeightKg) || Number(b.standardWeightKg) || 0), 0);
      const totalStdKg = totalBags * lot.standardWeightKg;
      const totalVariance = totalActualKg - totalStdKg;
      const avgWeightKg = totalBags > 0 ? (totalActualKg / totalBags).toFixed(2) : '0.00';
      const totalCoils = lot.bags.reduce((sum, b) => sum + (Number(b.coilCount) || 12), 0);

      return {
        ...lot,
        totalBags,
        minBag,
        maxBag,
        totalActualKg,
        totalStdKg,
        totalVariance,
        avgWeightKg,
        totalCoils
      };
    });
  })();

  const uniqueBagLocations = Array.from(new Set(liveBags.map(b => b.location).filter(Boolean)));

  // QC Module Calculations (Change 5)
  const pendingQcChecks = liveQcChecks.filter(q => q.status === 'PENDING');
  const sentForApprovalQc = liveQcChecks.filter(q => q.status === 'SENT_FOR_APPROVAL');
  const approvedQcChecks = liveQcChecks.filter(q => q.status === 'APPROVED');
  const overdueQcChecks = liveQcChecks.filter(q => q.isOverdue);
  const passedQcChecks = liveQcChecks.filter(q => q.result === 'PASS');
  const failedQcChecks = liveQcChecks.filter(q => q.result === 'FAIL');

  const filteredQcChecks = liveQcChecks.filter(q => {
    const query = (qcSearch || '').toLowerCase();
    const matchesQuery = 
      (q.grnNo || '').toLowerCase().includes(query) ||
      (q.challanNo || '').toLowerCase().includes(query) ||
      (q.supplierName || '').toLowerCase().includes(query) ||
      (q.itemName || '').toLowerCase().includes(query) ||
      (q.grade || '').toLowerCase().includes(query) ||
      (q.batchNumber || '').toLowerCase().includes(query) ||
      (q.notes || '').toLowerCase().includes(query);

    let matchesStatus = true;
    if (qcStatusFilter === 'PENDING') matchesStatus = q.status === 'PENDING';
    else if (qcStatusFilter === 'SENT_FOR_APPROVAL') matchesStatus = q.status === 'SENT_FOR_APPROVAL';
    else if (qcStatusFilter === 'APPROVED') matchesStatus = q.status === 'APPROVED';
    else if (qcStatusFilter === 'OVERDUE') matchesStatus = q.isOverdue;
    else if (qcStatusFilter === 'PASS') matchesStatus = q.result === 'PASS';
    else if (qcStatusFilter === 'FAIL') matchesStatus = q.result === 'FAIL';

    return matchesQuery && matchesStatus;
  });

  // Dynamic PageHeader configuration based on activeTab
  let invTitle = 'Raw Materials & GRN';
  let invTooltip = 'Excel-aligned Raw Material Inward (GRN), Factory Issue Consumption, and Job Worker Outward balance.';
  let invBadge = `${displayRmList.length} SKU Materials`;
  let invCrumbs = [
    { label: 'Inventory & Stock', route: '/inventory' },
    { label: 'Raw Materials & GRN' }
  ];

  if (activeTab === 'fg') {
    invTitle = 'Finished Goods (FG)';
    invTooltip = 'Track manufactured coils, reels, and hanks with free stock vs reserved stock allocation.';
    invBadge = `${liveFgList.length} Product SKUs`;
    invCrumbs = [
      { label: 'Inventory & Stock', route: '/inventory' },
      { label: 'Finished Goods (FG)' }
    ];
  } else if (activeTab === 'bags') {
    invTitle = 'Bags & Dual Stock';
    invTooltip = 'Individual bag tracking with sequential integer serials (1, 2, 3...) & scale weights.';
    invBadge = `${filteredBags.length} Bags`;
    invCrumbs = [
      { label: 'Inventory & Stock', route: '/inventory' },
      { label: 'Bags & Dual Stock' }
    ];
  } else if (activeTab === 'movements' || activeTab === 'traceability') {
    const subLabel = movementsSubView === 'traceability' ? 'Material Traceability Explorer' : 'Stock Movements & Audit';
    invTitle = subLabel;
    invTooltip = 'Immutable perpetual audit log of raw material inwards, job work dispatches, and sales dispatches.';
    invBadge = `${liveMovements.length} Transactions`;
    invCrumbs = [
      { label: 'Inventory & Stock', route: '/inventory' },
      { label: 'Stock Movements & Trace', route: '/inventory?tab=movements' },
      { label: subLabel }
    ];
  } else if (activeTab === 'qc') {
    invTitle = 'Raw Material Quality Control (QC)';
    invTooltip = 'Mandatory inbound material inspection workflow: Pending evaluation → Inspector Pass/Fail → Approval.';
    invBadge = overdueQcChecks.length > 0 ? `⚠️ ${overdueQcChecks.length} SLA Overdue` : `${filteredQcChecks.length} Records`;
    invCrumbs = [
      { label: 'Inventory & Stock', route: '/inventory' },
      { label: 'QC Inspection Register' }
    ];
  }

  // Dynamic filter categories for Inventory tabs
  const rmFilterCategories = useMemo(() => [
    {
      id: 'category',
      label: 'Polymer Category',
      icon: Layers,
      allLabel: 'All Categories',
      options: [
        { value: 'All', label: 'All Categories' },
        ...uniqueRmCategories.map(c => ({ value: c, label: c }))
      ]
    }
  ], [uniqueRmCategories]);

  const fgFilterCategories = useMemo(() => [
    {
      id: 'category',
      label: 'Product Category',
      icon: Package,
      allLabel: 'All Categories',
      options: [
        { value: 'All', label: 'All Categories' },
        ...uniqueFgCategories.map(c => ({ value: c, label: c }))
      ]
    }
  ], [uniqueFgCategories]);

  const bagFilterCategories = useMemo(() => [
    {
      id: 'stockType',
      label: 'Stock Type',
      icon: Package,
      allLabel: 'All Types',
      options: [
        { value: 'All', label: 'All Types' },
        { value: 'FIXED', label: 'Fixed Stock (50kg std)' },
        { value: 'LOOSE', label: 'Loose Stock (Cut / Odd)' }
      ]
    },
    {
      id: 'location',
      label: 'Location / Godown',
      icon: MapPin,
      allLabel: 'All Locations',
      options: [
        { value: 'All', label: 'All Locations' },
        ...uniqueBagLocations.map(l => ({ value: l, label: l }))
      ]
    }
  ], [uniqueBagLocations]);

  const movementFilterCategories = useMemo(() => [
    {
      id: 'type',
      label: 'Transaction Type',
      icon: History,
      allLabel: 'All Transaction Types',
      options: [
        { value: 'All', label: 'All Transaction Types' },
        { value: 'Receipt', label: 'Purchase Receipts' },
        { value: 'JWIssue', label: 'Job Work Issues' },
        { value: 'JWReturn', label: 'Job Work Returns' },
        { value: 'Production', label: 'FG Production' },
        { value: 'Dispatch', label: 'Customer Dispatches' }
      ]
    }
  ], []);

  const qcFilterCategories = useMemo(() => [
    {
      id: 'status',
      label: 'QC Status',
      icon: CheckCircle2,
      allLabel: 'All QC Statuses',
      options: [
        { value: 'All', label: 'All QC Statuses' },
        { value: 'PENDING', label: `Pending Evaluation (${pendingQcChecks.length})` },
        { value: 'SENT_FOR_APPROVAL', label: `Sent for Approval (${sentForApprovalQc.length})` },
        { value: 'APPROVED', label: `Approved (${approvedQcChecks.length})` },
        { value: 'OVERDUE', label: `⚠️ SLA Overdue (${overdueQcChecks.length})` },
        { value: 'PASS', label: `Result: PASS (${passedQcChecks.length})` },
        { value: 'FAIL', label: `Result: FAIL (${failedQcChecks.length})` }
      ]
    }
  ], [pendingQcChecks.length, sentForApprovalQc.length, approvedQcChecks.length, overdueQcChecks.length, passedQcChecks.length, failedQcChecks.length]);

  let invSearchProps = null;
  let invFilterProps = null;

  if (activeTab === 'rm') {
    invSearchProps = {
      value: rmSearch,
      onChange: setRmSearch,
      placeholder: 'Search Item Name, Grade, Supplier, GRN No...'
    };
    invFilterProps = {
      categories: rmFilterCategories,
      activeFilters: { category: rmCategoryFilter },
      onApply: (f) => { if (f.category !== undefined) setRmCategoryFilter(f.category); },
      onReset: () => setRmCategoryFilter('All')
    };
  } else if (activeTab === 'fg') {
    invSearchProps = {
      value: fgSearch,
      onChange: setFgSearch,
      placeholder: 'Search Product Code, Name, Diameter, Color...'
    };
    invFilterProps = {
      categories: fgFilterCategories,
      activeFilters: { category: fgCategoryFilter },
      onApply: (f) => { if (f.category !== undefined) setFgCategoryFilter(f.category); },
      onReset: () => setFgCategoryFilter('All')
    };
  } else if (activeTab === 'bags') {
    invSearchProps = {
      value: bagSearch,
      onChange: setBagSearch,
      placeholder: 'Search Bag No, Batch, Material, Location...'
    };
    invFilterProps = {
      categories: bagFilterCategories,
      activeFilters: { stockType: bagStockTypeFilter, location: bagLocationFilter },
      onApply: (f) => {
        if (f.stockType !== undefined) setBagStockTypeFilter(f.stockType);
        if (f.location !== undefined) setBagLocationFilter(f.location);
      },
      onReset: () => {
        setBagStockTypeFilter('All');
        setBagLocationFilter('All');
      }
    };
  } else if (activeTab === 'movements' || activeTab === 'traceability') {
    const isTrace = movementsSubView === 'traceability';
    invSearchProps = {
      value: isTrace ? traceSearch : movementSearch,
      onChange: isTrace ? setTraceSearch : setMovementSearch,
      placeholder: isTrace ? 'Enter Batch/JW/SO ID to trace...' : 'Search Movement ID, Party, Material...'
    };
    if (!isTrace) {
      invFilterProps = {
        categories: movementFilterCategories,
        activeFilters: { type: movementTypeFilter },
        onApply: (f) => { if (f.type !== undefined) setMovementTypeFilter(f.type); },
        onReset: () => setMovementTypeFilter('All')
      };
    }
  } else if (activeTab === 'qc') {
    invSearchProps = {
      value: qcSearch,
      onChange: setQcSearch,
      placeholder: 'Search QC check by material, supplier, GRN...'
    };
    invFilterProps = {
      categories: qcFilterCategories,
      activeFilters: { status: qcStatusFilter },
      onApply: (f) => { if (f.status !== undefined) setQcStatusFilter(f.status); },
      onReset: () => setQcStatusFilter('All')
    };
  }

  const renderInvActions = () => (
    <>
      {activeTab === 'rm' && (
        <>
          <HeaderButton
            icon={Download}
            label="Export CSV"
            onClick={() => {
              if (rmSubView === 'ledger') exportToCsv('RM_Stock_Ledger.csv', filteredRm);
              else if (rmSubView === 'inward') exportToCsv('RM_Inward_Register.csv', filteredRmInwards);
              else exportToCsv('RM_Factory_Issue_Register.csv', filteredRmIssues);
            }}
            title="Export CSV"
          />
          <HeaderButton
            icon={Plus}
            label="Inward RM (GRN)"
            onClick={() => setShowRmInwardModal(true)}
            style={{ color: '#16a34a', borderColor: '#bbf7d0' }}
            title="Record Raw Material Inward (GRN)"
          />
          <HeaderButton
            icon={Plus}
            label="Issue to Factory"
            variant="primary"
            onClick={() => setShowIssueFactoryModal(true)}
            title="Issue to Factory Extrusion Plant"
          />
        </>
      )}

      {activeTab === 'fg' && (
        <>
          <HeaderButton
            icon={Download}
            label="Export CSV"
            onClick={() => exportToCsv('Finished_Goods_Inventory.csv', filteredFg)}
            title="Export CSV"
          />
          <HeaderButton
            icon={Plus}
            label="Add Product SKU"
            variant="primary"
            onClick={() => setShowAddProductModal(true)}
            title="Add Product SKU"
          />
        </>
      )}

      {activeTab === 'bags' && (
        <>
          <HeaderButton
            icon={Download}
            label="Export CSV"
            onClick={() => exportToCsv('Bags_Dual_Stock_Register.csv', filteredBags)}
            title="Export CSV"
          />
          <HeaderButton
            icon={Printer}
            label={`Print Stickers (${filteredBags.length})`}
            onClick={() => printMultipleBagStickers(filteredBags)}
            title="Print Barcode Stickers (100mm x 75mm) for all filtered bags"
          />
          <HeaderButton
            icon={Search}
            label="Scan / Find Bag"
            variant="primary"
            onClick={() => setShowQuickLookupModal(true)}
            title="Scan / Find Bag"
          />
        </>
      )}

      {activeTab === 'movements' && movementsSubView === 'history' && (
        <HeaderButton
          icon={Download}
          label="Export Audit Trail"
          onClick={() => exportToCsv('Inventory_Stock_Movements_Audit.csv', liveMovements)}
          title="Export Audit Trail"
        />
      )}

      {activeTab === 'qc' && (
        <HeaderButton
          icon={Download}
          label="Export QC Log"
          onClick={() => exportToCsv('RM_Quality_Control_Register.csv', filteredQcChecks)}
          title="Export QC Log"
        />
      )}

      <HeaderButton
        icon={BarChart3}
        label={showMetrics ? 'Hide Stats' : 'Show Stats'}
        onClick={() => setShowMetrics(prev => !prev)}
        active={showMetrics}
        title={showMetrics ? 'Hide summary KPI statistics' : 'Show summary KPI statistics'}
      />
    </>
  );

  if (selectedInward) {
    const currentInw = liveRmInwards.find(i => (i.id && i.id === selectedInward.id) || (i.grnNo && i.grnNo === selectedInward.grnNo)) || selectedInward;
    const matchQc = liveQcChecks.find(q => (q.grnId && q.grnId === currentInw.id) || (q.grnNo && q.grnNo === currentInw.grnNo));
    const effectiveQcStatus = currentInw.qcStatus 
      ? currentInw.qcStatus.toUpperCase() 
      : (matchQc?.result === 'PASS' || matchQc?.status === 'APPROVED' ? 'ACCEPTED' : (matchQc?.result === 'FAIL' || matchQc?.status === 'REJECTED' ? 'REJECTED' : 'PENDING'));

    return (
      <GrnDetailView 
        inward={{ ...currentInw, qcStatus: effectiveQcStatus, qcCheck: matchQc }} 
        onBack={() => setSelectedInward(null)} 
        onUpdateQc={handleUpdateQc} 
        onOpenQcModal={handleOpenQcModal}
      />
    );
  }

  return (
    <div className="inv-hub-container">
      {/* ── Standard Unified Page Header with Breadcrumbs ── */}
      <PageHeader
        breadcrumbs={invCrumbs}
        title={invTitle}
        tooltip={invTooltip}
        searchProps={invSearchProps}
        filterProps={invFilterProps}
        actions={renderInvActions()}
      />

      {/* ── Contextual Metric Area (Toggleable, Hidden by default for minimal UI) ── */}
      {showMetrics && (
        <div className="inv-top-kpis">
        {activeTab === 'qc' ? (
          <>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Pending 24h SLA</span>
                <div className="inv-kpi-icon inv-icon-orange"><Clock size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num inv-text-orange">{pendingQcChecks.length}</span>
                <span className="inv-kpi-sublabel">Awaiting Evaluation</span>
              </div>
              <div className="inv-kpi-sub inv-text-orange">24-hour mandatory window</div>
            </div>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Overdue Deadlines</span>
                <div className="inv-kpi-icon" style={{ background: '#fee2e2', color: '#dc2626' }}><AlertTriangle size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num" style={{ color: '#dc2626' }}>{overdueQcChecks.length}</span>
                <span className="inv-kpi-sublabel">Past SLA Limit</span>
              </div>
              <div className="inv-kpi-sub" style={{ color: '#dc2626' }}>Requires immediate sign-off</div>
            </div>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Approved &amp; Certified</span>
                <div className="inv-kpi-icon inv-icon-green"><ShieldCheck size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num inv-text-green">{approvedQcChecks.length}</span>
                <span className="inv-kpi-sublabel">Passed ({passedQcChecks.length})</span>
              </div>
              <div className="inv-kpi-sub inv-text-green">{sentForApprovalQc.length} Pending Approval</div>
            </div>
          </>
        ) : activeTab === 'bags' ? (
          <>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Fixed Stock (Std 50kg)</span>
                <div className="inv-kpi-icon inv-icon-green"><Scale size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num inv-text-green">{fixedBags.length} Bags</span>
                <span className="inv-kpi-sublabel">({totalFixedKg.toFixed(1)} KG)</span>
              </div>
              <div className="inv-kpi-sub inv-text-green">Standard 50.0 KG bag weight</div>
            </div>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Loose Stock (Cut Bags)</span>
                <div className="inv-kpi-icon inv-icon-orange"><Package size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num inv-text-orange">{looseBags.length} Bags</span>
                <span className="inv-kpi-sublabel">({totalLooseKg.toFixed(1)} KG)</span>
              </div>
              <div className="inv-kpi-sub inv-text-orange">Odd weights / remainder cuts</div>
            </div>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Total Bag Stock</span>
                <div className="inv-kpi-icon inv-icon-purple"><Layers size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num">{totalBagStockKg.toFixed(1)}</span>
                <span className="inv-kpi-sublabel">KG Net</span>
              </div>
              <div className="inv-kpi-sub">Stored in KPI &amp; Marvel Godowns</div>
            </div>
          </>
        ) : activeTab === 'fg' ? (
          <>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Reserved for Orders</span>
                <div className="inv-kpi-icon inv-icon-blue"><Package size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num inv-text-blue">
                  {displayFgList.reduce((a, b) => a + b.reservedNum, 0).toLocaleString()}
                </span>
                <span className="inv-kpi-sublabel">Units</span>
              </div>
              <div className="inv-kpi-sub">Committed for customer POs</div>
            </div>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Available Free Stock</span>
                <div className="inv-kpi-icon inv-icon-green"><Package size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num inv-text-green">
                  {displayFgList.reduce((a, b) => a + b.freeStockNum, 0).toLocaleString()}
                </span>
                <span className="inv-kpi-sublabel">Units</span>
              </div>
              <div className="inv-kpi-sub inv-text-green">Ready to sell immediately</div>
            </div>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Finished Goods Valuation</span>
                <div className="inv-kpi-icon inv-icon-blue"><Layers size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num">₹{totalFgValuationLakhs}L</span>
                <span className="inv-kpi-sublabel" style={{ fontSize: '0.78rem', color: '#64748b' }}>{fgStock.toLocaleString()} Units</span>
              </div>
              <div className="inv-kpi-sub">₹{totalFgValuationInr.toLocaleString()}</div>
            </div>
          </>
        ) : (activeTab === 'movements' && movementsSubView === 'history') ? (
          <>
            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Stock Movements Log</span>
                <div className="inv-kpi-icon inv-icon-purple"><History size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num">{liveMovements.length}</span>
                <span className="inv-kpi-sublabel">entries</span>
              </div>
              <div className="inv-kpi-sub">Audit trail active</div>
            </div>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Production Inwards</span>
                <div className="inv-kpi-icon inv-icon-green"><Package size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num inv-text-green">
                  {liveMovements.filter(m => m.type === 'Production' || m.inward).length}
                </span>
                <span className="inv-kpi-sublabel">events</span>
              </div>
              <div className="inv-kpi-sub">Manufacturing receipts</div>
            </div>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Dispatch Outwards</span>
                <div className="inv-kpi-icon inv-icon-orange"><Truck size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num inv-text-orange">
                  {liveMovements.filter(m => m.type === 'Dispatch' || m.outward).length}
                </span>
                <span className="inv-kpi-sublabel">events</span>
              </div>
              <div className="inv-kpi-sub">Customer deliveries</div>
            </div>


          </>
        ) : (activeTab === 'traceability' || (activeTab === 'movements' && movementsSubView === 'traceability')) ? (
          <>


            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Active SKU Pipeline</span>
                <div className="inv-kpi-icon inv-icon-blue"><Layers size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num">{displayRmList.length + displayFgList.length}</span>
                <span className="inv-kpi-sublabel">SKUs</span>
              </div>
              <div className="inv-kpi-sub">RM + Finished Goods</div>
            </div>



            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Total Valuation</span>
                <div className="inv-kpi-icon inv-icon-blue"><Layers size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num">₹{overallValuationLakhs}L</span>
              </div>
              <div className="inv-kpi-sub">Factory inventory asset</div>
            </div>
          </>
        ) : (
          <>
            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Available in Factory</span>
                <div className="inv-kpi-icon inv-icon-green"><Layers size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num inv-text-green">{rmStock.toLocaleString()}</span>
                <span className="inv-kpi-sublabel">KG</span>
              </div>
              <div className="inv-kpi-sub">Ready for extrusion / JW</div>
            </div>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Outside at Job Work</span>
                <div className="inv-kpi-icon inv-icon-orange"><Package size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num inv-text-orange">{jobWorkStock.toLocaleString()}</span>
                <span className="inv-kpi-sublabel">KG</span>
              </div>
              <div className="inv-kpi-sub">In process at vendor plants</div>
            </div>

            <div className="inv-kpi-card">
              <div className="inv-kpi-card-header">
                <span className="inv-kpi-title">Total Valuation</span>
                <div className="inv-kpi-icon inv-icon-blue"><Layers size={16} /></div>
              </div>
              <div className="inv-kpi-val-row">
                <span className="inv-kpi-num">₹{totalRmValuationLakhs}L</span>
                <span className="inv-kpi-sublabel" style={{ fontSize: '0.78rem', color: '#64748b' }}>{(rmStock + jobWorkStock).toLocaleString()} KG</span>
              </div>
              <div className="inv-kpi-sub">₹{totalRmValuationInr.toLocaleString()} (Total Stock)</div>
            </div>
          </>
        )}
      </div>
      )}



      {/* ── TAB 1: Raw Materials (RM) ── */}
      {activeTab === 'rm' && (
        <div className="inv-section-card">

          {/* Sub-view Selector Tabs for RM Module */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', margin: '14px 0 10px 0', background: '#f1f5f9', padding: '4px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => setRmSubView('ledger')}
              style={{
                background: rmSubView === 'ledger' ? '#ffffff' : 'transparent',
                color: rmSubView === 'ledger' ? '#0f172a' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: rmSubView === 'ledger' ? '600' : '500',
                boxShadow: rmSubView === 'ledger' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              RM Stock Ledger
            </button>
            <button
              onClick={() => setRmSubView('inward')}
              style={{
                background: rmSubView === 'inward' ? '#ffffff' : 'transparent',
                color: rmSubView === 'inward' ? '#16a34a' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: rmSubView === 'inward' ? '600' : '500',
                boxShadow: rmSubView === 'inward' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Inward Register ({liveRmInwards.length})
            </button>
            <button
              onClick={() => setRmSubView('issue')}
              style={{
                background: rmSubView === 'issue' ? '#ffffff' : 'transparent',
                color: rmSubView === 'issue' ? '#7c3aed' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: rmSubView === 'issue' ? '600' : '500',
                boxShadow: rmSubView === 'issue' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Factory Issues ({liveRmIssues.length})
            </button>
            <button
              onClick={() => setRmSubView('comp')}
              style={{
                background: rmSubView === 'comp' ? '#ffffff' : 'transparent',
                color: rmSubView === 'comp' ? '#ea580c' : '#64748b',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '0.8rem',
                fontWeight: rmSubView === 'comp' ? '600' : '500',
                boxShadow: rmSubView === 'comp' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Stock Reconciliation
            </button>
          </div>

          {/* Change 9: Active Filters Bar */}
          {(rmSearch || (rmSubView === 'ledger' && rmCategoryFilter !== 'All')) && (
            <div className="inv-active-filters-bar">
              <span style={{ color: '#64748b', fontWeight: 600 }}>Active Filters:</span>
              {rmSearch && (
                <span className="inv-filter-chip">
                  Search: "{rmSearch}"
                  <button type="button" className="inv-filter-chip-remove" onClick={() => setRmSearch('')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              {rmSubView === 'ledger' && rmCategoryFilter !== 'All' && (
                <span className="inv-filter-chip">
                  Category: {rmCategoryFilter}
                  <button type="button" className="inv-filter-chip-remove" onClick={() => setRmCategoryFilter('All')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              <button
                type="button"
                className="inv-filter-clear-all-btn"
                onClick={() => {
                  setRmSearch('');
                  setRmCategoryFilter('All');
                }}
              >
                Clear All
              </button>
            </div>
          )}

          {/* SUB-VIEW 1: RM Stock Balance Ledger (Sheets: RM Stock & RM stock comp) */}
          {rmSubView === 'ledger' && (
            <div className="inv-table-container">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>ITEM NAME &amp; GRADE</th>
                    <th style={{ textAlign: 'right' }}>INWARD</th>
                    <th style={{ textAlign: 'right' }}>OUTWARD</th>
                    <th style={{ textAlign: 'right' }}>ISSUE</th>
                    <th style={{ textAlign: 'right' }}>AVAILABLE BALANCE</th>
                    <th style={{ textAlign: 'right' }}>RATE / KG</th>
                    <th style={{ textAlign: 'right' }}>VALUATION</th>
                    <th style={{ textAlign: 'center' }}>ACTIONS</th>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="inv-item-name" style={{ fontWeight: '700' }}>{row.name}</span>
                          {row.grade && (
                            <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', color: '#334155' }}>
                              {row.grade}
                            </span>
                          )}
                        </div>
                        <div className="inv-item-sub">{row.code} • {row.brand}</div>
                      </td>
                      <td className="td-qty" style={{ textAlign: 'right', fontWeight: '600' }}>{row.inwardKg}</td>
                      <td className="td-qty-orange" style={{ textAlign: 'right', fontWeight: '600' }}>{row.outwardAtJw}</td>
                      <td className="td-qty" style={{ textAlign: 'right', color: '#7c3aed', fontWeight: '600' }}>{row.factoryIssueKg}</td>
                      <td className="td-qty-green" style={{ textAlign: 'right', fontWeight: '700', fontSize: '0.92rem' }}>
                        {row.availFactory}
                        {row.status === 'LOW STOCK' && (
                          <span style={{ display: 'block', fontSize: '0.68rem', color: '#dc2626', fontWeight: '600' }}>Low Stock</span>
                        )}
                      </td>
                      <td className="td-rate" style={{ textAlign: 'right' }}>{row.rate}</td>
                      <td className="td-valuation" style={{ textAlign: 'right', fontWeight: '700' }}>{row.valuation}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div className="inv-action-group" style={{ justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
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
                    <th>GRN &amp; CHALLAN</th>
                    <th>DATE</th>
                    <th>SUPPLIER NAME</th>
                    <th>ITEM &amp; BATCH DETAILS</th>
                    <th style={{ textAlign: 'right' }}>WEIGHT (NET / GROSS)</th>
                    <th style={{ textAlign: 'center' }}>BAG STOCK</th>
                    <th style={{ textAlign: 'center', minWidth: '160px' }}>QUALITY INSPECTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRmInwards.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                        No Raw Material Inward records found. Click <strong>+ Inward RM (GRN)</strong> to record your first polymer receipt.
                      </td>
                    </tr>
                  ) : (
                    filteredRmInwards.map((inw, idx) => {
                      const billedWeight = Number(inw.challanWeight || 0);
                      const grossWeight = Number(inw.grossWeight || 0);
                      const netWeight = Number(inw.netWeight || 0);
                      const isBilledExceedsGross = billedWeight > 0 && billedWeight > grossWeight;

                      // Packaging tare deduction & variance calculations
                      const tareWeight = Number(
                        inw.tareVarianceKg !== undefined
                          ? inw.tareVarianceKg
                          : (inw.varianceKg !== undefined
                              ? inw.varianceKg
                              : (inw.articleWeight !== undefined
                                  ? inw.articleWeight
                                  : (inw.tareDeduct !== undefined
                                      ? inw.tareDeduct
                                      : (grossWeight > 0 && netWeight > 0 ? Math.max(0, grossWeight - netWeight) : 0))))
                      );
                      const tareLimitKg = Number(
                        inw.varianceThresholdKg !== undefined
                          ? inw.varianceThresholdKg
                          : (tareStandards?.varianceAllowanceKg !== undefined ? tareStandards.varianceAllowanceKg : 50)
                      );
                      const tareLimitPct = Number(tareStandards?.varianceAllowancePct !== undefined ? tareStandards.varianceAllowancePct : 2.0);
                      const tarePct = grossWeight > 0 ? (tareWeight / grossWeight) * 100 : 0;

                      // Flag whether tare variance or short delivery limit is exceeded
                      const isTareVarianceExceeded = Boolean(
                        inw.isTareVarianceExceeded ||
                        (tareWeight > 0 && tareWeight > tareLimitKg) ||
                        (tarePct > 0 && tareLimitPct > 0 && tarePct > tareLimitPct) ||
                        inw.isShortDelivery ||
                        (inw.shortfallKg !== undefined && Number(inw.shortfallKg) < -tareLimitKg) ||
                        isBilledExceedsGross
                      );

                      return (
                        <tr 
                          key={inw.id || idx}
                          onClick={() => setSelectedInward(inw)}
                          style={{ cursor: 'pointer' }}
                          className="inv-row-clickable"
                          title="Click to view full GRN inward details"
                        >
                          <td className="td-code">
                            <div style={{ fontWeight: '700', color: '#16a34a' }}>{inw.grnNo}</div>
                            {inw.challanNo && (
                              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '500' }}>
                                CHL: {inw.challanNo}
                              </div>
                            )}
                          </td>
                          <td>{inw.date}</td>
                          <td style={{ fontWeight: '600' }}>{inw.supplierName}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: '600', color: '#0f172a' }}>{inw.itemName}</span>
                              {inw.batchNumber && (
                                <span 
                                  style={{ 
                                    fontSize: '0.7rem', 
                                    fontWeight: '700', 
                                    color: isTareVarianceExceeded ? '#dc2626' : '#2563eb',
                                    background: isTareVarianceExceeded ? '#fef2f2' : '#eff6ff',
                                    border: `1px solid ${isTareVarianceExceeded ? '#fecaca' : '#bfdbfe'}`,
                                    padding: '1px 6px',
                                    borderRadius: '3px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                  title={isTareVarianceExceeded 
                                    ? `⚠️ Tare Variance Exceeded: ${tareWeight.toFixed(1)} KG (Tolerance Limit: ${tareLimitKg} KG)` 
                                    : `Batch: ${inw.batchNumber}`}
                                >
                                  {isTareVarianceExceeded ? '⚠️ ' : ''}Batch: {inw.batchNumber}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '3px' }}>
                              <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '0px 4px', borderRadius: '3px', fontSize: '0.68rem', fontWeight: '600', color: '#334155' }}>
                                {inw.materialForm || inw.grade || 'Granule'}
                              </span>
                              {inw.materialColor && (
                                <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0px 4px', borderRadius: '3px', fontSize: '0.68rem', fontWeight: '600' }}>
                                  {inw.materialColor}
                                </span>
                              )}
                              {inw.packaging && (
                                <span style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', padding: '0px 4px', borderRadius: '3px', fontSize: '0.68rem' }}>
                                  {inw.packaging}{inw.laminationType ? ` (${inw.laminationType})` : ''}
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: '800', color: '#16a34a', fontSize: '0.88rem' }}>
                              {Number(inw.netWeight || 0).toLocaleString()} KG
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '500' }}>
                              Gross: {Number(inw.grossWeight || 0).toLocaleString()} KG
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: '700', marginRight: '4px', display: 'inline-block' }}>
                              🎒 {inw.bagCount ?? inw.noOfArticles ?? 0} Bags ({Number(inw.bagStockKg ?? inw.netWeight ?? 0).toLocaleString()} kg)
                            </span>
                            {Number(inw.looseStockKg || 0) > 0 && (
                              <span style={{ background: 'rgba(234, 88, 12, 0.1)', color: '#c2410c', padding: '2px 6px', borderRadius: '4px', fontSize: '0.74rem', fontWeight: '700', display: 'inline-block', marginTop: '2px' }}>
                                🌾 {Number(inw.looseStockKg).toLocaleString()} kg Loose
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            {(() => {
                              const matchQc = liveQcChecks.find(q => (q.grnId && q.grnId === inw.id) || (q.grnNo && q.grnNo === inw.grnNo));
                              const currentQcStatus = inw.qcStatus 
                                ? inw.qcStatus.toUpperCase() 
                                : (matchQc?.result === 'PASS' || matchQc?.status === 'APPROVED' ? 'ACCEPTED' : (matchQc?.result === 'FAIL' || matchQc?.status === 'REJECTED' ? 'REJECTED' : 'PENDING'));

                              if (currentQcStatus === 'ACCEPTED') {
                                return (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <span 
                                      style={{ 
                                        background: '#dcfce7', 
                                        color: '#15803d', 
                                        border: '1px solid #bbf7d0', 
                                        padding: '2px 8px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.72rem', 
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <CheckCircle2 size={12} /> Accepted
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleOpenQcModal(inw); }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#2563eb',
                                        cursor: 'pointer',
                                        fontSize: '0.68rem',
                                        padding: '1px 3px',
                                        textDecoration: 'underline',
                                        fontWeight: 600
                                      }}
                                      title="Open QC modal to view or update evaluation"
                                    >
                                      View QC
                                    </button>
                                  </div>
                                );
                              }

                              if (currentQcStatus === 'REJECTED') {
                                return (
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <span 
                                      style={{ 
                                        background: '#fee2e2', 
                                        color: '#dc2626', 
                                        border: '1px solid #fecaca', 
                                        padding: '2px 8px', 
                                        borderRadius: '4px', 
                                        fontSize: '0.72rem', 
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                    >
                                      <XCircle size={12} /> Rejected
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); handleOpenQcModal(inw); }}
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#2563eb',
                                        cursor: 'pointer',
                                        fontSize: '0.68rem',
                                        padding: '1px 3px',
                                        textDecoration: 'underline',
                                        fontWeight: 600
                                      }}
                                      title="Open QC modal to view or update evaluation"
                                    >
                                      View QC
                                    </button>
                                  </div>
                                );
                              }

                              const inwDate = inw.date ? new Date(inw.date) : null;
                              const isOverdue = inwDate && !isNaN(inwDate.getTime()) && (Date.now() - inwDate.getTime() > 24 * 60 * 60 * 1000);

                              return (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleOpenQcModal(inw); }}
                                  style={{
                                    background: isOverdue ? '#fee2e2' : '#eff6ff',
                                    color: isOverdue ? '#dc2626' : '#2563eb',
                                    border: `1px solid ${isOverdue ? '#fca5a5' : '#bfdbfe'}`,
                                    borderRadius: '5px',
                                    padding: '4px 10px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                    transition: 'all 0.15s ease'
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                  title="Open QC inspection modal to evaluate parameters and submit sign-off"
                                >
                                  {isOverdue ? <AlertTriangle size={12} /> : <ClipboardCheck size={12} />}
                                  <span>{isOverdue ? 'Evaluate QC (Overdue)' : 'Evaluate QC'}</span>
                                </button>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })
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
                    <th style={{ textAlign: 'right' }}>COMPUTED BAL</th>
                    <th style={{ textAlign: 'right' }}>LEDGER BAL</th>
                    <th style={{ textAlign: 'center' }}>AUDIT STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRmComp.length === 0 ? (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', padding: '28px', color: '#64748b' }}>
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

          {/* Change 9: Active Filters Bar */}
          {(fgSearch || fgCategoryFilter !== 'All') && (
            <div className="inv-active-filters-bar">
              <span style={{ color: '#64748b', fontWeight: 600 }}>Active Filters:</span>
              {fgSearch && (
                <span className="inv-filter-chip">
                  Search: "{fgSearch}"
                  <button type="button" className="inv-filter-chip-remove" onClick={() => setFgSearch('')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              {fgCategoryFilter !== 'All' && (
                <span className="inv-filter-chip">
                  Category: {fgCategoryFilter}
                  <button type="button" className="inv-filter-chip-remove" onClick={() => setFgCategoryFilter('All')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              <button
                type="button"
                className="inv-filter-clear-all-btn"
                onClick={() => {
                  setFgSearch('');
                  setFgCategoryFilter('All');
                }}
              >
                Clear All
              </button>
            </div>
          )}

          {/* Table */}
          <div className="inv-table-container">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>PRODUCT CODE</th>
                  <th>PRODUCT SPECIFICATION &amp; DIA</th>
                  <th style={{ textAlign: 'right' }}>PHYSICAL STOCK</th>
                  <th style={{ textAlign: 'right' }}>RESERVED</th>
                  <th style={{ textAlign: 'right' }}>AVAILABLE FREE STOCK</th>
                  <th style={{ textAlign: 'right' }}>RATE / UNIT (₹)</th>
                  <th style={{ textAlign: 'right' }}>STOCK VALUATION</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
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
                      <div className="inv-item-sub">{row.diaColor} • {row.sub}</div>
                    </td>
                    <td className="td-qty-blue" style={{ textAlign: 'right' }}>{row.physicalStock}</td>
                    <td className="td-qty-blue" style={{ textAlign: 'right' }}>{row.reserved}</td>
                    <td className="td-qty-green" style={{ textAlign: 'right', fontWeight: '800' }}>
                      {row.freeStock}
                      {row.status === 'LOW STOCK' && (
                        <span style={{ display: 'block', fontSize: '0.68rem', color: '#dc2626', fontWeight: '600' }}>Low Reserve</span>
                      )}
                    </td>
                    <td className="td-rate" style={{ textAlign: 'right' }}>{row.rate}</td>
                    <td className="td-valuation" style={{ textAlign: 'right', fontWeight: '700' }}>{row.valuation}</td>
                    <td style={{ textAlign: 'center' }}>
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

      {/* ── TAB 4: Stock Movements & Traceability (Merged) ── */}
      {activeTab === 'movements' && (
        <div className="erp-subnav-pills">
          <button
            className={`erp-subnav-pill ${movementsSubView === 'history' ? 'active' : ''}`}
            onClick={() => setMovementsSubView('history')}
          >
            <History size={13} />
            <span>Stock Movements &amp; Audit</span>
          </button>
          <button
            className={`erp-subnav-pill ${movementsSubView === 'traceability' ? 'active' : ''}`}
            onClick={() => setMovementsSubView('traceability')}
          >
            <GitBranch size={13} />
            <span>Batch Traceability Explorer</span>
          </button>
        </div>
      )}

      {(activeTab === 'movements' && movementsSubView === 'history') && (
        <div className="inv-section-card">

          {/* Active Filter Chips */}
          {movementTypeFilter !== 'All' && (
            <div className="inv-active-filters-bar" style={{ marginBottom: 12 }}>
              <span style={{ color: '#64748b', fontWeight: 600 }}>Active Filters:</span>
              <span className="inv-filter-chip">
                Type: {movementTypeFilter}
                <button type="button" className="inv-filter-chip-remove" onClick={() => setMovementTypeFilter('All')}>
                  <X size={12} />
                </button>
              </span>
              <button
                type="button"
                className="inv-filter-clear-all-btn"
                onClick={() => setMovementTypeFilter('All')}
              >
                Clear All
              </button>
            </div>
          )}

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

      {/* ── Batch Traceability Explorer ── */}
      {(activeTab === 'traceability' || (activeTab === 'movements' && movementsSubView === 'traceability')) && (
        <div className="inv-trace-container">
          <div className="inv-section-card">
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
                          <div className="node-title">{activeTraceJw?.jwNo || 'JW Issue'}</div>
                          <div className="node-sub">{activeTraceJw?.vendor || '-'}</div>
                          <div className="node-highlight orange">Dispatched: {activeTraceJw?.sentQty || `${activeTraceJw?.sentQtyKg || 0} KG`}</div>
                        </div>

                        <ArrowRight size={16} className="node-arrow" />

                        {/* Node 3: GRN Receipt */}
                        <div className="inv-flow-node" style={{ minWidth: '170px' }}>
                          <div className="node-header">
                            <span className="node-num">3. GRN Return</span>
                            <span className="node-dot dot-green" />
                          </div>
                          <div className="node-title">{activeTraceJw?.jwNo ? `GRN-${activeTraceJw.jwNo}` : 'GRN Return'}</div>
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
                          <div className="node-title">{matchingFg?.name || '-'}</div>
                          <div className="node-sub">{matchingFg?.code ? `Code: ${matchingFg.code}` : '-'}</div>
                          <div className="node-highlight blue">{matchingFg ? `${matchingFg.stockQty || 0} Coils` : '-'}</div>
                        </div>

                        <ArrowRight size={16} className="node-arrow" />

                        {/* Node 5: Outward Dispatch */}
                        <div className="inv-flow-node" style={{ minWidth: '170px' }}>
                          <div className="node-header">
                            <span className="node-num">5. Outward Dispatch</span>
                            <span className="node-dot dot-purple" />
                          </div>
                          <div className="node-title">{matchingDc?.challanNo || matchingDc?.dispatchNo || 'DC-Challan'}</div>
                          <div className="node-sub">{matchingDc?.customer || '-'}</div>
                          <div className="node-highlight green">{matchingDc ? `${matchingDc.dispatchedQtyCoils || matchingDc.dispatchedQty || 0} Dispatched` : '-'}</div>
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

      {/* ── TAB: Quality Control (QC) Register & 24h SLA (Change 5) ── */}
      {activeTab === 'qc' && (
        <div className="inv-section-card">

          {/* Change 9: Active Filter Chips */}
          {(qcSearch || qcStatusFilter !== 'All') && (
            <div className="inv-active-filters-bar">
              <span style={{ color: '#64748b', fontWeight: 600 }}>Active Filters:</span>
              {qcSearch && (
                <span className="inv-filter-chip">
                  Search: "{qcSearch}"
                  <button type="button" className="inv-filter-chip-remove" onClick={() => setQcSearch('')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              {qcStatusFilter !== 'All' && (
                <span className="inv-filter-chip">
                  Status: {qcStatusFilter}
                  <button type="button" className="inv-filter-chip-remove" onClick={() => setQcStatusFilter('All')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              <button
                type="button"
                className="inv-filter-clear-all-btn"
                onClick={() => {
                  setQcSearch('');
                  setQcStatusFilter('All');
                }}
              >
                Clear All
              </button>
            </div>
          )}

          {/* QC Checks Table */}
          <div className="inv-table-container" style={{ marginTop: '12px' }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>GRN &amp; CHALLAN</th>
                  <th>SUPPLIER</th>
                  <th>MATERIAL &amp; GRADE</th>
                  <th>BATCH NO</th>
                  <th>ATTRIBUTES</th>
                  <th style={{ textAlign: 'right' }}>INWARD WT</th>
                  <th style={{ textAlign: 'center' }}>QC RESULT</th>
                  <th>STATUS</th>
                  <th>24-HR SLA DEADLINE</th>
                  <th style={{ textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredQcChecks.length > 0 ? (
                  filteredQcChecks.map(qc => {
                    const deadline = qc.deadlineDate || (qc.deadlineAt?.toDate ? qc.deadlineAt.toDate() : null);
                    let hoursDiff = null;
                    if (deadline) {
                      hoursDiff = Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60));
                    }
                    const isOverdue = qc.isOverdue || (hoursDiff !== null && hoursDiff < 0 && qc.status !== 'APPROVED');

                    return (
                      <tr key={qc.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedQcForModal(qc); setShowQcModal(true); }}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{qc.grnNo || 'GRN-N/A'}</div>
                          <div style={{ fontSize: '0.73rem', color: '#64748b' }}>Challan: {qc.challanNo || '—'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{qc.supplierName || '—'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{qc.itemName || 'Raw Material'}</div>
                          <div style={{ fontSize: '0.73rem', color: '#64748b' }}>Grade: {qc.grade || 'Standard'}</div>
                        </td>
                        <td>
                          <span style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 700, color: '#1e293b' }}>
                            {qc.batchNumber || '—'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                            <span>{qc.materialForm || 'Granule'}</span> • <span>{qc.materialColor || 'Natural'}</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{qc.packaging || 'Woven Bag'}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>
                          {Number(qc.netWeight || 0).toLocaleString()} KG
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {qc.result === 'PASS' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '2px 8px', borderRadius: '12px', fontSize: '0.73rem', fontWeight: 700 }}>
                              <CheckCircle2 size={12} /> PASS
                            </span>
                          ) : qc.result === 'FAIL' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', padding: '2px 8px', borderRadius: '12px', fontSize: '0.73rem', fontWeight: 700 }}>
                              <XCircle size={12} /> FAIL
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', padding: '2px 8px', borderRadius: '12px', fontSize: '0.73rem', fontWeight: 600 }}>
                              <Clock size={12} /> Awaiting Test
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: qc.status === 'APPROVED' ? '#dcfce7' : (qc.status === 'SENT_FOR_APPROVAL' ? '#eff6ff' : '#fef3c7'),
                            color: qc.status === 'APPROVED' ? '#15803d' : (qc.status === 'SENT_FOR_APPROVAL' ? '#1d4ed8' : '#b45309'),
                            border: '1px solid currentColor'
                          }}>
                            {qc.status === 'SENT_FOR_APPROVAL' ? 'SENT FOR APPROVAL' : qc.status}
                          </span>
                        </td>
                        <td>
                          {qc.status === 'APPROVED' ? (
                            <div style={{ fontSize: '0.75rem', color: '#15803d', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <ShieldCheck size={14} /> Approved by {qc.approvedBy || 'Manager'}
                            </div>
                          ) : isOverdue ? (
                            <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={14} /> Overdue by {Math.abs(hoursDiff || 0)}h
                            </div>
                          ) : (
                            <div style={{ fontSize: '0.75rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={14} style={{ color: '#2563eb' }} /> {hoursDiff !== null ? `${hoursDiff}h left` : 'Within 24h'}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedQcForModal(qc); setShowQcModal(true); }}
                            className="inv-btn-dark"
                            style={{ padding: '4px 10px', fontSize: '0.73rem' }}
                          >
                            {qc.status === 'PENDING' ? 'Inspect' : (qc.status === 'SENT_FOR_APPROVAL' ? 'Approve' : 'View')}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      <CheckCircle2 size={32} style={{ opacity: 0.4, marginBottom: '8px' }} />
                      <div>No Quality Control records found for the selected filter.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: Bags & Dual Stock (Fixed vs Loose) ── */}
      {activeTab === 'bags' && (
        <div className="inv-section-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div className="inv-view-toggle-wrap">
                <button
                  type="button"
                  className={`inv-view-toggle-btn ${bagViewMode === 'diary' ? 'active' : ''}`}
                  onClick={() => setBagViewMode('diary')}
                >
                  <BookOpen size={13} /> Diary View
                </button>
                <button
                  type="button"
                  className={`inv-view-toggle-btn ${bagViewMode === 'flat' ? 'active' : ''}`}
                  onClick={() => setBagViewMode('flat')}
                >
                  <Scale size={13} /> Flat View
                </button>
              </div>
            </div>
          </div>

          {/* Change 9: Active Filters Bar */}
          {(bagSearch || bagStockTypeFilter !== 'All' || bagLocationFilter !== 'All') && (
            <div className="inv-active-filters-bar">
              <span style={{ color: '#64748b', fontWeight: 600 }}>Active Filters:</span>
              {bagSearch && (
                <span className="inv-filter-chip">
                  Search: "{bagSearch}"
                  <button type="button" className="inv-filter-chip-remove" onClick={() => setBagSearch('')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              {bagStockTypeFilter !== 'All' && (
                <span className="inv-filter-chip">
                  Type: {bagStockTypeFilter}
                  <button type="button" className="inv-filter-chip-remove" onClick={() => setBagStockTypeFilter('All')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              {bagLocationFilter !== 'All' && (
                <span className="inv-filter-chip">
                  Godown: {bagLocationFilter}
                  <button type="button" className="inv-filter-chip-remove" onClick={() => setBagLocationFilter('All')}>
                    <X size={12} />
                  </button>
                </span>
              )}
              <button
                type="button"
                className="inv-filter-clear-all-btn"
                onClick={() => {
                  setBagSearch('');
                  setBagStockTypeFilter('All');
                  setBagLocationFilter('All');
                }}
              >
                Clear All
              </button>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* GROUPED LOT REGISTER CARDS (DIARY) VS UNIFIED (FLAT) VIEW     */}
          {/* ─────────────────────────────────────────────────────────── */}
          {bagViewMode === 'diary' ? (
            <div className="inv-diary-container">
              {diaryLots.length > 0 ? (
                diaryLots.map((lot) => (
                  <div key={lot.lotId} className="inv-diary-lot-card">
                    {/* Bracket Lot Header */}
                    <div className="inv-lot-header">
                      <div className="inv-lot-header-left">
                        {/* Physical Group Bracket Identifier */}
                        <div className="inv-lot-bracket-badge">
                          <span>[ {lot.totalBags} Bags: #{lot.minBag} to #{lot.maxBag} ]</span>
                        </div>

                        <div className="inv-lot-specs">
                          <span className="inv-lot-pill inv-lot-pill-blue">
                            Quality: {lot.quality}
                          </span>
                          <span className="inv-lot-pill inv-lot-pill-purple">
                            Form: {lot.form}
                          </span>
                          <span className="inv-lot-pill inv-lot-pill-green">
                            Size: {lot.size}
                          </span>
                          <span className="inv-lot-pill inv-lot-pill-amber">
                            Std: {lot.standardWeightKg.toFixed(1)} KG
                          </span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                            {lot.coilCount} Coils/bag
                          </span>
                        </div>
                      </div>

                      {/* Lot Summary Statistics */}
                      <div className="inv-lot-summary-stats">
                        <div className="inv-lot-stat-item">
                          <span className="inv-lot-stat-label">Total Net:</span>
                          <span className="inv-lot-stat-val">{lot.totalActualKg.toFixed(1)} KG</span>
                        </div>
                        <div className="inv-lot-stat-item">
                          <span className="inv-lot-stat-label">Avg:</span>
                          <span className="inv-lot-stat-val">{lot.avgWeightKg} KG</span>
                        </div>
                        <div className="inv-lot-stat-item">
                          <span className="inv-lot-stat-label">Coils:</span>
                          <span className="inv-lot-stat-val">{lot.totalCoils}</span>
                        </div>
                        <div className="inv-lot-stat-item">
                          <span className="inv-lot-stat-label">Location:</span>
                          <span className="inv-lot-stat-val">{lot.location}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); printMultipleBagStickers(lot.bags); }}
                          className="inv-btn-ghost"
                          style={{ padding: '3px 8px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}
                          title="Print stickers for all bags in this lot"
                        >
                          <Printer size={12} /> Stickers ({lot.bags.length})
                        </button>
                      </div>
                    </div>

                    {/* Table with Grouped Bag Serials */}
                    <div className="inv-diary-table-wrap">
                      <table className="inv-diary-table">
                        <thead>
                          <tr>
                            <th style={{ width: '90px' }}>BAG #</th>
                            <th style={{ width: '110px' }}>QUALITY</th>
                            <th style={{ width: '90px' }}>FORM</th>
                            <th style={{ width: '80px' }}>SIZE</th>
                            <th style={{ width: '100px', textAlign: 'right' }}>STD WT</th>
                            <th style={{ width: '130px', textAlign: 'right' }}>ACTUAL WT (KG)</th>
                            <th style={{ width: '90px', textAlign: 'center' }}>COILS</th>
                            <th style={{ width: '120px' }}>STOCK TYPE</th>
                            <th>GODOWN / BAY</th>
                            <th style={{ width: '85px', textAlign: 'center' }}>ACTION</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lot.bags.map((bag, idx) => {
                            const stdWt = Number(bag.standardWeightKg) || 50;
                            const actWt = Number(bag.actualWeightKg) || stdWt;
                            const variance = actWt - stdWt;
                            const isEditing = editingBagWeightId === (bag.id || `bag-${bag.bagNumber}`);

                            return (
                              <tr 
                                key={bag.id || `bag-${bag.bagNumber}`}
                                onClick={() => handleOpenBagDrawer(bag)}
                                style={{ cursor: 'pointer' }}
                                title="Click to view full bag details"
                              >
                                <td>
                                  <span className="bag-num-pill" style={bag.status === 'DISPATCHED' ? { background: '#f1f5f9', color: '#64748b', borderColor: '#cbd5e1' } : {}}>
                                    Bag {bag.bagNumber}
                                  </span>
                                  {bag.status === 'DISPATCHED' && (
                                    <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#475569', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '1px 4px', borderRadius: '4px', marginLeft: 4, display: 'inline-block' }}>
                                      DISP
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <strong style={{ color: '#0f172a' }}>{bag.quality || lot.quality}</strong>
                                </td>
                                <td>
                                  <span style={{ color: '#334155' }}>{bag.form || lot.form}</span>
                                </td>
                                <td>
                                  <span style={{ color: '#334155', fontWeight: 600 }}>{bag.size || lot.size}</span>
                                </td>
                                <td>
                                  {`${stdWt.toFixed(1)} KG`}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {isEditing ? (
                                    <div 
                                      onClick={(e) => e.stopPropagation()} 
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                      <input
                                        type="number"
                                        step="0.1"
                                        className="mform-input"
                                        value={editingBagWeightVal}
                                        onChange={(e) => setEditingBagWeightVal(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveBagWeight(bag)}
                                        style={{ width: '70px', padding: '2px 6px', fontSize: '0.8rem', textAlign: 'right' }}
                                        autoFocus
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSaveBagWeight(bag);
                                        }}
                                        style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer' }}
                                      >
                                        <Check size={13} />
                                      </button>
                                    </div>
                                  ) : (
                                    <span 
                                      className="act-wt-cell act-wt-editable"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEditWeight(bag);
                                      }}
                                      title="Click to edit scale weight"
                                    >
                                      {actWt.toFixed(1)} KG
                                      <Edit3 size={11} style={{ opacity: 0.35, marginLeft: 2 }} />
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                                  {bag.coilCount || lot.coilCount}
                                </td>
                                <td>
                                  {bag.stockType === 'FIXED' ? (
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', background: 'rgba(22, 163, 74, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                                      FIXED (50kg)
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706', background: 'rgba(217, 119, 6, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                                      LOOSE (Odd)
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.76rem', color: '#334155' }}>
                                    {bag.location || lot.location}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                    <button
                                      type="button"
                                      className="inv-icon-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        printSingleBagSticker(bag);
                                      }}
                                      title="Print Bag Barcode Sticker (100x75mm)"
                                      style={{ color: '#2563eb' }}
                                    >
                                      <Printer size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      className="inv-icon-btn"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartEditWeight(bag);
                                      }}
                                      title="Edit scale weight"
                                    >
                                      <Edit3 size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="inv-lot-footer-row">
                            <td colSpan={4}>
                              <strong>[ Subtotal: {lot.totalBags} Bags (#{lot.minBag} to #{lot.maxBag}) ]</strong>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {lot.totalStdKg.toFixed(1)} KG
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                              {lot.totalActualKg.toFixed(1)} KG Net
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {lot.totalCoils} Coils
                            </td>
                            <td colSpan={3} style={{ color: '#64748b', fontSize: '0.75rem' }}>
                              Avg {lot.avgWeightKg} KG / bag • {lot.location}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', background: '#ffffff', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                  <Scale size={36} style={{ marginBottom: '12px', opacity: 0.4 }} />
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#334155' }}>No Bags Found For Current Filter</div>
                </div>
              )}
            </div>
          ) : (
            /* ─────────────────────────────────────────────────────────── */
            /* UNIFIED FLAT VIEW REGISTER TABLE                            */
            /* ─────────────────────────────────────────────────────────── */
            <div className="inv-table-container">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>BAG #</th>
                    <th style={{ width: '110px' }}>STOCK TYPE</th>
                    <th style={{ width: '110px' }}>INWARD REF</th>
                    <th>QUALITY</th>
                    <th>FORM</th>
                    <th>SIZE</th>
                    <th style={{ textAlign: 'right' }}>STD WT</th>
                    <th style={{ textAlign: 'right' }}>ACTUAL WT</th>
                    <th style={{ textAlign: 'center' }}>COILS</th>
                    <th>GODOWN / BAY</th>
                    <th>STATUS</th>
                    <th>INWARD DATE</th>
                    <th style={{ textAlign: 'center', width: '85px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBags.length > 0 ? (
                    filteredBags.map((bag) => {
                      const stdWt = Number(bag.standardWeightKg) || 50;
                      const actWt = Number(bag.actualWeightKg) || stdWt;
                      const variance = actWt - stdWt;
                      const isFixed = bag.stockType === 'FIXED';
                      return (
                        <tr
                          key={bag.id || `flat-bag-${bag.bagNumber}`}
                          onClick={() => handleOpenBagDrawer(bag)}
                          style={{ cursor: 'pointer' }}
                          title="Click to view detailed bag drawer"
                        >
                          <td>
                            <span className="bag-num-pill">
                              Bag {bag.bagNumber}
                            </span>
                          </td>
                          <td>
                            {isFixed ? (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', background: 'rgba(22, 163, 74, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                                FIXED (50kg)
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#d97706', background: 'rgba(217, 119, 6, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                                LOOSE (Odd)
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: 600, color: '#2563eb', fontSize: '0.78rem' }}>
                            {bag.inwardSlipNo || 'SLIP-3001'}
                          </td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>
                            {bag.quality || 'Anchor Hank'}
                          </td>
                          <td style={{ color: '#475569' }}>
                            {bag.form || 'Hank'}
                          </td>
                          <td style={{ fontWeight: 600, color: '#334155' }}>
                            {bag.size || '3×3'}
                          </td>
                          <td style={{ textAlign: 'right', color: '#64748b' }}>
                            {stdWt.toFixed(1)} KG
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <span className="act-wt-cell">
                              {actWt.toFixed(1)} KG
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600, color: '#475569' }}>
                            {bag.coilCount || 10}
                          </td>
                          <td style={{ color: '#334155', fontSize: '0.8rem' }}>
                            {bag.location || 'KPI Godown'}
                          </td>
                          <td>
                            {bag.status === 'DISPATCHED' ? (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '12px' }}>
                                🚚 DISPATCHED
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#16a34a', background: 'rgba(22, 163, 74, 0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                                {bag.status || 'AVAILABLE'}
                              </span>
                            )}
                          </td>
                          <td style={{ color: '#64748b', fontSize: '0.78rem' }}>
                            {bag.inwardDate || '2026-03-30'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              <button
                                type="button"
                                className="inv-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  printSingleBagSticker(bag);
                                }}
                                title="Print Bag Barcode Sticker (100x75mm)"
                                style={{ color: '#2563eb' }}
                              >
                                <Printer size={13} />
                              </button>
                              <button
                                type="button"
                                className="inv-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenBagDrawer(bag);
                                }}
                                title="View full bag details"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={14} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        No Bags Found For Current Filter
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
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
      <AddBagBatchModal
        isOpen={showAddBagBatchModal}
        onClose={() => setShowAddBagBatchModal(false)}
        currentMaxBagNumber={Math.max(0, ...liveBags.map(b => Number(b.bagNumber) || 0))}
        onBagsAdded={handleBagsAdded}
      />
      <MaterialDetailDrawer
        material={selectedMaterial}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onIssueJW={triggerJWModal}
        onAddProduction={() => setShowAddFgStockModal(true)}
      />
      <BagDetailDrawer
        bag={selectedBagForDrawer}
        isOpen={isBagDrawerOpen}
        onClose={() => setIsBagDrawerOpen(false)}
        onUpdateBagWeight={handleUpdateBagWeightFromDrawer}
        onUpdateBagLocation={handleUpdateBagLocationFromDrawer}
      />
      {showQcModal && (
        <QcCheckModal
          qcCheck={selectedQcForModal}
          onClose={() => {
            setShowQcModal(false);
            setSelectedQcForModal(null);
          }}
          onSuccess={() => {}}
        />
      )}
      {showQuickLookupModal && (
        <QuickBagLookupModal
          isOpen={showQuickLookupModal}
          onClose={() => setShowQuickLookupModal(false)}
          liveBags={liveBags}
          onOpenBagDrawer={handleOpenBagDrawer}
          onLocateInDiary={handleLocateBagInDiary}
        />
      )}
    </div>
  );
}
