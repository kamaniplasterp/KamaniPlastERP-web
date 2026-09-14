import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, Search, Download, ArrowUpDown, Printer, ChevronRight,
  Package, Users, Briefcase, DollarSign, Percent, Filter, X,
  Clock, ShieldCheck, CheckCircle2, TrendingUp, BarChart3, Bell,
  FileSpreadsheet, Receipt, Layers, Calendar
} from 'lucide-react';
import NewJobWorkModal from '../modals/NewJobWorkModal';
import ReceiveJobWorkModal from '../modals/ReceiveJobWorkModal';
import JobWorkDetailView from '../views/JobWorkDetailView';
import { useWorkflow } from '../context/WorkflowContext';
import { exportToCsv } from '../utils/exportCsv';
import { printJobWorkChallan } from '../utils/printDocument';
import { subscribeJobWorks, receiveJobWork, createJobWork } from '../api/jobwork.api';
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
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [receivingRow, setReceivingRow] = useState(null);
  
  // Statement tab specific filters
  const [statementParty, setStatementParty] = useState('');
  const [statementStartDate, setStatementStartDate] = useState('2025-03-01');
  const [statementEndDate, setStatementEndDate] = useState('2025-04-30');

  const [liveJobWorks, setLiveJobWorks] = useState([]);
  const [liveVendors, setLiveVendors] = useState([]);

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
    return () => {
      unsubJw();
      unsubVe();
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
    const inputQty = jw.sentQtyKg !== undefined
      ? Number(jw.sentQtyKg)
      : (jw.sentQty ? Number(String(jw.sentQty).replace(/[^0-9.]/g, '')) : 1000) || 1000;
    
    const grossWeight = Number(jw.grossWeight || inputQty);
    const boraCount = Number(jw.boraCount || 0);
    const articleWeight = Number(jw.articleWeight || 0);
    const bLossPct = Number(jw.bLossPct !== undefined ? jw.bLossPct : (parseFloat(String(jw.wastage || 0).replace(/[^0-9.]/g, '')) || 0));
    const bLossKg = Number(jw.bLossKg !== undefined ? jw.bLossKg : (inputQty * (bLossPct / 100)));
    const netOutwardKg = Number(jw.netOutwardKg !== undefined ? jw.netOutwardKg : Math.max(0, inputQty - bLossKg));

    const receivedQty = jw.recQtyKg !== undefined
      ? Number(jw.recQtyKg)
      : (jw.recQty ? Number(String(jw.recQty).replace(/[^0-9.]/g, '')) : 0);
    
    const pendingQty = (jw.pendingQty !== undefined && jw.pendingQty !== null)
      ? Number(jw.pendingQty)
      : (jw.balQtyKg !== undefined && jw.balQtyKg !== null
        ? Number(jw.balQtyKg)
        : (jw.balQty ? Number(String(jw.balQty).replace(/[^0-9.]/g, '')) : Math.max(0, netOutwardKg - receivedQty - (Number(jw.scrapQtyKg) || 0))));
    
    const scrapKg = jw.scrapQtyKg !== undefined
      ? Number(jw.scrapQtyKg)
      : Math.max(0, netOutwardKg - receivedQty - pendingQty);
    
    const wastage = scrapKg > 0 ? `${scrapKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG` : (bLossPct > 0 ? `${bLossPct}%` : '-');

    const vendorMatch = liveVendors.find(v => v.id === jw.vendorId || v.name === jw.vendor);
    const vendorDefaultRate = vendorMatch && vendorMatch.rate ? Number(vendorMatch.rate) : 17.5;

    let ratePerKg = 0;
    if (typeof jw.ratePerKg === 'number' && jw.ratePerKg > 0) {
      ratePerKg = jw.ratePerKg;
    } else if (typeof jw.processingRate === 'number' && jw.processingRate > 0) {
      ratePerKg = jw.processingRate;
    } else if (typeof jw.charges === 'number' && jw.charges > 0) {
      ratePerKg = jw.charges < 100 ? jw.charges : Math.round(jw.charges / (inputQty || 1));
    } else {
      ratePerKg = vendorDefaultRate;
    }

    const totalCharges = typeof jw.totalCharges === 'number' && jw.totalCharges > 0
      ? jw.totalCharges
      : Math.round(inputQty * ratePerKg);

    return {
      id: jw.jwNo || jw.id,
      firestoreId: jw.id,
      rawMaterialId: jw.rawMaterialId,
      challan: jw.chNo || `${jw.jwNo || jw.id}`,
      subChalNo: jw.subChalNo || '1',
      workOrder: jw.workOrder || 'WO-1001',
      department: jw.department || 'Job Work Extrusion',
      date: jw.date || '2025-03-01',
      party: jw.vendor || 'Job Worker',
      material: jw.rawMat || 'GRANUALS-HDPE ^ HD',
      grade: jw.grade || '',
      process: jw.process || 'GRANUAL - FISHING YARN',
      batch: jw.batch || 'BATCH-RM-JW',
      vehicleNo: jw.vehicleNo || '',
      issuedBy: jw.issuedBy || 'SURESHBHAI',
      approvedBy: jw.approvedBy || 'FINAL APPROVED',
      grossWeight,
      boraCount,
      articleWeight,
      articleType: jw.articleType || 'BORA',
      inputQty,
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
      durationDays: jw.durationDays || 5,
      inwardReceipts: jw.inwardReceipts || [],
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
  const statementOrders = allJobWorkData.filter(j => 
    (j.party || '').toLowerCase() === currentStatementParty.toLowerCase()
  );

  const stmtOutwardNetSum = statementOrders.reduce((s, o) => s + (Number(o.inputQty) || 0), 0);
  const stmtBLossSum = statementOrders.reduce((s, o) => s + (Number(o.bLossKg) || 0), 0);
  const stmtOutwardAfterLoss = Math.max(0, stmtOutwardNetSum - stmtBLossSum);
  const stmtInwardSum = statementOrders.reduce((s, o) => s + (Number(o.receivedQty) || 0), 0);
  const stmtClosingWeightBal = Math.max(0, stmtOutwardAfterLoss - stmtInwardSum);

  const stmtBoraOutward = statementOrders.reduce((s, o) => s + (Number(o.boraCount) || 0), 0);
  const stmtBoraInward = statementOrders.reduce((s, o) => s + (Number(o.recBoraCount) || 0), 0);
  const stmtBoraClosing = Math.max(0, stmtBoraOutward - stmtBoraInward);

  const stmtTotalPayable = statementOrders.reduce((s, o) => s + (Number(o.charges) || (Number(o.receivedQty) * (Number(o.ratePerKg) || 17.5))), 0);
  const stmtDeductions = statementOrders.reduce((s, o) => s + (Number(o.rejectionQtyKg) * 100), 0);
  const stmtTotalPaid = Math.round(stmtTotalPayable * 0.85); // Demo paid amount
  const stmtClosingFinBal = stmtTotalPayable - stmtDeductions - stmtTotalPaid;

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
            <h1 className="jw-page-title">Job Work Operations &amp; Reconciliation Hub</h1>
            <span className="jw-badge-orange">{activeJobWorksCount} Active Consignments</span>
          </div>
          <p className="jw-page-subtitle">
            Rule 55 CGST Outward Challans, Inward Delivery Slips, Tare &amp; B.Loss calculations, and Job Worker Balance Statements.
          </p>
        </div>
        <div className="jw-header-right">
          <button className="jw-btn-primary-blue" onClick={handleOpenModal}>
            <Plus size={15} />
            New Outward Challan (Rule 55)
          </button>
        </div>
      </div>

      {/* ── Top 4 KPI Cards Grid ── */}
      <div className="jw-top-kpis">
        <div className="jw-kpi-card">
          <div className="jw-kpi-title">ACTIVE JOB WORKS</div>
          <div className="jw-kpi-val-row">
            <span className="jw-kpi-num">{activeJobWorksCount}</span>
            <span className="jw-kpi-sublabel">consignments</span>
          </div>
        </div>

        <div className="jw-kpi-card jw-kpi-highlight">
          <div className="jw-kpi-title jw-title-orange">MATERIAL WITH VENDORS</div>
          <div className="jw-kpi-val-row">
            <span className="jw-kpi-num jw-text-orange">{Math.max(0, totalPendingKg).toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
            <span className="jw-kpi-sublabel">KG</span>
          </div>
        </div>

        <div className="jw-kpi-card">
          <div className="jw-kpi-title">VALUE WITH PROCESSORS</div>
          <div className="jw-kpi-val-row">
            <span className="jw-kpi-num">₹{totalValueWithProcessorsLakhs}L</span>
          </div>
        </div>

        <div className="jw-kpi-card">
          <div className="jw-kpi-title">AVG WASTAGE YIELD</div>
          <div className="jw-kpi-val-row">
            <span className="jw-kpi-num">{avgWastagePct}%</span>
            <span className="jw-kpi-sublabel">scrap</span>
          </div>
        </div>
      </div>

      {/* ── Segmented Tab Bar (5 Tabs matching Excel) ── */}
      <div className="jw-tab-bar" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          className={`jw-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <Briefcase size={14} />
          Job Work Orders &amp; Challans
          <span className="jw-tab-badge">{allJobWorkData.length}</span>
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'challanReport' ? 'active' : ''}`}
          onClick={() => setActiveTab('challanReport')}
        >
          <FileSpreadsheet size={14} />
          Challan Balance Report
          <span className="jw-tab-badge-orange">{allJobWorkData.filter(j => j.status !== 'FULLY RECEIVED').length} Open</span>
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'statement' ? 'active' : ''}`}
          onClick={() => setActiveTab('statement')}
        >
          <Receipt size={14} />
          Job Worker Statement &amp; Ledger
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'material' ? 'active' : ''}`}
          onClick={() => setActiveTab('material')}
        >
          <Package size={14} />
          Material at Outside Processors
          <span className="jw-tab-badge-orange">{totalPendingKg.toLocaleString('en-IN', { maximumFractionDigits: 0 })} KG</span>
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'wastage' ? 'active' : ''}`}
          onClick={() => setActiveTab('wastage')}
        >
          <Percent size={14} />
          Vendor Wastage &amp; Yield
        </button>
      </div>

      {/* ── TAB 1: Job Work Ledger (Enhanced with Excel fields) ── */}
      {activeTab === 'orders' && (
        <div className="jw-ledger-section">
          <div className="jw-ledger-header">
            <div className="jw-ledger-title-group">
              <div className="jw-ledger-title-row">
                <h2 className="jw-ledger-title">Job Work Outward / Inward Register</h2>
                <span className="jw-badge-orange">{allJobWorkData.length} Consignments</span>
              </div>
              <p className="jw-ledger-subtitle">
                Track Gross &amp; Net weights, Bora counts, B.Loss % (Burning loss), Inward receipts, and issued personnel.
              </p>
            </div>

            <div className="jw-ledger-actions">
              <button className="jw-btn-ghost" onClick={() => exportToCsv('Job_Work_Register.csv', filteredData)} style={{ cursor: 'pointer' }}>
                <Download size={14} />
                Export CSV
              </button>
              <button className="jw-btn-dark-pill" onClick={handleOpenModal}>
                <Plus size={14} /> Issue Outward Challan
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="jw-filter-bar">
            <div className="jw-search-input-wrap">
              <Search size={14} className="jw-search-icon" />
              <input
                type="text"
                placeholder="Search Challan#, Party, Material, Process, Issued By..."
                className="jw-filter-search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

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

          {/* Enhanced Table with Excel Columns */}
          <div className="jw-table-container">
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th>CHALLAN NO.</th>
                  <th>DATE</th>
                  <th>PARTY NAME</th>
                  <th>ITEM NAME &amp; PROCESS</th>
                  <th>GROSS (KG)</th>
                  <th>BORA</th>
                  <th>NET OUTWARD (KG)</th>
                  <th>B.LOSS</th>
                  <th>INWARD (KG)</th>
                  <th>BAL WEIGHT (KG)</th>
                  <th>ISSUED BY</th>
                  <th>STATUS</th>
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
                    <td className="td-qty">{row.grossWeight ? row.grossWeight.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : '—'}</td>
                    <td className="td-qty">{row.boraCount ? `${row.boraCount} Bora` : '—'}</td>
                    <td className="td-qty" style={{ fontWeight: 'bold' }}>{row.inputQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</td>
                    <td className="td-wastage">{row.bLossPct > 0 ? `${row.bLossPct}% (${row.bLossKg.toFixed(1)}k)` : '0%'}</td>
                    <td className="td-qty">{row.receivedQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</td>
                    <td className="td-qty">
                      {row.pendingQty > 0 ? (
                        <span className="pending-orange-bold">{row.pendingQty.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>0 KG</span>
                      )}
                    </td>
                    <td className="td-date" style={{ fontSize: '0.72rem', color: '#475569' }}>{row.issuedBy}</td>
                    <td className="td-status">{getStatusBadge(row.status)}</td>
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
                        <button
                          className="jw-icon-action"
                          title="Print Rule 55 Delivery Challan"
                          onClick={() => printJobWorkChallan(row)}
                        >
                          <Printer size={14} />
                        </button>
                        <button
                          className="jw-icon-action"
                          title="View Job Work Details"
                          onClick={() => setSelectedJwId(row.id)}
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
      )}

      {/* ── TAB 2: Challan Balance Report (Matching Excel 'Pending Challan' & 'Challan Wise Co.') ── */}
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

          {/* Challan Balance Summary Grid */}
          <div className="jw-ledger-kpi-grid">
            <div className="jw-lkpi-card">
              <div className="jw-lkpi-title">TOTAL SUM NET WEIGHT</div>
              <div className="jw-lkpi-val-row">
                <span className="jw-lkpi-val">{totalSentKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-lkpi-unit">KG</span>
              </div>
              <div className="jw-lkpi-sub">Total dispatched across challans</div>
            </div>

            <div className="jw-lkpi-card">
              <div className="jw-lkpi-title">TOTAL BURNING LOSS (B.LOSS)</div>
              <div className="jw-lkpi-val-row">
                <span className="jw-lkpi-val">{allJobWorkData.reduce((s, c) => s + (Number(c.bLossKg) || 0), 0).toFixed(1)}</span>
                <span className="jw-lkpi-unit">KG</span>
              </div>
              <div className="jw-lkpi-sub">Process loss deduction</div>
            </div>

            <div className="jw-lkpi-card">
              <div className="jw-lkpi-title">TOTAL INWARD WEIGHT</div>
              <div className="jw-lkpi-val-row">
                <span className="jw-lkpi-val jw-text-green">{totalReceivedKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-lkpi-unit">KG</span>
              </div>
              <div className="jw-lkpi-sub">{returnRatePct}% Inward yield</div>
            </div>

            <div className="jw-lkpi-card jw-lkpi-highlight">
              <div className="jw-lkpi-title jw-title-orange">OUTSTANDING BALANCE WEIGHT</div>
              <div className="jw-lkpi-val-row">
                <span className="jw-lkpi-val jw-text-orange">{totalPendingKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
                <span className="jw-lkpi-unit">KG</span>
              </div>
              <div className="jw-lkpi-sub">Pending with processors</div>
            </div>
          </div>

          {/* Challan Wise Table */}
          <div className="jw-table-container" style={{ marginTop: '14px' }}>
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>CHAL. NO.</th>
                  <th>PARTY NAME</th>
                  <th>B.LOSS %</th>
                  <th>SUM N. WGHT (KG)</th>
                  <th>SUM B. LOSS (KG)</th>
                  <th>NET OUTWARD (KG)</th>
                  <th>INWARD WEIGHT (KG)</th>
                  <th>BALANCE WEIGHT (KG)</th>
                  <th>STATUS</th>
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

          {/* Statement 3-Category Summary Block (Weight, Bora, Financial) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginTop: '14px' }}>
            {/* 1. Weight Reconciliation */}
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#0369a1', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                ⚖️ Material Weight Reconciliation
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e0f2fe', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Opening Balance:</span>
                <span style={{ fontWeight: 'bold' }}>0.0 KG</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e0f2fe', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Outward Sent:</span>
                <span style={{ fontWeight: 'bold' }}>{stmtOutwardNetSum.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e0f2fe', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Outward (-) B.Loss:</span>
                <span style={{ fontWeight: 'bold', color: '#0284c7' }}>{stmtOutwardAfterLoss.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e0f2fe', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Inward Received:</span>
                <span style={{ fontWeight: 'bold', color: '#16a34a' }}>{stmtInwardSum.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0 0', marginTop: '4px', fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>
                <span>Closing Balance:</span>
                <span style={{ color: '#ea580c' }}>{stmtClosingWeightBal.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG</span>
              </div>
            </div>

            {/* 2. Packaging & Bora Reconciliation */}
            <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#a16207', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📦 Packaging &amp; Bora Reconciliation
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #fef9c3', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Bora Opening Balance:</span>
                <span style={{ fontWeight: 'bold' }}>0 Bora</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #fef9c3', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Bora Outward Sent:</span>
                <span style={{ fontWeight: 'bold' }}>{stmtBoraOutward} Bora</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #fef9c3', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Bora Inward Received:</span>
                <span style={{ fontWeight: 'bold', color: '#16a34a' }}>{stmtBoraInward} Bora</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #fef9c3', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Theli &amp; Label Balance:</span>
                <span style={{ fontWeight: 'bold' }}>0 Nos</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0 0', marginTop: '4px', fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>
                <span>Bora Closing Balance:</span>
                <span style={{ color: '#ca8a04' }}>{stmtBoraClosing} Bora</span>
              </div>
            </div>

            {/* 3. Financial Ledger Reconciliation */}
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#15803d', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                💳 Financial &amp; Payment Ledger
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #dcfce7', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Total Processing Payable:</span>
                <span style={{ fontWeight: 'bold' }}>₹{stmtTotalPayable.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #dcfce7', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Deductions / Extra Cutting:</span>
                <span style={{ fontWeight: 'bold', color: '#dc2626' }}>₹{stmtDeductions.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #dcfce7', fontSize: '0.78rem' }}>
                <span style={{ color: '#475569' }}>Total Paid to Worker:</span>
                <span style={{ fontWeight: 'bold', color: '#16a34a' }}>₹{stmtTotalPaid.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0 0', marginTop: '12px', fontSize: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>
                <span>Net Outstanding Balance:</span>
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
                        <span className="balance-label">TOTAL PARTY BALANCE</span>
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
                          <th>Sent Qty</th>
                          <th>Received Qty</th>
                          <th>Pending Qty</th>
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
                            <td className="td-qty">{ord.sentQty}</td>
                            <td className="td-qty">{ord.recdQty}</td>
                            <td className="td-qty">
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
                      <th>TOTAL SENT (KG)</th>
                      <th>RECEIVED (KG)</th>
                      <th>ACTUAL WASTAGE (KG)</th>
                      <th>ALLOWED WASTAGE %</th>
                      <th>ACTUAL WASTAGE %</th>
                      <th>PERFORMANCE RATING</th>
                      <th>TOTAL JOB CHARGES</th>
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
                        <td className="td-qty">{vp.sent}</td>
                        <td className="td-qty">{vp.recd}</td>
                        <td className="td-wastage jw-text-red">{vp.actualWastageKg}</td>
                        <td className="td-qty">{vp.allowedWastagePct}</td>
                        <td className="td-qty">
                          <span className="badge-green-sm">{vp.actualWastagePct}</span>
                        </td>
                        <td className="td-status">
                          <span className="jw-status-pill pill-completed">✓ {vp.rating}</span>
                        </td>
                        <td className="td-charges">{vp.charges}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
    </div>
  );
}
