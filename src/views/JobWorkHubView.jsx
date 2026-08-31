import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Plus, Search, Download, ArrowUpDown, Printer, ChevronRight,
  Package, Users, Briefcase, DollarSign, Percent, Filter, X,
  Clock, ShieldCheck, CheckCircle2, TrendingUp, BarChart3, Bell
} from 'lucide-react';
import NewJobWorkModal from '../modals/NewJobWorkModal';
import ReceiveJobWorkModal from '../modals/ReceiveJobWorkModal';
import JobWorkDetailView from '../views/JobWorkDetailView';
import { useWorkflow } from '../context/WorkflowContext';
import { exportToCsv } from '../utils/exportCsv';
import { printJobWorkChallan } from '../utils/printDocument';
import { subscribeJobWorks, receiveJobWork, createJobWork } from '../api/jobwork.api';
import { subscribeVendors } from '../api/directory.api';
import { seedInitialData } from '../api/seed';
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
  const [receiveQtyInput, setReceiveQtyInput] = useState('');
  const [scrapQtyInput, setScrapQtyInput] = useState('');
  const [liveJobWorks, setLiveJobWorks] = useState([]);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
    if (location.state?.selectedJwId) {
      setSelectedJwId(location.state.selectedJwId);
    }
  }, [location.state]);

  useEffect(() => {
    const unsub = subscribeJobWorks(setLiveJobWorks);
    return () => unsub();
  }, []);

  const handleSaveReceiveModal = async (grnData) => {
    if (!receivingRow) return;

    const recKg = Number(grnData.receivedQty || grnData.acceptedQty || 0);
    const scrapKg = Number(grnData.scrapQty || 0);

    try {
      await receiveJobWork({
        jwId: receivingRow.firestoreId || receivingRow.id,
        currentRecKg: receivingRow.receivedQty || 0,
        currentScrapKg: receivingRow.scrapQtyKg || 0,
        totalSentKg: receivingRow.inputQty || 1000,
        recQtyKg: recKg,
        scrapQtyKg: scrapKg,
        rawMaterialId: receivingRow.rawMaterialId,
        itemLabel: receivingRow.material,
        remarks: grnData.notes || `GRN Receipt of ${recKg} KG (${grnData.qualityStatus || 'Approved'})`
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

  const allJobWorkData = liveJobWorks.map(jw => {
    const inputQty = jw.sentQtyKg !== undefined
      ? Number(jw.sentQtyKg)
      : (jw.sentQty ? Number(String(jw.sentQty).replace(/[^0-9.]/g, '')) : 1000) || 1000;
    const receivedQty = jw.recQtyKg !== undefined
      ? Number(jw.recQtyKg)
      : (jw.recQty ? Number(String(jw.recQty).replace(/[^0-9.]/g, '')) : 0);
    const pendingQty = jw.balQtyKg !== undefined
      ? Number(jw.balQtyKg)
      : (jw.balQty ? Number(String(jw.balQty).replace(/[^0-9.]/g, '')) : Math.max(0, inputQty - receivedQty - (Number(jw.scrapQtyKg) || 0)));
    const scrapKg = jw.scrapQtyKg !== undefined
      ? Number(jw.scrapQtyKg)
      : Math.max(0, inputQty - receivedQty - pendingQty);
    const wastage = scrapKg > 0 ? `${scrapKg.toLocaleString('en-IN')} KG` : (jw.wastage && jw.wastage !== '-' ? jw.wastage : '-');

    // Calculate processing rate per KG and total payable charges dynamically
    const ratePerKg = Number(jw.ratePerKg || jw.processingRate || (typeof jw.charges === 'number' && jw.charges < 100 ? jw.charges : 8.5)) || 8.5;
    const totalCharges = typeof jw.totalCharges === 'number' ? jw.totalCharges : Math.round(inputQty * ratePerKg);

    return {
      id: jw.jwNo || jw.id,
      firestoreId: jw.id,
      rawMaterialId: jw.rawMaterialId,
      challan: jw.chNo || `CH-${jw.jwNo || jw.id}`,
      date: jw.date || '2026-08-25',
      party: jw.vendor || 'Job Worker',
      material: jw.rawMat || 'PP Granules',
      process: jw.process || 'Extrusion / Yarn Making',
      batch: jw.batch || 'BATCH-RM-JW',
      inputQty,
      receivedQty,
      pendingQty,
      scrapQtyKg: scrapKg,
      wastage,
      ratePerKg,
      charges: totalCharges,
      expectedReturn: jw.expectedReturn || '2026-08-30',
      status: jw.status === 'PARTIAL' ? 'PARTIALLY RECEIVED' : jw.status === 'COMPLETED' ? 'FULLY RECEIVED' : jw.status || 'SENT'
    };
  });

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

  const { activeJobWorksCount, jobWorkStock, globalSearch, rmList, fgList, simulatedSalesOrders, simulatedDispatches } = useWorkflow();
  const activeSearch = searchQuery || globalSearch || '';

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

  const filteredData = allJobWorkData.filter(item => {
    const matchesSearch =
      item.id.toLowerCase().includes(activeSearch.toLowerCase()) ||
      item.challan.toLowerCase().includes(activeSearch.toLowerCase()) ||
      item.party.toLowerCase().includes(activeSearch.toLowerCase()) ||
      item.material.toLowerCase().includes(activeSearch.toLowerCase());

    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    const matchesParty = partyFilter === 'All' || item.party === partyFilter;
    const matchesMaterial = materialFilter === 'All' || item.material === materialFilter;

    return matchesSearch && matchesStatus && matchesParty && matchesMaterial;
  });

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
        challanDate: order.date,
        material: order.material,
        process: order.process || 'Extrusion / Yarn Making',
        batch: order.batch || 'WIP-LOT',
        sentQty: typeof order.inputQty === 'number' ? `${order.inputQty.toLocaleString()} KG` : order.inputQty,
        recdQty: typeof order.receivedQty === 'number' ? `${order.receivedQty.toLocaleString()} KG` : order.receivedQty,
        pendingQty: typeof order.pendingQty === 'number' ? `${order.pendingQty.toLocaleString()} KG` : order.pendingQty,
        expReturn: order.expectedReturn,
        status: order.status
      });
      acc[vName].pendingKgSum += Number(order.pendingQty) || 0;
      acc[vName].totalQty = `${acc[vName].pendingKgSum.toLocaleString()} KG`;
      acc[vName].totalVal = `₹${(acc[vName].pendingKgSum * 18).toLocaleString()}`;
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
      sent: v.sentKg.toLocaleString(),
      recd: v.recdKg.toLocaleString(),
      actualWastageKg: actualWastageKg.toLocaleString(),
      allowedWastagePct: `${allowedPct.toFixed(1)}%`,
      actualWastagePct: `${wastagePctNum.toFixed(2)}%`,
      rating,
      isWithin,
      charges: `₹${v.chargesSum.toLocaleString()}`
    };
  });

  const fgProductionData = (fgList && fgList.length > 0)
    ? fgList.map(fg => ({
        name: fg.name || 'PP Danline Rope 6mm',
        count: `${fg.stockQty} Coils`,
        pct: Math.min(100, Math.max(25, (Number(fg.stockQty) / 500) * 100))
      }))
    : [
        { name: 'PP Danline Rope 6mm (Yellow)', count: '200 Coils', pct: 40 }
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
            <h1 className="jw-page-title">Job Work Operations Hub</h1>
            <span className="jw-badge-orange">{activeJobWorksCount} Active Orders</span>
          </div>
          <p className="jw-page-subtitle">
            Manage outward material challans, monitor stock at outside processors, and track vendor wastage yield in one place.
          </p>
        </div>
        <div className="jw-header-right">
          <button className="jw-btn-primary-blue" onClick={handleOpenModal}>
            <Plus size={15} />
            New Outward Challan
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
            <span className="jw-kpi-num jw-text-orange">{Math.max(0, totalPendingKg).toLocaleString()}</span>
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

      {/* ── Segmented Tab Bar ── */}
      <div className="jw-tab-bar">
        <button
          className={`jw-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <Briefcase size={14} />
          Job Work Orders &amp; Challans
          <span className="jw-tab-badge">{allJobWorkData.length}</span>
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'material' ? 'active' : ''}`}
          onClick={() => setActiveTab('material')}
        >
          <Package size={14} />
          Material at Outside Processors
          <span className="jw-tab-badge-orange">{totalPendingKg.toLocaleString()} KG</span>
        </button>

        <button
          className={`jw-tab-btn ${activeTab === 'wastage' ? 'active' : ''}`}
          onClick={() => setActiveTab('wastage')}
        >
          <Percent size={14} />
          Vendor Wastage &amp; Yield Analysis
        </button>
      </div>

      {/* ── TAB 1: Job Work Ledger ── */}
      {activeTab === 'orders' && (
        <div className="jw-ledger-section">
          <div className="jw-ledger-header">
            <div className="jw-ledger-title-group">
              <div className="jw-ledger-title-row">
                <h2 className="jw-ledger-title">Job Work Ledger</h2>
                <span className="jw-badge-orange">{allJobWorkData.length} Consignments</span>
              </div>
              <p className="jw-ledger-subtitle">
                Track multi-party extrusion, tape spinning, twisting, and rope laying job orders with partial receipts &amp; wastage.
              </p>
            </div>

            <div className="jw-ledger-actions">
              <button className="jw-btn-ghost" onClick={() => exportToCsv('Job_Work_Ledger.csv', filteredData)} style={{ cursor: 'pointer' }}>
                <Download size={14} />
                Export CSV
              </button>
              <button className="jw-btn-dark-pill" onClick={handleOpenModal}>
                <Plus size={14} /> Issue New Job Work
              </button>
            </div>
          </div>

          {/* Ledger 5 KPI Row */}
          <div className="jw-ledger-kpi-grid">
            <div className="jw-lkpi-card">
              <div className="jw-lkpi-title">TOTAL MATERIAL SENT</div>
              <div className="jw-lkpi-val-row">
                <span className="jw-lkpi-val">{totalSentKg.toLocaleString()}</span>
                <span className="jw-lkpi-unit">KG</span>
              </div>
              <div className="jw-lkpi-sub">Across {allJobWorkData.length} job orders</div>
            </div>

            <div className="jw-lkpi-card">
              <div className="jw-lkpi-title">TOTAL RECEIVED BACK</div>
              <div className="jw-lkpi-val-row">
                <span className="jw-lkpi-val">{totalReceivedKg.toLocaleString()}</span>
                <span className="jw-lkpi-unit">KG</span>
              </div>
              <div className="jw-lkpi-sub jw-text-green">{returnRatePct}% Return Rate</div>
            </div>

            <div className="jw-lkpi-card jw-lkpi-highlight">
              <div className="jw-lkpi-title jw-title-orange">TOTAL PENDING OUTSIDE</div>
              <div className="jw-lkpi-val-row">
                <span className="jw-lkpi-val jw-text-orange">{totalPendingKg.toLocaleString()}</span>
                <span className="jw-lkpi-unit">KG</span>
              </div>
              <div className="jw-lkpi-sub">At outside job worker units</div>
            </div>

            <div className="jw-lkpi-card">
              <div className="jw-lkpi-title">PROCESS WASTAGE RECORDED</div>
              <div className="jw-lkpi-val-row">
                <span className="jw-lkpi-val">{totalScrapKg.toLocaleString()}</span>
                <span className="jw-lkpi-unit">KG</span>
              </div>
              <div className="jw-lkpi-sub">Avg {avgWastagePct}% scrap loss</div>
            </div>

            <div className="jw-lkpi-card">
              <div className="jw-lkpi-title">TOTAL JOB WORK CHARGES</div>
              <div className="jw-lkpi-val-row">
                <span className="jw-lkpi-val">₹{totalChargesSum.toLocaleString()}</span>
              </div>
              <div className="jw-lkpi-sub">Processing fees payable</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="jw-filter-bar">
            <div className="jw-search-input-wrap">
              <Search size={14} className="jw-search-icon" />
              <input
                type="text"
                placeholder="Search JW#, Party, Material, Challan..."
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
              <option value="IN PROCESS">IN PROCESS</option>
              <option value="PARTIALLY RECEIVED">PARTIALLY RECEIVED</option>
              <option value="FULLY RECEIVED">FULLY RECEIVED</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>

            <select
              className="jw-filter-select"
              value={partyFilter}
              onChange={e => setPartyFilter(e.target.value)}
            >
              <option value="All">All Job Work Parties</option>
              <option value="Shree Plastic Works">Shree Plastic Works</option>
              <option value="Patel Rope Processing">Patel Rope Processing</option>
              <option value="Krishna Extrusion Works">Krishna Extrusion Works</option>
              <option value="Mahavir Twisters & Winders">Mahavir Twisters &amp; Winders</option>
            </select>

            <select
              className="jw-filter-select"
              value={materialFilter}
              onChange={e => setMaterialFilter(e.target.value)}
            >
              <option value="All">All Raw Materials</option>
              <option value="PP Granules (Raffia Grade)">PP Granules (Raffia Grade)</option>
              <option value="PP Fibrillated Tape (1000 Denier)">PP Fibrillated Tape (1000 Denier)</option>
              <option value="HDPE Granules (Monofilament Grade)">HDPE Granules (Monofilament Grade)</option>
              <option value="HDPE High Tenacity Yarn (380D)">HDPE High Tenacity Yarn (380D)</option>
            </select>
          </div>

          {/* Table */}
          <div className="jw-table-container">
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th>JW NUMBER <ArrowUpDown size={11} className="sort-icon" /></th>
                  <th>DATE <ArrowUpDown size={11} className="sort-icon" /></th>
                  <th>JOB WORK PARTY</th>
                  <th>MATERIAL &amp; PROCESS</th>
                  <th>INPUT QTY <ArrowUpDown size={11} className="sort-icon" /></th>
                  <th>RECEIVED</th>
                  <th>PENDING <ArrowUpDown size={11} className="sort-icon" /></th>
                  <th>WASTAGE</th>
                  <th>CHARGES (₹)</th>
                  <th>EXPECTED RETURN</th>
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
                      <span className="jw-challan-sub">Challan: {row.challan}</span>
                    </td>
                    <td className="td-date">{row.date}</td>
                    <td className="td-party">{row.party}</td>
                    <td className="td-material-col">
                      <div className="jw-mat-name">{row.material}</div>
                      <div className="jw-mat-sub">
                        {row.process} • <span className="jw-batch-text">Batch: {row.batch}</span>
                      </div>
                    </td>
                    <td className="td-qty">{row.inputQty.toLocaleString()} KG</td>
                    <td className="td-qty">{row.receivedQty.toLocaleString()} KG</td>
                    <td className="td-qty">
                      {row.pendingQty > 0 ? (
                        <span className="pending-orange-bold">{row.pendingQty.toLocaleString()} KG</span>
                      ) : (
                        <span>0 KG</span>
                      )}
                    </td>
                    <td className="td-wastage">{row.wastage}</td>
                    <td className="td-charges">₹{row.charges.toLocaleString('en-IN')}</td>
                    <td className="td-exp-date">{row.expectedReturn}</td>
                    <td className="td-status">{getStatusBadge(row.status)}</td>
                    <td className="td-actions" onClick={e => e.stopPropagation()}>
                      <div className="jw-action-group">
                        <button
                          className="jw-receive-btn"
                          title="Record Goods Receipt Note (GRN)"
                          onClick={() => setReceivingRow(row)}
                        >
                          Receive
                        </button>
                        <button
                          className="jw-icon-action"
                          title="View Job Work Details"
                          onClick={() => setSelectedJwId(row.id)}
                        >
                          <ChevronRight size={15} />
                        </button>
                        <button
                          className="jw-icon-action"
                          title="Print Job Work Challan"
                          onClick={() => printJobWorkChallan(row)}
                        >
                          <Printer size={14} />
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

      {/* ── TAB 2: Material at Outside Processors ── */}
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

            {/* 3 Summary KPI Cards */}
            <div className="jw-top-kpis">
              <div className="jw-kpi-card jw-kpi-highlight">
                <div className="jw-kpi-title jw-title-orange">TOTAL MATERIAL OUTSIDE</div>
                <div className="jw-kpi-val-row">
                  <span className="jw-kpi-num jw-text-orange">{totalPendingKg.toLocaleString()}</span>
                  <span className="jw-kpi-sublabel">KG</span>
                </div>
                <div className="jw-lkpi-sub">Across {allJobWorkData.filter(j => j.status !== 'FULLY RECEIVED').length} open job work orders</div>
              </div>

              <div className="jw-kpi-card">
                <div className="jw-kpi-title">TOTAL MATERIAL VALUATION</div>
                <div className="jw-kpi-val-row">
                  <span className="jw-kpi-num">₹{(totalPendingKg * 115).toLocaleString()}</span>
                  <span className="jw-kpi-sublabel">INR</span>
                </div>
                <div className="jw-lkpi-sub">Based on current purchase landed costs</div>
              </div>

              <div className="jw-kpi-card">
                <div className="jw-kpi-title jw-title-red">OVERDUE CONSIGNMENTS</div>
                <div className="jw-kpi-val-row">
                  <span className="jw-kpi-num jw-text-red">{allJobWorkData.filter(j => j.status === 'OVERDUE').length}</span>
                  <span className="jw-kpi-sublabel jw-text-red">Orders Past Deadline</span>
                </div>
                <div className="jw-lkpi-sub jw-text-red">
                  <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} />
                  Requires immediate follow-up
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="jw-filter-bar">
              <div className="jw-search-input-wrap">
                <Search size={14} className="jw-search-icon" />
                <input
                  type="text"
                  placeholder="Filter by Job Worker, Material, JW Number..."
                  className="jw-filter-search"
                />
              </div>

              <select className="jw-filter-select">
                <option value="All">All Job Work Vendors</option>
                <option value="Shree">Shree Plastic Works</option>
                <option value="Patel">Patel Rope Processing</option>
                <option value="Mahavir">Mahavir Twisters &amp; Winders</option>
              </select>
            </div>

            {/* Vendor Grouped Cards & Tables */}
            <div className="jw-vendor-groups">
              {computedVendorGroups.map((vg, idx) => {
                return (
                <div key={idx} className="jw-vendor-card">
                  {/* Vendor Card Header */}
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

                  {/* Vendor Sub Table */}
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
                                  title="Record Goods Receipt Note (GRN)"
                                  onClick={() => {
                                    const match = allJobWorkData.find(x => x.id === ord.id);
                                    setReceivingRow(match || {
                                      id: ord.id,
                                      party: vg.vendor,
                                      material: ord.material,
                                      inputQty: ord.sentQty,
                                      receivedQty: ord.recdQty,
                                      pendingQty: ord.pendingQty
                                    });
                                  }}
                                >
                                  Receive
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
              );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Vendor Wastage & Yield Analysis ── */}
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
                <select className="jw-filter-select">
                  <option>Current Financial Year (FY 2025-26)</option>
                  <option>Previous FY (2024-25)</option>
                </select>
                <button className="jw-btn-dark" onClick={() => exportToCsv('Vendor_Executive_Report.csv', computedVendorPerformance)} style={{ cursor: 'pointer' }}>
                  <Download size={14} />
                  Export Executive Report
                </button>
              </div>
            </div>

            {/* 4 Summary Cards */}
            <div className="jw-top-kpis">
              <div className="jw-kpi-card">
                <div className="jw-kpi-title">RAW POLYMER ASSETS</div>
                <div className="jw-kpi-val-row">
                  <span className="jw-kpi-num">₹{rawPolymerValuationLakhs}</span>
                  <span className="jw-kpi-sublabel">Lakhs</span>
                </div>
                <div className="jw-lkpi-sub">Factory inventory asset value</div>
              </div>

              <div className="jw-kpi-card jw-kpi-highlight">
                <div className="jw-kpi-title jw-title-orange">MATERIAL WITH JOB WORKERS</div>
                <div className="jw-kpi-val-row">
                  <span className="jw-kpi-num jw-text-orange">₹{totalValueWithProcessorsLakhs}</span>
                  <span className="jw-kpi-sublabel">Lakhs</span>
                </div>
                <div className="jw-lkpi-sub">Outside factory risk exposure</div>
              </div>

              <div className="jw-kpi-card">
                <div className="jw-kpi-title">FINISHED GOODS VALUE</div>
                <div className="jw-kpi-val-row">
                  <span className="jw-kpi-num">₹{fgValuationLakhs}</span>
                  <span className="jw-kpi-sublabel">Lakhs</span>
                </div>
                <div className="jw-lkpi-sub">Manufactured stock inventory</div>
              </div>

              <div className="jw-kpi-card">
                <div className="jw-kpi-title">INVOICED DISPATCHES</div>
                <div className="jw-kpi-val-row">
                  <span className="jw-kpi-num jw-text-green">₹{invoicedDispatchesLakhs}</span>
                  <span className="jw-kpi-sublabel jw-text-green">Lakhs</span>
                </div>
                <div className="jw-lkpi-sub">Revenue executed</div>
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

            {/* Bottom 2 Analytics Grid */}
            <div className="jw-analytics-grid">
              {/* Finished Goods Production Output by Category */}
              <div className="jw-analytics-card">
                <div className="jw-acard-header">
                  <BarChart3 size={16} className="jw-text-blue" />
                  <h3 className="jw-acard-title">FINISHED GOODS PRODUCTION OUTPUT BY CATEGORY</h3>
                </div>
                <div className="jw-bars-list">
                  {fgProductionData.map((fg, fgi) => (
                    <div key={fgi} className="jw-bar-item">
                      <div className="jw-bar-label-row">
                        <span className="jw-bar-label">{fg.name}</span>
                        <span className="jw-bar-count">{fg.count}</span>
                      </div>
                      <div className="jw-bar-bg">
                        <div className="jw-bar-fill" style={{ width: `${fg.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sales Dispatch Fulfillment Ratios */}
              <div className="jw-analytics-card">
                <div className="jw-acard-header">
                  <TrendingUp size={16} className="jw-text-green" />
                  <h3 className="jw-acard-title">SALES DISPATCH FULFILLMENT RATIOS</h3>
                </div>
                <div className="jw-fulfillment-list">
                  {dispatchFulfillmentData.map((df, dfi) => (
                    <div key={dfi} className="jw-fulfill-item">
                      <div className="jw-fulfill-info">
                        <span className="jw-fulfill-ref">{df.ref} — {df.customer}</span>
                        <span className="jw-fulfill-pct">{df.status}</span>
                      </div>
                      <div className="jw-bar-bg">
                        <div className="jw-bar-fill jw-fill-green" style={{ width: `${df.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Internal Issue Modal ── */}
      {showIssueModal && (
        <NewJobWorkModal onClose={() => setShowIssueModal(false)} />
      )}

      {/* ── Receive Material Dialog (GRN Modal) ── */}
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
