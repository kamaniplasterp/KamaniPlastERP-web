import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, Search, Download, ArrowUpDown, Printer, ChevronRight,
  Package, Users, Briefcase, DollarSign, Percent, Filter, X,
  Clock, ShieldCheck, CheckCircle2, TrendingUp, BarChart3, Bell,
  FileSpreadsheet, Receipt, Layers, Calendar, Scissors,
  SlidersHorizontal, MoreVertical, Eye, RotateCcw, Columns
} from 'lucide-react';
import NewJobWorkModal from '../modals/NewJobWorkModal';
import ReceiveJobWorkModal from '../modals/ReceiveJobWorkModal';
import ExtraCuttingModal from '../modals/ExtraCuttingModal';
import JobWorkDetailView from '../views/JobWorkDetailView';
import { useWorkflow } from '../context/WorkflowContext';
import { exportToCsv } from '../utils/exportCsv';
import { printJobWorkChallan, printInwardDeliverySlip } from '../utils/printDocument';
import { subscribeJobWorks, receiveJobWork, createJobWork, subscribeExtraCuttings, deleteExtraCutting } from '../api/jobwork.api';
import { subscribeVendors } from '../api/directory.api';
import '../styles/JobWorkHub.css';

export default function JobWorkHubView({ onOpenNewJobWork }) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'orders');
  const [selectedJwId, setSelectedJwId] = useState(location.state?.selectedJwId || null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [partyFilter, setPartyFilter] = useState('All');
  const [materialFilter, setMaterialFilter] = useState('All');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showAuditColumns, setShowAuditColumns] = useState(false);
  const [activeRowMenuId, setActiveRowMenuId] = useState(null);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [receivingRow, setReceivingRow] = useState(null);
  const [showExtraCuttingModal, setShowExtraCuttingModal] = useState(false);
  const [extraCuttingSearch, setExtraCuttingSearch] = useState('');
  
  // Close row overflow menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.jw-overflow-wrap')) {
        setActiveRowMenuId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);
  
  // Statement tab specific filters (dynamic FY range covering historical + current 2026 operations)
  const currentYear = new Date().getFullYear();
  const [statementParty, setStatementParty] = useState('');
  const [statementStartDate, setStatementStartDate] = useState(`${currentYear - 1}-04-01`);
  const [statementEndDate, setStatementEndDate] = useState(`${currentYear + 1}-03-31`);

  const [liveJobWorks, setLiveJobWorks] = useState([]);
  const [liveVendors, setLiveVendors] = useState([]);
  const [liveExtraCuttings, setLiveExtraCuttings] = useState([]);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
    if (location.state?.selectedJwId) {
      setSelectedJwId(location.state.selectedJwId);
    }
  }, [location.state]);

  useEffect(() => {
    const unsubJw = subscribeJobWorks(setLiveJobWorks);
    const unsubVe = subscribeVendors(setLiveVendors);
    const unsubEc = subscribeExtraCuttings(setLiveExtraCuttings);
    return () => {
      unsubJw();
      unsubVe();
      unsubEc();
    };
  }, []);

  const handleSaveReceiveModal = async (grnData) => {
    if (!receivingRow) return;

    try {
      await receiveJobWork({
        jwId: receivingRow.firestoreId || receivingRow.id,
        currentRecKg: receivingRow.receivedQty || 0,
        currentScrapKg: receivingRow.scrapQtyKg || 0,
        totalSentKg: receivingRow.inputQty || 1000,
        recGrossWeight: grnData.recGrossWeight,
        recBoraCount: grnData.recBoraCount,
        recArticleType: grnData.recArticleType,
        recArticleWeight: grnData.recArticleWeight,
        recQtyKg: grnData.recQtyKg,
        reworkQtyKg: grnData.reworkQtyKg,
        rejectionQtyKg: grnData.rejectionQtyKg,
        scrapQtyKg: grnData.scrapQtyKg,
        inwardSlipNo: grnData.inwardSlipNo,
        inwardDate: grnData.inwardDate,
        receivedBy: grnData.receivedBy,
        ratePerKg: grnData.ratePerKg,
        samplePcs: grnData.samplePcs,
        sampleWeight: grnData.sampleWeight,
        rawMaterialId: receivingRow.rawMaterialId,
        itemLabel: grnData.itemLabel || receivingRow.material,
        remarks: grnData.notes || `Inward Slip ${grnData.inwardSlipNo} recorded`
      });

      setReceivingRow(null);
    } catch (err) {
      console.error('Error submitting GRN receipt:', err);
    }
  };

  const handleBack = () => {
    setSelectedJwId(null);
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  if (selectedJwId) {
    return <JobWorkDetailView jwId={selectedJwId} onBack={handleBack} />;
  }

  const handleOpenModal = () => {
    if (onOpenNewJobWork) {
      onOpenNewJobWork();
    } else {
      setShowIssueModal(true);
    }
  };

  // Map all Job Works with rich Excel fields
  const allJobWorkData = liveJobWorks.map(jw => {
    const grossWeight = Number(
      jw.grossWeight !== undefined && jw.grossWeight !== null ? jw.grossWeight : 
      (jw.sentQtyKg || 1000)
    );

    const boraCount = Number(
      jw.boraCount !== undefined && jw.boraCount !== null ? jw.boraCount : 
      (jw.noOfBora !== undefined && jw.noOfBora !== null ? jw.noOfBora : (jw.noOfArticles || 0))
    );

    const articleWeight = Number(
      jw.articleWeight !== undefined && jw.articleWeight !== null ? jw.articleWeight : 
      (jw.artWght !== undefined ? jw.artWght : (boraCount * 0.2))
    );

    const netWeight = Number(
      jw.netWeight !== undefined && jw.netWeight !== null ? jw.netWeight : 
      jw.netWeightKg !== undefined ? jw.netWeightKg : 
      (jw.sentQtyKg !== undefined ? jw.sentQtyKg : Math.max(0, grossWeight - articleWeight))
    );

    const bLossPct = Number(
      jw.bLossPct !== undefined && jw.bLossPct !== null ? jw.bLossPct : 
      jw.bLossPercent !== undefined && jw.bLossPercent !== null ? jw.bLossPercent : 
      (parseFloat(String(jw.wastage || 0).replace(/[^0-9.]/g, '')) || 0)
    );

    const bLossKg = Number(
      jw.bLossKg !== undefined && jw.bLossKg !== null ? jw.bLossKg : 
      (netWeight * (bLossPct / 100))
    );

    const netOutwardKg = Number(
      jw.netWeightFinal !== undefined && jw.netWeightFinal !== null ? jw.netWeightFinal : 
      jw.netOutwardKg !== undefined && jw.netOutwardKg !== null ? jw.netOutwardKg : 
      Math.max(0, netWeight - bLossKg)
    );

    const receivedQty = Number(
      jw.recQtyKg !== undefined && jw.recQtyKg !== null ? jw.recQtyKg : 
      (jw.receivedQty !== undefined && jw.receivedQty !== null ? jw.receivedQty : 
      (jw.recQty ? Number(String(jw.recQty).replace(/[^0-9.]/g, '')) : 0))
    );
    
    const pendingQty = (jw.balQtyKg !== undefined && jw.balQtyKg !== null)
      ? Number(jw.balQtyKg)
      : (jw.pendingQty !== undefined && jw.pendingQty !== null
        ? Number(jw.pendingQty)
        : (jw.balQty ? Number(String(jw.balQty).replace(/[^0-9.]/g, '')) : Math.max(0, netOutwardKg - receivedQty)));
    
    const scrapKg = jw.scrapQtyKg !== undefined
      ? Number(jw.scrapQtyKg)
      : Math.max(0, netOutwardKg - receivedQty - pendingQty);
    
    const wastage = scrapKg > 0 ? `${scrapKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG` : (bLossPct > 0 ? `${bLossPct}%` : '-');

    const vendorMatch = liveVendors.find(v => v.id === jw.vendorId || v.name === jw.vendor || v.name === jw.partyName);
    const vendorDefaultRate = vendorMatch && vendorMatch.rate ? Number(vendorMatch.rate) : 17.5;

    let ratePerKg = 0;
    if (typeof jw.ratePerKg === 'number' && jw.ratePerKg > 0) {
      ratePerKg = jw.ratePerKg;
    } else if (typeof jw.rate === 'number' && jw.rate > 0) {
      ratePerKg = jw.rate;
    } else if (typeof jw.processingRate === 'number' && jw.processingRate > 0) {
      ratePerKg = jw.processingRate;
    } else if (typeof jw.charges === 'number' && jw.charges > 0) {
      ratePerKg = jw.charges < 100 ? jw.charges : Math.round(jw.charges / (netWeight || 1));
    } else {
      ratePerKg = vendorDefaultRate;
    }

    const totalCharges = typeof jw.totalCharges === 'number' && jw.totalCharges > 0
      ? jw.totalCharges
      : Math.round(netWeight * ratePerKg);

    return {
      id: jw.jwNo || jw.id,
      firestoreId: jw.id,
      rawMaterialId: jw.rawMaterialId,
      challan: jw.chNo || `${jw.jwNo || jw.id}`,
      subChalNo: jw.subChalNo || jw.subChallanNo || '1',
      workOrder: jw.workOrder || 'WO-1001',
      department: jw.department || 'Job Work Extrusion',
      date: jw.date || '2026-08-01',
      party: jw.partyName || jw.vendor || 'Job Worker',
      material: jw.itemName || jw.rawMat || 'GRANUALS-HDPE ^ HD',
      grade: jw.grade || '',
      process: jw.processName || jw.process || 'GRANUAL - FISHING YARN',
      batch: jw.batch || 'BATCH-RM-JW',
      vehicleNo: jw.vehicleNumber || jw.vehicleNo || '',
      issuedBy: jw.issuedBy || 'SURESHBHAI',
      approvedBy: jw.finalApproval || jw.approvedBy || 'FINAL APPROVED',
      grossWeight,
      boraCount,
      articleWeight,
      articleType: jw.articleType || 'BORA: 0.200',
      inputQty: netWeight,
      netWeight,
      bLossPct,
      bLossKg,
      netOutwardKg,
      receivedQty,
      recBoraCount: Number(jw.recBoraCount || 0),
      pendingQty,
      scrapQtyKg: scrapKg,
      reworkQtyKg: Number(jw.reworkQtyKg || 0),
      rejectionQtyKg: Number(jw.rejectionQtyKg || 0),
      wastage,
      ratePerKg,
      charges: totalCharges,
      expectedReturn: jw.expectedReturn || '',
      durationDays: jw.durationDays || (jw.duration ? parseInt(String(jw.duration)) : 5),
      inwardReceipts: jw.inwardReceipts || jw.inwardSlips || [],
      status: jw.status === 'PARTIAL' ? 'PARTIALLY RECEIVED' : jw.status === 'COMPLETED' ? 'FULLY RECEIVED' : jw.status || 'SENT'
    };
  });

  // Top level KPIs
  const totalSentKg = allJobWorkData.reduce((acc, curr) => acc + (Number(curr.inputQty) || 0), 0);
  const totalReceivedKg = allJobWorkData.reduce((acc, curr) => acc + (Number(curr.receivedQty) || 0), 0);
  const totalPendingKg = allJobWorkData.reduce((acc, curr) => acc + (Number(curr.pendingQty) || 0), 0);
  const totalChargesSum = allJobWorkData.reduce((acc, curr) => acc + (Number(curr.charges) || 0), 0);
  const returnRatePct = totalSentKg > 0 ? ((totalReceivedKg / totalSentKg) * 100).toFixed(1) : '0';
  const totalValueWithProcessorsLakhs = ((totalPendingKg * 115) / 100000).toFixed(2);

  const totalScrapKg = allJobWorkData.reduce((acc, curr) => {
    const input = Number(curr.inputQty) || 0;
    const rec = Number(curr.receivedQty) || 0;
    const pending = Number(curr.pendingQty) || 0;
    return acc + Math.max(0, input - rec - pending);
  }, 0);

  const avgWastagePct = totalSentKg > 0 ? ((totalScrapKg / totalSentKg) * 100).toFixed(1) : '0.0';

  const { activeJobWorksCount, rmList, fgList, simulatedSalesOrders, simulatedDispatches } = useWorkflow();
  const activeSearch = searchQuery || '';

  const rawPolymerValuationInr = (rmList || []).reduce((sum, rm) => {
    return sum + ((Number(rm.availFactory) || 0) * (Number(rm.rate) || 115));
  }, 0);
  const rawPolymerValuationLakhs = (rawPolymerValuationInr / 100000).toFixed(2);

  const fgValuationInr = (fgList || []).reduce((fgSum, fg) => {
    return fgSum + ((Number(fg.stockQty) || 0) * (Number(fg.rate) || 2450));
  }, 0);
  const fgValuationLakhs = (fgValuationInr / 100000).toFixed(2);

  const invoicedDispatchesValInr = (simulatedDispatches || []).reduce((dSum, d) => {
    return dSum + (Number(d.totalValue) || Number(d.value) || 0);
  }, 0);
  const invoicedDispatchesLakhs = (invoicedDispatchesValInr / 100000).toFixed(2);

  const uniqueJwParties = Array.from(new Set(allJobWorkData.map(j => j.party).filter(Boolean)));
  const uniqueJwMaterials = Array.from(new Set(allJobWorkData.map(j => j.material).filter(Boolean)));

  const filteredData = allJobWorkData.filter(item => {
    const matchesSearch =
      item.id.toLowerCase().includes(activeSearch.toLowerCase()) ||
      item.challan.toLowerCase().includes(activeSearch.toLowerCase()) ||
      item.party.toLowerCase().includes(activeSearch.toLowerCase()) ||
      item.material.toLowerCase().includes(activeSearch.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' ||
      item.status === statusFilter ||
      (statusFilter === 'SENT' && item.status === 'SENT') ||
      (statusFilter === 'PARTIALLY RECEIVED' && (item.status === 'PARTIAL' || item.status === 'PARTIALLY RECEIVED')) ||
      (statusFilter === 'FULLY RECEIVED' && (item.status === 'COMPLETED' || item.status === 'FULLY RECEIVED'));

    const matchesParty = partyFilter === 'All' || item.party === partyFilter;
    const matchesMaterial = materialFilter === 'All' || item.material === materialFilter;

    return matchesSearch && matchesStatus && matchesParty && matchesMaterial;
  });

  // Statement Data Computation for Selected Job Worker
  const currentStatementParty = (statementParty && uniqueJwParties.includes(statementParty))
    ? statementParty
    : (uniqueJwParties[0] || 'All Parties');

  // Prior consignments for Opening Balance computation
  const priorOrders = allJobWorkData.filter(j => 
    (j.party || '').toLowerCase() === currentStatementParty.toLowerCase() &&
    statementStartDate && j.date && j.date < statementStartDate
  );

  const stmtOpeningWeight = priorOrders.reduce((s, o) => {
    const netSent = (Number(o.inputQty) || 0) - (Number(o.bLossKg) || 0);
    const rec = Number(o.receivedQty) || 0;
    return s + Math.max(0, netSent - rec);
  }, 0);

  const stmtOpeningBora = priorOrders.reduce((s, o) => {
    const sent = Number(o.boraCount) || 0;
    const rec = Number(o.recBoraCount) || 0;
    return s + Math.max(0, sent - rec);
  }, 0);

  // Active statement range orders
  const statementOrders = allJobWorkData.filter(j => {
    if ((j.party || '').toLowerCase() !== currentStatementParty.toLowerCase()) return false;
    if (statementStartDate && j.date && j.date < statementStartDate) return false;
    if (statementEndDate && j.date && j.date > statementEndDate) return false;
    return true;
  });

  const stmtOutwardNetSum = statementOrders.reduce((s, o) => s + (Number(o.inputQty) || 0), 0);
  const stmtBLossSum = statementOrders.reduce((s, o) => s + (Number(o.bLossKg) || 0), 0);
  const stmtOutwardAfterLoss = Math.max(0, stmtOutwardNetSum - stmtBLossSum);
  const stmtInwardSum = statementOrders.reduce((s, o) => s + (Number(o.receivedQty) || 0), 0);
  const stmtClosingWeightBal = Math.max(0, stmtOpeningWeight + stmtOutwardAfterLoss - stmtInwardSum);
  const stmtClosingValuation = (stmtClosingWeightBal * 17.5);

  const stmtBoraOutward = statementOrders.reduce((s, o) => s + (Number(o.boraCount) || 0), 0);
  const stmtBoraInward = statementOrders.reduce((s, o) => s + (Number(o.recBoraCount) || 0), 0);
  const stmtBoraClosing = Math.max(0, stmtOpeningBora + stmtBoraOutward - stmtBoraInward);

  // Theli and Labels tracking
  const stmtTheliOpening = stmtOpeningBora * 5;
  const stmtTheliClosing = stmtBoraClosing * 5;

  // Extra cuttings / deductions linked directly to this Job Worker
  const partyExtraCuttings = (liveExtraCuttings || []).filter(e => 
    !currentStatementParty || (e.partyName || '').toLowerCase() === currentStatementParty.toLowerCase()
  );
  const stmtExtraCuttingTotal = partyExtraCuttings.reduce((sum, e) => {
    const w = Number(e.weightKg !== undefined && e.weightKg !== null ? e.weightKg : (e.weight || 0)) || 0;
    const r = Number(e.rate || 0) || 0;
    const val = Number(e.totalAmount !== undefined && e.totalAmount !== null ? e.totalAmount : (e.total !== undefined ? e.total : (w * r))) || 0;
    return sum + (isNaN(val) ? 0 : val);
  }, 0);
  const stmtDeductions = statementOrders.reduce((s, o) => s + (Number(o.rejectionQtyKg) * 100), 0) + stmtExtraCuttingTotal;

  const stmtTotalPayable = statementOrders.reduce((s, o) => s + (Number(o.charges) || (Number(o.receivedQty) * (Number(o.ratePerKg) || 17.5))), 0);
  const stmtTotalPaid = Math.round(stmtTotalPayable * 0.85); // Demo paid amount
  const stmtClosingFinBal = stmtTotalPayable - stmtDeductions - stmtTotalPaid;

  // Extra Cutting search filter
  const filteredExtraCuttings = (liveExtraCuttings || []).filter(e => 
    (e.partyName || '').toLowerCase().includes(extraCuttingSearch.toLowerCase()) ||
    (e.deductionDetails || '').toLowerCase().includes(extraCuttingSearch.toLowerCase()) ||
    (e.remarks || '').toLowerCase().includes(extraCuttingSearch.toLowerCase())
  );
  const totalExtraCuttingKg = filteredExtraCuttings.reduce((s, e) => {
    const w = Number(e.weightKg !== undefined && e.weightKg !== null ? e.weightKg : (e.weight || 0)) || 0;
    return s + (isNaN(w) ? 0 : w);
  }, 0);
  const totalExtraCuttingVal = filteredExtraCuttings.reduce((s, e) => {
    const w = Number(e.weightKg !== undefined && e.weightKg !== null ? e.weightKg : (e.weight || 0)) || 0;
    const r = Number(e.rate || 0) || 0;
    const val = Number(e.totalAmount !== undefined && e.totalAmount !== null ? e.totalAmount : (e.total !== undefined ? e.total : (w * r))) || 0;
    return s + (isNaN(val) ? 0 : val);
  }, 0);

  const computedVendorGroups = Object.values(
    allJobWorkData.reduce((acc, order) => {
      const vName = order.party || 'Job Worker';
      if (!acc[vName]) {
        acc[vName] = {
          vendor: vName,
          gst: '24AAAAA0000A1Z5',
          address: 'GIDC Industrial Estate, Gujarat',
          contact: 'Factory Contact',
          totalQty: '0 KG',
          totalVal: '₹0',
          orders: [],
          pendingKgSum: 0
        };
      }
      acc[vName].orders.push({
        id: order.id,
        challan: order.challan,
        challanDate: order.date,
        material: order.material,
        process: order.process || 'GRANUAL - FISHING YARN',
        batch: order.batch || 'WIP-LOT',
        grossWeight: order.grossWeight,
        boraCount: order.boraCount,
        sentQty: `${order.inputQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG`,
        recdQty: `${order.receivedQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG`,
        pendingQty: `${order.pendingQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG`,
        expReturn: order.expectedReturn,
        status: order.status
      });
      acc[vName].pendingKgSum += Number(order.pendingQty) || 0;
      acc[vName].totalQty = `${acc[vName].pendingKgSum.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG`;
      acc[vName].totalVal = `₹${(acc[vName].pendingKgSum * 17.5).toLocaleString('en-IN')}`;
      return acc;
    }, {})
  );

  const computedVendorPerformance = Object.values(
    allJobWorkData.reduce((acc, order) => {
      const vName = order.party || 'Job Worker';
      if (!acc[vName]) {
        acc[vName] = {
          vendor: vName,
          city: 'Gujarat',
          spec: order.process || 'Extrusion / Yarn Making',
          sentKg: 0,
          recdKg: 0,
          pendingKg: 0,
          chargesSum: 0
        };
      }
      acc[vName].sentKg += Number(order.inputQty) || 0;
      acc[vName].recdKg += Number(order.receivedQty) || 0;
      acc[vName].pendingKg += Number(order.pendingQty) || 0;
      acc[vName].chargesSum += Number(order.charges) || 0;
      return acc;
    }, {})
  ).map(v => {
    const actualWastageKg = Math.max(0, v.sentKg - v.recdKg - v.pendingKg);
    const wastagePctNum = v.sentKg > 0 ? (actualWastageKg / v.sentKg) * 100 : 0;
    const allowedPct = 3.0;
    const isWithin = wastagePctNum <= allowedPct;
    const rating = isWithin ? 'Within Tolerance' : 'Exceeds Tolerance';

    return {
      vendor: v.vendor,
      city: v.city,
      spec: v.spec,
      sent: v.sentKg.toLocaleString('en-IN', { maximumFractionDigits: 1 }),
      recd: v.recdKg.toLocaleString('en-IN', { maximumFractionDigits: 1 }),
      actualWastageKg: actualWastageKg.toLocaleString('en-IN', { maximumFractionDigits: 1 }),
      allowedWastagePct: `${allowedPct.toFixed(1)}%`,
      actualWastagePct: `${wastagePctNum.toFixed(2)}%`,
      rating,
      isWithin,
      charges: `₹${v.chargesSum.toLocaleString('en-IN')}`
    };
  });

  const fgProductionData = (fgList && fgList.length > 0)
    ? fgList.map(fg => ({
        name: fg.name || 'PP Danline Rope 6mm',
        count: `${fg.stockQty} Coils`,
        pct: Math.min(100, Math.max(25, (Number(fg.stockQty) / 500) * 100))
      }))
    : [
        { name: 'LOTUS SUPER-LS ^ 02MM ^ HANKS ^ 1KG', count: '450 Coils', pct: 60 }
      ];

  const dispatchFulfillmentData = (simulatedSalesOrders && simulatedSalesOrders.length > 0)
    ? simulatedSalesOrders.map(so => {
        const ordered = Number(so.orderedQtyCoils || 300);
        const dispatched = Number(so.dispatchedQtyCoils || 300);
        const pct = ordered > 0 ? Math.round((dispatched / ordered) * 100) : 100;
        return {
          ref: so.orderNo || 'SO-2026-5601',
          customer: so.customer || 'ABC Marine Traders',
          status: `${pct}% Fulfilled`,
          pct
        };
      })
    : [
        { ref: 'SO-2026-5601', customer: 'ABC Marine Traders', status: '100% Fulfilled', pct: 100 }
      ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SENT':
        return <span className="jw-status-pill pill-sent">• SENT</span>;
      case 'IN PROCESS':
        return <span className="jw-status-pill pill-inprocess">• IN PROCESS</span>;
      case 'PARTIALLY RECEIVED':
        return <span className="jw-status-pill pill-partial">• PARTIALLY RECEIVED</span>;
      case 'FULLY RECEIVED':
        return <span className="jw-status-pill pill-completed">• FULLY RECEIVED</span>;
      case 'OVERDUE':
        return <span className="jw-status-pill pill-overdue">• OVERDUE</span>;
      default:
        return <span className="jw-status-pill">{status}</span>;
    }
  };

  return (
    <div className="jw-hub-container">
      {/* ── Page Header ── */}
      <div className="jw-page-header">
        <div className="jw-header-left">
          <div className="jw-title-row">
            <h1 className="jw-page-title">Job Work Operations</h1>
            <span className="jw-badge-orange">{activeJobWorksCount} Active Consignments</span>
          </div>
          <p className="jw-page-subtitle">
            Rule 55 CGST Outward Challans, Inward Delivery Slips, Tare &amp; B.Loss tracking, and Worker Ledger.
          </p>
        </div>
        <div className="jw-header-right">
          <button className="jw-btn-primary-blue" onClick={handleOpenModal}>
            <Plus size={15} />
            New Outward Challan
          </button>
        </div>
      </div>

      {/* ── Contextual Metric Area (No Stacked Duplicates across Tabs) ── */}
      <div className="jw-top-kpis">
        {activeTab === 'challanReport' ? (
          <>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Total Dispatched (Net)</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{totalSentKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Total Inward Received</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num jw-text-green">{totalReceivedKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG ({returnRatePct}%)</span>
              </div>
            </div>
            <div className="jw-kpi-card jw-kpi-highlight">
              <div className="jw-kpi-title jw-title-orange">Outstanding Balance</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num jw-text-orange">{totalPendingKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Total Burning Loss</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{allJobWorkData.reduce((s, c) => s + (Number(c.bLossKg) || 0), 0).toFixed(1)}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
          </>
        ) : activeTab === 'statement' ? (
          <>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Opening Balance</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{stmtOpeningWeight.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Outward (− B.Loss)</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{stmtOutwardAfterLoss.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Inward Received</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num jw-text-green">{stmtInwardSum.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
            <div className="jw-kpi-card jw-kpi-highlight">
              <div className="jw-kpi-title jw-title-orange">Closing Balance</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num jw-text-orange">{stmtClosingWeightBal.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
          </>
        ) : activeTab === 'wastage' ? (
          <>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Active Processors</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{computedVendorPerformance.length}</span>
                <span className="jw-kpi-sublabel">vendors</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Total Dispatched</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{totalSentKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Actual Process Scrap</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num jw-text-orange">{totalScrapKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Avg Wastage Yield</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{avgWastagePct}%</span>
                <span className="jw-kpi-sublabel">scrap</span>
              </div>
            </div>
          </>
        ) : activeTab === 'extraCutting' ? (
          <>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Total Records</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{filteredExtraCuttings.length}</span>
                <span className="jw-kpi-sublabel">entries</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Total Deduction Weight</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{totalExtraCuttingKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
            <div className="jw-kpi-card jw-kpi-highlight">
              <div className="jw-kpi-title jw-title-orange">Total Deductions Value</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num jw-text-orange">₹{totalExtraCuttingVal.toLocaleString('en-IN')}</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Active Parties</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{new Set(partyExtraCuttings.map(e => e.partyName)).size}</span>
                <span className="jw-kpi-sublabel">parties</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Active Job Works</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{activeJobWorksCount}</span>
                <span className="jw-kpi-sublabel">consignments</span>
              </div>
            </div>
            <div className="jw-kpi-card jw-kpi-highlight">
              <div className="jw-kpi-title jw-title-orange">Material with Vendors</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num jw-text-orange">{Math.max(0, totalPendingKg).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-kpi-sublabel">KG</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Value with Processors</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">₹{totalValueWithProcessorsLakhs}L</span>
              </div>
            </div>
            <div className="jw-kpi-card">
              <div className="jw-kpi-title">Avg Wastage Yield</div>
              <div className="jw-kpi-val-row">
                <span className="jw-kpi-num">{avgWastagePct}%</span>
                <span className="jw-kpi-sublabel">scrap</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Minimalist Underline Tab Bar ── */}
      <div className="jw-tab-bar">
        <button
          className={`jw-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <Briefcase size={14} />
          <span>Orders &amp; Challans</span>
          <span className="jw-tab-badge">{allJobWorkData.length}</span>
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'challanReport' ? 'active' : ''}`}
          onClick={() => setActiveTab('challanReport')}
        >
          <FileSpreadsheet size={14} />
          <span>Challan Balance Report</span>
          <span className="jw-tab-badge-orange">{allJobWorkData.filter(j => j.status !== 'FULLY RECEIVED').length} Open</span>
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'statement' ? 'active' : ''}`}
          onClick={() => setActiveTab('statement')}
        >
          <Receipt size={14} />
          <span>Job Worker Statement &amp; Ledger</span>
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'material' ? 'active' : ''}`}
          onClick={() => setActiveTab('material')}
        >
          <Package size={14} />
          <span>Material at Outside Processors</span>
          <span className="jw-tab-badge-orange">{totalPendingKg.toLocaleString('en-IN', { maximumFractionDigits: 0 })} KG</span>
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'wastage' ? 'active' : ''}`}
          onClick={() => setActiveTab('wastage')}
        >
          <Percent size={14} />
          <span>Vendor Wastage &amp; Yield</span>
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'extraCutting' ? 'active' : ''}`}
          onClick={() => setActiveTab('extraCutting')}
        >
          <Scissors size={14} />
          <span>Extra Cutting / Deductions</span>
          <span className="jw-tab-badge">{liveExtraCuttings.length}</span>
        </button>
      </div>

      {/* ── TAB 1: Job Work Ledger ── */}
      {activeTab === 'orders' && (
        <div className="jw-ledger-section">
          {/* Progressive Filter & Actions Bar */}
          {(() => {
            const activeFilterCount = (statusFilter !== 'All' ? 1 : 0) + (partyFilter !== 'All' ? 1 : 0) + (materialFilter !== 'All' ? 1 : 0);
            return (
              <>
                <div className="jw-filter-bar">
                  <div className="jw-search-input-wrap">
                    <Search size={14} className="jw-search-icon" />
                    <input
                      type="text"
                      placeholder="Search Challan#, Party, Material, Process..."
                      className="jw-filter-search"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button 
                        type="button" 
                        onClick={() => setSearchQuery('')}
                        className="jw-filter-clear-icon"
                        title="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className={`jw-btn-ghost jw-filter-toggle-btn ${showFilterPanel || activeFilterCount > 0 ? 'active' : ''}`}
                    onClick={() => setShowFilterPanel(!showFilterPanel)}
                  >
                    <SlidersHorizontal size={14} />
                    <span>Filters</span>
                    {activeFilterCount > 0 && <span className="jw-filter-count-badge">{activeFilterCount}</span>}
                  </button>

                  <button
                    type="button"
                    className={`jw-btn-ghost ${showAuditColumns ? 'active' : ''}`}
                    onClick={() => setShowAuditColumns(!showAuditColumns)}
                    title="Toggle secondary audit columns (Gross, Bora, B.Loss, Issued By)"
                  >
                    <Columns size={14} />
                    <span>{showAuditColumns ? 'Standard Columns' : 'Audit Columns'}</span>
                  </button>

                  <button
                    className="jw-btn-ghost"
                    onClick={() => exportToCsv('Job_Work_Register.csv', filteredData)}
                    style={{ marginLeft: 'auto' }}
                    title="Export filtered records to CSV"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                </div>

                {/* Expandable Filter Panel (Progressive Disclosure) */}
                {showFilterPanel && (
                  <div className="jw-expanded-filters-panel">
                    <div className="jw-filter-field">
                      <label>Status</label>
                      <select
                        className="jw-filter-select"
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                      >
                        <option value="All">All Statuses ({allJobWorkData.length})</option>
                        <option value="SENT">SENT</option>
                        <option value="PARTIALLY RECEIVED">PARTIALLY RECEIVED</option>
                        <option value="FULLY RECEIVED">FULLY RECEIVED</option>
                      </select>
                    </div>

                    <div className="jw-filter-field">
                      <label>Job Worker / Party</label>
                      <select
                        className="jw-filter-select"
                        value={partyFilter}
                        onChange={e => setPartyFilter(e.target.value)}
                      >
                        <option value="All">All Job Work Parties</option>
                        {uniqueJwParties.map(p => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>

                    <div className="jw-filter-field">
                      <label>Raw Material</label>
                      <select
                        className="jw-filter-select"
                        value={materialFilter}
                        onChange={e => setMaterialFilter(e.target.value)}
                      >
                        <option value="All">All Raw Materials</option>
                        {uniqueJwMaterials.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        className="jw-btn-reset-filters"
                        onClick={() => {
                          setStatusFilter('All');
                          setPartyFilter('All');
                          setMaterialFilter('All');
                        }}
                      >
                        <RotateCcw size={12} />
                        Reset
                      </button>
                    )}
                  </div>
                )}

                {/* Active Filter Chips */}
                {activeFilterCount > 0 && (
                  <div className="jw-active-chips-row">
                    <span className="jw-active-chips-label">Active:</span>
                    {statusFilter !== 'All' && (
                      <span className="jw-filter-chip">
                        Status: <strong>{statusFilter}</strong>
                        <button type="button" onClick={() => setStatusFilter('All')}><X size={11} /></button>
                      </span>
                    )}
                    {partyFilter !== 'All' && (
                      <span className="jw-filter-chip">
                        Party: <strong>{partyFilter}</strong>
                        <button type="button" onClick={() => setPartyFilter('All')}><X size={11} /></button>
                      </span>
                    )}
                    {materialFilter !== 'All' && (
                      <span className="jw-filter-chip">
                        Material: <strong>{materialFilter}</strong>
                        <button type="button" onClick={() => setMaterialFilter('All')}><X size={11} /></button>
                      </span>
                    )}
                    <button
                      type="button"
                      className="jw-clear-all-link"
                      onClick={() => {
                        setStatusFilter('All');
                        setPartyFilter('All');
                        setMaterialFilter('All');
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </>
            );
          })()}

          {/* Operational Focused Table (8 core columns by default, expanding with audit fields) */}
          <div className="jw-table-container">
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th>CHALLAN NO.</th>
                  <th>DATE</th>
                  <th>PARTY</th>
                  <th>ITEM / PROCESS</th>
                  {showAuditColumns && <th>GROSS (KG)</th>}
                  {showAuditColumns && <th>BORA</th>}
                  {showAuditColumns && <th>B.LOSS</th>}
                  <th className="th-right">NET OUTWARD (KG)</th>
                  <th className="th-right">BALANCE (KG)</th>
                  <th>STATUS</th>
                  {showAuditColumns && <th>ISSUED BY</th>}
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map(row => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedJwId(row.id)}
                    style={{ cursor: 'pointer' }}
                    title={`View details for ${row.id}`}
                  >
                    <td className="td-jw-num">
                      <span className="jw-id-link">{row.id}</span>
                      <span className="jw-challan-sub">Chl #{row.challan}</span>
                    </td>
                    <td className="td-date">{row.date}</td>
                    <td className="td-party">{row.party}</td>
                    <td className="td-material-col">
                      <div className="jw-mat-name">{row.material}</div>
                      <div className="jw-mat-sub">
                        {row.process} • <span className="jw-batch-text">{row.batch}</span>
                      </div>
                    </td>
                    {showAuditColumns && (
                      <td className="td-qty-right">{row.grossWeight ? row.grossWeight.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : '—'}</td>
                    )}
                    {showAuditColumns && (
                      <td className="td-qty">{row.boraCount > 0 ? `${row.boraCount} Bora` : '—'}</td>
                    )}
                    {showAuditColumns && (
                      <td className="td-wastage">{row.bLossPct > 0 ? `${row.bLossPct}% (${row.bLossKg.toFixed(1)} KG)` : '0%'}</td>
                    )}
                    <td className="td-qty td-qty-right" style={{ fontWeight: 'bold' }}>
                      {(row.netOutwardKg || row.inputQty || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG
                    </td>
                    <td className="td-qty td-qty-right">
                      {row.pendingQty > 0 ? (
                        <span className="pending-orange-bold">{row.pendingQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>0 KG</span>
                      )}
                    </td>
                    <td className="td-status">{getStatusBadge(row.status)}</td>
                    {showAuditColumns && (
                      <td className="td-date" style={{ fontSize: '0.72rem', color: '#475569' }}>{row.issuedBy}</td>
                    )}
                    <td className="td-actions" onClick={e => e.stopPropagation()}>
                      <div className="jw-action-group">
                        {row.status === 'COMPLETED' || row.status === 'FULLY RECEIVED' || Number(row.pendingQty) <= 0 ? (
                          <button
                            className="jw-receive-btn"
                            disabled
                            style={{ opacity: 0.5, cursor: 'not-allowed', background: '#f1f5f9', color: '#94a3b8', borderColor: '#cbd5e1' }}
                            title="Fully received (0 KG pending)"
                          >
                            Received
                          </button>
                        ) : (
                          <button
                            className="jw-receive-btn"
                            title="Record Inward Slip"
                            onClick={() => setReceivingRow(row)}
                          >
                            Inward
                          </button>
                        )}

                        {/* Overflow Menu [•••] */}
                        <div className="jw-overflow-wrap">
                          <button
                            type="button"
                            className={`jw-icon-action ${activeRowMenuId === row.id ? 'active' : ''}`}
                            title="More actions"
                            onClick={() => setActiveRowMenuId(activeRowMenuId === row.id ? null : row.id)}
                          >
                            <MoreVertical size={14} />
                          </button>

                          {activeRowMenuId === row.id && (
                            <div className="jw-overflow-menu" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                className="jw-menu-item"
                                onClick={() => {
                                  setActiveRowMenuId(null);
                                  setSelectedJwId(row.id);
                                }}
                              >
                                <Eye size={13} />
                                <span>View Details</span>
                              </button>
                              <button
                                type="button"
                                className="jw-menu-item"
                                onClick={() => {
                                  setActiveRowMenuId(null);
                                  printJobWorkChallan(row);
                                }}
                              >
                                <Printer size={13} />
                                <span>Print Rule 55 Challan</span>
                              </button>
                              {Number(row.receivedQty || 0) > 0 ? (
                                <button
                                  type="button"
                                  className="jw-menu-item"
                                  onClick={() => {
                                    setActiveRowMenuId(null);
                                    const recKg = Number(row.receivedQty || 0);
                                    const slip = (Array.isArray(row.inwardReceipts) && row.inwardReceipts.length > 0)
                                      ? row.inwardReceipts[0]
                                      : {
                                          slipNo: `SLIP-${row.chNo || row.challan || row.id}`,
                                          grossWeight: recKg + ((Number(row.boraCount) || 10) * 0.2),
                                          boraCount: Number(row.boraCount) || 10,
                                          articleWeight: (Number(row.boraCount) || 10) * 0.2,
                                          netQtyKg: recKg,
                                          receivedBy: 'RAMILBHAI',
                                          ratePerKg: row.ratePerKg || row.charges || 16,
                                          value: recKg * Number(row.ratePerKg || row.charges || 16)
                                        };
                                    printInwardDeliverySlip(slip, row);
                                  }}
                                >
                                  <Receipt size={13} />
                                  <span>Print Inward Slip</span>
                                </button>
                              ) : (
                                <div className="jw-menu-item disabled" title="No inward receipts yet">
                                  <Receipt size={13} />
                                  <span>Inward Slip (No Inward Yet)</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: Challan Balance Report ── */}
      {activeTab === 'challanReport' && (
        <div className="jw-ledger-section">
          <div className="jw-ledger-header">
            <div className="jw-ledger-title-group">
              <div className="jw-ledger-title-row">
                <h2 className="jw-ledger-title">Challan Balance Report (Analytical Register)</h2>
                <span className="jw-badge-blue">Excel Challan Wise Co.</span>
              </div>
              <p className="jw-ledger-subtitle">
                Comprehensive audit of Net Weight, Burning Loss % (B.Loss), Burning Loss Weight, Net Receivable, Inward Received, and Balance Weight per Challan.
              </p>
            </div>

            <div className="jw-ledger-actions">
              <button className="jw-btn-ghost" onClick={() => exportToCsv('Challan_Balance_Report.csv', allJobWorkData)} style={{ cursor: 'pointer' }}>
                <Download size={14} />
                Export Challan Report
              </button>
            </div>
          </div>

          {/* Challan Wise Table (Stacked KPI grid eliminated; contextual metrics displayed in Top Area) */}
          <div className="jw-table-container">
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>CHALLAN NO.</th>
                  <th>PARTY NAME</th>
                  <th>B. LOSS %</th>
                  <th>SUM NET WEIGHT</th>
                  <th>SUM B. LOSS</th>
                  <th>NET WEIGHT</th>
                  <th>INWARD WEIGHT</th>
                  <th>BALANCE WEIGHT</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {allJobWorkData.map((row, idx) => (
                  <tr key={idx}>
                    <td className="td-date">{row.date}</td>
                    <td className="td-jw-num" style={{ fontWeight: 'bold' }}>{row.challan}</td>
                    <td className="td-party">{row.party}</td>
                    <td className="td-qty">{row.bLossPct}%</td>
                    <td className="td-qty">{row.inputQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                    <td className="td-qty">{row.bLossKg.toFixed(1)}</td>
                    <td className="td-qty" style={{ fontWeight: 'bold' }}>{row.netOutwardKg.toFixed(1)}</td>
                    <td className="td-qty" style={{ color: '#16a34a', fontWeight: 'bold' }}>{row.receivedQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                    <td className="td-qty">
                      <span className={row.pendingQty > 0 ? 'pending-orange-bold' : 'badge-green-sm'}>
                        {row.pendingQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG
                      </span>
                    </td>
                    <td className="td-status">{getStatusBadge(row.status)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="jw-icon-action"
                          title="Print Rule 55 Delivery Challan (Outward)"
                          onClick={() => printJobWorkChallan(row)}
                        >
                          <Printer size={13} />
                        </button>
                        {row.receivedQty > 0 && (
                          <button
                            className="jw-icon-action"
                            style={{ color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' }}
                            title="Print Job Work Inward Delivery Slip"
                            onClick={() => {
                              const slip = (Array.isArray(row.inwardReceipts) && row.inwardReceipts.length > 0)
                                ? row.inwardReceipts[0]
                                : {
                                    slipNo: `SLIP-${row.challan || row.id}`,
                                    grossWeight: row.receivedQty + ((Number(row.boraCount) || 10) * 0.2),
                                    boraCount: Number(row.boraCount) || 10,
                                    articleWeight: (Number(row.boraCount) || 10) * 0.2,
                                    netQtyKg: row.receivedQty,
                                    receivedBy: 'RAMILBHAI',
                                    ratePerKg: row.ratePerKg || row.charges || 16,
                                    value: row.receivedQty * Number(row.ratePerKg || row.charges || 16)
                                  };
                              printInwardDeliverySlip(slip, row);
                            }}
                          >
                            <Receipt size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Job Worker Statement & Reconciliation (Matching Excel 'Statement' sheet) ── */}
      {activeTab === 'statement' && (
        <div className="jw-ledger-section">
          <div className="jw-ledger-header">
            <div className="jw-ledger-title-group">
              <div className="jw-ledger-title-row">
                <h2 className="jw-ledger-title">Job Worker Statement &amp; Financial Ledger</h2>
                <span className="jw-badge-orange">{currentStatementParty}</span>
              </div>
              <p className="jw-ledger-subtitle">
                Complete party ledger tracking material weight reconciliation, Bora packaging balance, payable charges, extra cutting deductions, and payment receipts.
              </p>
            </div>

            <div className="jw-ledger-actions">
              <button className="jw-btn-ghost" onClick={() => exportToCsv(`Statement_${currentStatementParty}.csv`, statementOrders)} style={{ cursor: 'pointer' }}>
                <Download size={14} />
                Export Statement CSV
              </button>
            </div>
          </div>

          {/* Party & Date Range Selector */}
          <div className="jw-filter-bar" style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={15} style={{ color: '#2563eb' }} />
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b' }}>Select Job Worker:</label>
              <select
                className="jw-filter-select"
                value={currentStatementParty}
                onChange={e => setStatementParty(e.target.value)}
                style={{ fontWeight: 'bold', minWidth: '220px' }}
              >
                {uniqueJwParties.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={15} style={{ color: '#ea580c' }} />
              <label style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#1e293b' }}>Date Range:</label>
              <input type="date" className="jw-filter-select" value={statementStartDate} onChange={e => setStatementStartDate(e.target.value)} />
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>to</span>
              <input type="date" className="jw-filter-select" value={statementEndDate} onChange={e => setStatementEndDate(e.target.value)} />
            </div>
          </div>

          {/* Statement 3-Category Summary Block (Calm Enterprise Design) */}
          <div className="jw-stmt-summary-grid">
            {/* 1. Weight Reconciliation */}
            <div className="jw-stmt-box">
              <div className="jw-stmt-box-header">
                ⚖️ Material Weight Reconciliation
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Opening Balance (weight):</span>
                <span className="jw-stmt-row-val">{stmtOpeningWeight.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Opening Balance (value):</span>
                <span className="jw-stmt-row-val" style={{ color: '#0369a1' }}>₹{(stmtOpeningWeight * 17.5).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Outward Dispatched:</span>
                <span className="jw-stmt-row-val">{stmtOutwardNetSum.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Outward (− B. Loss):</span>
                <span className="jw-stmt-row-val" style={{ color: '#0284c7' }}>{stmtOutwardAfterLoss.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Inward Received:</span>
                <span className="jw-stmt-row-val" style={{ color: '#16a34a' }}>{stmtInwardSum.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Consumption:</span>
                <span className="jw-stmt-row-val">{stmtInwardSum.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
              </div>
              <div className="jw-stmt-closing-row">
                <span>Closing Balance:</span>
                <span style={{ color: '#ea580c' }}>{stmtClosingWeightBal.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                <span>Closing Balance (val):</span>
                <span style={{ fontWeight: '600', color: '#0369a1' }}>₹{stmtClosingValuation.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* 2. Packaging & Bora Reconciliation */}
            <div className="jw-stmt-box">
              <div className="jw-stmt-box-header">
                📦 Packaging &amp; Bora Balance
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Bora Opening Balance:</span>
                <span className="jw-stmt-row-val">{stmtOpeningBora} Bora</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Bora Outward:</span>
                <span className="jw-stmt-row-val">{stmtBoraOutward} Bora</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Bora Inward:</span>
                <span className="jw-stmt-row-val" style={{ color: '#16a34a' }}>{stmtBoraInward} Bora</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Theli &amp; Label Opening:</span>
                <span className="jw-stmt-row-val">{stmtTheliOpening} Nos</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Theli &amp; Label Closing:</span>
                <span className="jw-stmt-row-val">{stmtTheliClosing} Nos</span>
              </div>
              <div className="jw-stmt-closing-row">
                <span>Bora Closing Balance:</span>
                <span style={{ color: '#d97706' }}>{stmtBoraClosing} Bora</span>
              </div>
            </div>

            {/* 3. Financial Ledger Reconciliation */}
            <div className="jw-stmt-box">
              <div className="jw-stmt-box-header">
                💳 Financial &amp; Payment Ledger
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Total Payable:</span>
                <span className="jw-stmt-row-val">₹{stmtTotalPayable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Deduction (Extra Cutting &amp; Scrap):</span>
                <span className="jw-stmt-row-val" style={{ color: '#dc2626' }}>₹{stmtDeductions.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="jw-stmt-row">
                <span className="jw-stmt-row-label">Total Paid:</span>
                <span className="jw-stmt-row-val" style={{ color: '#16a34a' }}>₹{stmtTotalPaid.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="jw-stmt-closing-row">
                <span>Closing Balance:</span>
                <span style={{ color: stmtClosingFinBal > 0 ? '#15803d' : '#dc2626' }}>
                  ₹{stmtClosingFinBal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>


          {/* Statement Detailed Table (Matching Outward & Inward rows from Excel Statement) */}
          <div className="jw-table-container" style={{ marginTop: '16px' }}>
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th colSpan={7} style={{ background: '#1e293b', color: '#fff', textAlign: 'center' }}>OUTWARD CONSIGNMENTS (DISPATCH)</th>
                  <th colSpan={6} style={{ background: '#0f172a', color: '#fb923c', textAlign: 'center' }}>INWARD RECEIPTS (RETURN)</th>
                </tr>
                <tr>
                  <th>CHL NO.</th>
                  <th>DATE</th>
                  <th>ITEM NAME</th>
                  <th>PROCESS</th>
                  <th>N. WGHT (KG)</th>
                  <th>B.LOSS</th>
                  <th>BORA</th>
                  <th>SLIP NO.</th>
                  <th>DATE</th>
                  <th>INW ITEM</th>
                  <th>N. WGHT (KG)</th>
                  <th>RATE (₹)</th>
                  <th>VALUE (₹)</th>
                </tr>
              </thead>
              <tbody>
                {statementOrders.map((ord, i) => (
                  <tr key={i}>
                    <td className="td-jw-num">{ord.challan}</td>
                    <td className="td-date">{ord.date}</td>
                    <td className="td-party">{ord.material}</td>
                    <td className="td-material-col" style={{ fontSize: '0.74rem' }}>{ord.process}</td>
                    <td className="td-qty" style={{ fontWeight: 'bold' }}>{ord.inputQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                    <td className="td-wastage">{ord.bLossPct}%</td>
                    <td className="td-qty">{ord.boraCount || '—'}</td>

                    {/* Inward Details */}
                    <td className="td-jw-num" style={{ color: '#ea580c' }}>{ord.inwardReceipts?.[0]?.slipNo || `SLIP-${ord.challan}`}</td>
                    <td className="td-date">{ord.inwardReceipts?.[0]?.date || ord.expectedReturn || ord.date}</td>
                    <td className="td-party">ANCHOR YARN ^ YARN HANK</td>
                    <td className="td-qty" style={{ color: '#16a34a', fontWeight: 'bold' }}>{ord.receivedQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</td>
                    <td className="td-qty">₹{ord.ratePerKg}</td>
                    <td className="td-charges">₹{(ord.receivedQty * ord.ratePerKg).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: Material at Outside Processors ── */}
      {activeTab === 'material' && (
        <div className="jw-material-tab-container">
          <div className="jw-ledger-section">
            <div className="jw-ledger-header">
              <div className="jw-ledger-title-group">
                <div className="jw-ledger-title-row">
                  <h2 className="jw-ledger-title">Material at Job Work (Outside Factory)</h2>
                  <span className="jw-badge-orange">{allJobWorkData.filter(j => j.status !== 'FULLY RECEIVED').length} Active Consignments</span>
                </div>
                <p className="jw-ledger-subtitle">
                  Real-time audit of all company-owned raw materials currently lying at outside processing vendor facilities.
                </p>
              </div>

              <button className="jw-btn-dark-pill" onClick={handleOpenModal}>
                <Plus size={14} /> Issue New Job Work
              </button>
            </div>

            {/* Vendor Grouped Cards & Tables */}
            <div className="jw-vendor-groups">
              {computedVendorGroups.map((vg, idx) => (
                <div key={idx} className="jw-vendor-card">
                  <div className="jw-vcard-header">
                    <div className="jw-vcard-left">
                      <div className="jw-vcard-title-row">
                        <span className="jw-vcard-icon">🏢</span>
                        <h3 className="jw-vcard-name">{vg.vendor}</h3>
                        <span className="jw-vcard-gst">GST: {vg.gst}</span>
                      </div>
                      <p className="jw-vcard-sub">{vg.address} • Contact: {vg.contact}</p>
                    </div>
                    <div className="jw-vcard-right">
                      <div className="jw-vcard-balance">
                        <span className="balance-label">BALANCE WEIGHT</span>
                        <span className="balance-val">{vg.totalQty} <span className="balance-sub">({vg.totalVal})</span></span>
                      </div>
                      <button className="jw-btn-reminder">
                        <Bell size={13} /> Send Reminder
                      </button>
                    </div>
                  </div>

                  <div className="jw-table-container">
                    <table className="jw-ledger-table">
                      <thead>
                        <tr>
                          <th>JW Number</th>
                          <th>Challan Date</th>
                          <th>Material &amp; Batch</th>
                          <th className="th-right">Sent Qty</th>
                          <th className="th-right">Received Qty</th>
                          <th className="th-right">Pending Qty</th>
                          <th>Expected Return</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vg.orders.map((ord, oi) => (
                          <tr key={oi}>
                            <td className="td-jw-num">
                              <span className="jw-id-link">{ord.id}</span>
                            </td>
                            <td className="td-date">{ord.challanDate}</td>
                            <td className="td-material-col">
                              <div className="jw-mat-name">{ord.material}</div>
                              <div className="jw-mat-sub">{ord.process} • <span className="jw-batch-text">Batch: {ord.batch}</span></div>
                            </td>
                            <td className="td-qty td-qty-right">{ord.sentQty}</td>
                            <td className="td-qty td-qty-right">{ord.recdQty}</td>
                            <td className="td-qty td-qty-right">
                              <span className="pending-orange-bold">{ord.pendingQty}</span>
                            </td>
                            <td className="td-exp-date">{ord.expReturn}</td>
                            <td className="td-status">{getStatusBadge(ord.status)}</td>
                            <td className="td-actions">
                              <div className="jw-action-group">
                                <button
                                  className="jw-receive-btn"
                                  title="Record Inward Slip"
                                  onClick={() => {
                                    const match = allJobWorkData.find(x => x.id === ord.id);
                                    setReceivingRow(match || ord);
                                  }}
                                >
                                  Inward
                                </button>
                                <button
                                  className="jw-icon-action"
                                  title="View Job Work Details"
                                  onClick={() => setSelectedJwId(ord.id)}
                                >
                                  <ChevronRight size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: Vendor Wastage & Yield Analysis ── */}
      {activeTab === 'wastage' && (
        <div className="jw-wastage-tab-container">
          <div className="jw-ledger-section">
            <div className="jw-ledger-header">
              <div className="jw-ledger-title-group">
                <div className="jw-ledger-title-row">
                  <h2 className="jw-ledger-title">Executive Manufacturing &amp; Yield Analytics</h2>
                  <span className="jw-badge-blue">Live BI Engine</span>
                </div>
                <p className="jw-ledger-subtitle">
                  Vendor yield benchmarking, polymer wastage tracking, inventory balance valuation, and dispatch velocity.
                </p>
              </div>

              <div className="jw-ledger-actions">
                <button className="jw-btn-dark" onClick={() => exportToCsv('Vendor_Executive_Report.csv', computedVendorPerformance)} style={{ cursor: 'pointer' }}>
                  <Download size={14} />
                  Export Executive Report
                </button>
              </div>
            </div>

            {/* Performance Section Table */}
            <div className="jw-section-block">
              <div className="jw-sblock-header">
                <h3 className="jw-sblock-title">
                  <ShieldCheck size={16} className="jw-text-orange" />
                  Job Work Vendor Wastage &amp; Processing Performance
                </h3>
                <p className="jw-sblock-sub">Audits actual scrap/wastage % against contracted allowable threshold for every processing unit.</p>
              </div>

              <div className="jw-table-container">
                <table className="jw-ledger-table">
                  <thead>
                    <tr>
                      <th>VENDOR NAME &amp; CITY</th>
                      <th>SPECIALIZATION</th>
                      <th className="th-right">TOTAL SENT (KG)</th>
                      <th className="th-right">RECEIVED (KG)</th>
                      <th className="th-right">ACTUAL WASTAGE (KG)</th>
                      <th className="th-right">ALLOWED %</th>
                      <th className="th-right">ACTUAL %</th>
                      <th>PERFORMANCE</th>
                      <th className="th-right">TOTAL CHARGES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedVendorPerformance.map((vp, vpi) => (
                      <tr key={vpi}>
                        <td className="td-party">
                          <div>{vp.vendor}</div>
                          <span className="jw-challan-sub">{vp.city}</span>
                        </td>
                        <td className="td-material-col">{vp.spec}</td>
                        <td className="td-qty td-qty-right">{vp.sent}</td>
                        <td className="td-qty td-qty-right">{vp.recd}</td>
                        <td className="td-wastage td-qty-right jw-text-red">{vp.actualWastageKg}</td>
                        <td className="td-qty td-qty-right">{vp.allowedWastagePct}</td>
                        <td className="td-qty td-qty-right">
                          <span className="badge-green-sm">{vp.actualWastagePct}</span>
                        </td>
                        <td className="td-status">
                          <span className="jw-status-pill pill-completed">✓ {vp.rating}</span>
                        </td>
                        <td className="td-charges td-qty-right">{vp.charges}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: Extra Cutting / Deductions Register (Module 11) ── */}
      {activeTab === 'extraCutting' && (
        <div className="jw-ledger-section">
          <div className="jw-ledger-header">
            <div className="jw-ledger-title-group">
              <div className="jw-ledger-title-row">
                <h2 className="jw-ledger-title">Extra Cutting &amp; Wastage Deductions Register</h2>
                <span className="jw-badge-orange">{filteredExtraCuttings.length} Deductions</span>
              </div>
              <p className="jw-ledger-subtitle">
                Track piece-rate weight deductions, batch trimming waste, and processing adjustments (Sheet: Extra Cutting).
              </p>
            </div>

            <div className="jw-ledger-actions">
              <button className="jw-btn-ghost" onClick={() => exportToCsv('Extra_Cutting_Register.csv', filteredExtraCuttings)} style={{ cursor: 'pointer' }}>
                <Download size={14} /> Export CSV
              </button>

              <button className="jw-btn-dark-pill" onClick={() => setShowExtraCuttingModal(true)}>
                <Plus size={14} /> Record Extra Cutting
              </button>
            </div>
          </div>

          {/* Filter & Metric Bar */}
          <div className="jw-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div className="jw-search-input-wrap" style={{ flex: 1, minWidth: '240px' }}>
              <Search size={14} className="jw-search-icon" />
              <input
                type="text"
                placeholder="Search by party name, deduction reason, remarks..."
                className="jw-filter-search"
                value={extraCuttingSearch}
                onChange={e => setExtraCuttingSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: '700', color: '#b91c1c' }}>
                Total Deduction: ₹{totalExtraCuttingVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: '700', color: '#334155' }}>
                Total Weight: {totalExtraCuttingKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG
              </div>
            </div>
          </div>

          <div className="jw-table-container" style={{ marginTop: '12px' }}>
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>PARTY NAME</th>
                  <th>DEDUCTION DETAILS</th>
                  <th className="th-right">WEIGHT</th>
                  <th className="th-right">RATE</th>
                  <th className="th-right">TOTAL</th>
                  <th>REMARKS</th>
                  <th style={{ textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredExtraCuttings.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                      No Extra Cutting deductions logged. Click <strong>"+ Record Extra Cutting"</strong> above to register one.
                    </td>
                  </tr>
                ) : (
                  filteredExtraCuttings.map((ec, idx) => {
                    const weightVal = Number(ec.weightKg !== undefined && ec.weightKg !== null ? ec.weightKg : (ec.weight !== undefined ? ec.weight : 0)) || 0;
                    const rateVal = Number(ec.rate || 0) || 0;
                    const totalVal = Number(ec.totalAmount !== undefined && ec.totalAmount !== null ? ec.totalAmount : (ec.total !== undefined ? ec.total : (weightVal * rateVal))) || 0;

                    return (
                    <tr key={ec.id || idx}>
                      <td className="td-date">{ec.date}</td>
                      <td className="td-party" style={{ fontWeight: 'bold' }}>{ec.partyName}</td>
                      <td className="td-material-col">{ec.deductionDetails}</td>
                      <td className="td-qty td-qty-right" style={{ color: '#dc2626', fontWeight: 'bold' }}>
                        {weightVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG
                      </td>
                      <td className="td-qty td-qty-right">₹{rateVal.toFixed(2)}</td>
                      <td className="td-charges td-qty-right" style={{ color: '#b91c1c', fontWeight: 'bold' }}>
                        ₹{totalVal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="td-material-col" style={{ fontSize: '0.75rem', color: '#64748b' }}>{ec.remarks || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={async () => {
                            if (window.confirm(`Delete deduction record for ${ec.partyName}?`)) {
                              await deleteExtraCutting(ec.id);
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Internal Issue Modal ── */}
      {showIssueModal && (
        <NewJobWorkModal onClose={() => setShowIssueModal(false)} />
      )}

      {/* ── Receive Material Dialog (GRN / Inward Modal) ── */}
      {receivingRow && (
        <ReceiveJobWorkModal
          row={receivingRow}
          onClose={() => setReceivingRow(null)}
          onSave={handleSaveReceiveModal}
        />
      )}

      {/* ── Extra Cutting Modal ── */}
      {showExtraCuttingModal && (
        <ExtraCuttingModal
          prefillVendor={currentStatementParty !== 'All Parties' ? currentStatementParty : ''}
          onClose={() => setShowExtraCuttingModal(false)}
        />
      )}
    </div>
  );
}

