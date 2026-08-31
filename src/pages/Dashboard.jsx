import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../layouts/Sidebar';
import TopNav from '../layouts/TopNav';
import NewJobWorkModal from '../modals/NewJobWorkModal';
import SalesOrderModal from '../modals/SalesOrderModal';
import JobWorkHubView from '../views/JobWorkHubView';
import { useWorkflow } from '../context/WorkflowContext';
import {
  FlaskConical, Plus, Package, Users, Boxes, Truck,
  ArrowUpRight, AlertTriangle,
  Zap, Circle
} from 'lucide-react';
import '../styles/Dashboard.css';

/* ─── Mock Data ─── */
const kpiData = [
  {
    id: 'raw',
    label: 'RAW MATERIAL STOCK',
    value: '0',
    unit: 'KG',
    trend: null,
    trendUp: true,
    sub: '₹0.00L',
    icon: Package,
    color: 'blue',
  },
  {
    id: 'jw',
    label: 'WITH JOB WORKERS',
    value: '0',
    unit: 'KG',
    trend: null,
    trendUp: false,
    sub: 'Processing Vendors',
    sub2: '₹0.00L',
    icon: Users,
    color: 'orange',
    highlight: true,
  },
  {
    id: 'fg',
    label: 'FINISHED GOODS',
    value: '0',
    unit: 'COILS',
    trend: null,
    trendUp: false,
    sub: '0 items below reorder',
    sub2: '₹0.00L',
    icon: Boxes,
    color: 'green',
    warn: false,
  },
  {
    id: 'dispatch',
    label: 'READY FOR DISPATCH',
    value: '0',
    unit: 'COILS',
    trend: null,
    trendUp: false,
    sub: 'Valued at ₹0.00L',
    sub2: '0 Orders',
    icon: Truck,
    color: 'blue2',
  },
];

const lifecycleStages = [
  { id: 1, label: 'RAW MATERIAL', value: '0', unit: 'KG', color: 'blue', active: false },
  { id: 2, label: 'AT JOB WORK', value: '0', unit: 'KG', color: 'orange', active: true, badge: 'OUT' },
  { id: 3, label: 'IN PROCESS', value: '0', unit: 'KG', color: 'gray', active: false },
  { id: 4, label: 'FINISHED STOCK', value: '0', unit: 'units', color: 'green', active: false },
  { id: 5, label: 'SALES PIPELINE', value: '0', unit: 'Orders', color: 'gray', active: false },
  { id: 6, label: 'DISPATCHES', value: '0', unit: 'Challans', color: 'gray', active: false },
];

const jobWorkData = [];

const dispatches = [];

const reorderAlerts = [];

const traceabilitySteps = [];

/* ─── Chart SVG helpers ─── */
function DonutChart({ rmStock = 0, fgStock = 0, jobWorkStock = 0 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const total = (rmStock || 0) + (fgStock || 0) + (jobWorkStock || 0);

  const data = total > 0 ? [
    { label: 'Factory Raw Material', value: Math.round(((rmStock || 0) / total) * 100), formattedVal: `${(rmStock || 0).toLocaleString()} KG`, color: '#3b82f6' },
    { label: 'Finished Goods (Units)', value: Math.round(((fgStock || 0) / total) * 100), formattedVal: `${(fgStock || 0).toLocaleString()} Coils`, color: '#22c55e' },
    { label: 'Material with Job Workers', value: Math.round(((jobWorkStock || 0) / total) * 100), formattedVal: `${(jobWorkStock || 0).toLocaleString()} KG`, color: '#f97316' },
  ] : [
    { label: 'Factory Raw Material', value: 0, formattedVal: '0 KG', color: '#3b82f6' },
    { label: 'Finished Goods (Units)', value: 0, formattedVal: '0 Coils', color: '#22c55e' },
    { label: 'Material with Job Workers', value: 0, formattedVal: '0 KG', color: '#f97316' },
  ];

  const cx = 120, cy = 120, R = 105, r = 62;
  let cumAngle = -90; // start from top
  const segments = data.map(d => {
    const sweep = (d.value / 100) * 360;
    const startA = cumAngle * Math.PI / 180;
    const endA   = (cumAngle + sweep) * Math.PI / 180;
    cumAngle += sweep;
    const x1 = cx + R * Math.cos(startA), y1 = cy + R * Math.sin(startA);
    const x2 = cx + R * Math.cos(endA),   y2 = cy + R * Math.sin(endA);
    const xi1 = cx + r * Math.cos(startA), yi1 = cy + r * Math.sin(startA);
    const xi2 = cx + r * Math.cos(endA),   yi2 = cy + r * Math.sin(endA);
    const lg = sweep > 180 ? 1 : 0;
    return {
      path: `M ${xi1} ${yi1} A ${r} ${r} 0 ${lg} 1 ${xi2} ${yi2} L ${x2} ${y2} A ${R} ${R} 0 ${lg} 0 ${x1} ${y1} Z`,
      color: d.color,
    };
  });

  const activeItem = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="donut-chart-wrap" style={{ position: 'relative' }} onMouseLeave={() => setHoveredIdx(null)}>
      {/* Floating Hover Tooltip */}
      {activeItem && (
        <div className="chart-tooltip-box">
          <div className="tooltip-header" style={{ color: activeItem.color }}>
            {activeItem.label}
          </div>
          <div className="tooltip-val">{activeItem.formattedVal} ({activeItem.value}%)</div>
        </div>
      )}

      <svg width="240" height="240" viewBox="0 0 240 240">
        {total === 0 ? (
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#e2e8f0" strokeWidth={R - r} />
        ) : (
          segments.map((s, i) => (
            <path
              key={i}
              d={s.path}
              fill={s.color}
              opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.4}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
            />
          ))
        )}
        <circle cx={cx} cy={cy} r={r} fill="#ffffff" />
      </svg>

      <div className="donut-legend">
        {data.map((d, i) => (
          <div
            key={i}
            className={`legend-item ${hoveredIdx === i ? 'highlight' : ''}`}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '3px 0' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="legend-dot" style={{ background: d.color, width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 }} />
              <span style={{ color: hoveredIdx === i ? d.color : '#334155', fontWeight: '600', fontSize: '0.82rem' }}>{d.label}</span>
            </div>
            <span style={{ color: d.color, fontWeight: '700', fontSize: '0.85rem', marginLeft: '12px' }}>{d.formattedVal}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ fgStock = 0 }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const bars = fgStock > 0 ? [
    { label: 'PPD 6mm\n(Yellow)', fullLabel: 'PPD 6mm (Yellow)', free: Math.round(fgStock * 0.7), reserved: Math.round(fgStock * 0.3) }
  ] : [];
  const max = Math.max(100, fgStock || 100);
  const chartH = 125, paddingL = 34, paddingB = 58, paddingTop = 8, paddingR = 10;
  const svgW = 360, svgH = chartH + paddingB + paddingTop;
  const barGroupW = bars.length > 0 ? (svgW - paddingL - paddingR) / bars.length : 60;
  const barW = 14;
  const gridLines = [0, Math.round(max * 0.5), max];

  const activeBar = hoveredIdx !== null ? bars[hoveredIdx] : null;

  return (
    <div className="bar-chart-wrap" style={{ position: 'relative' }} onMouseLeave={() => setHoveredIdx(null)}>
      {/* Floating Bar Tooltip Card */}
      {activeBar && (
        <div className="bar-tooltip-card">
          <div className="bar-tooltip-title">{activeBar.fullLabel}</div>
          <div className="bar-tooltip-line text-green">
            Free Stock : {activeBar.free}
          </div>
          <div className="bar-tooltip-line text-blue">
            Reserved : {activeBar.reserved}
          </div>
        </div>
      )}

      <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block' }}>
        {/* Grid lines + Y labels */}
        {gridLines.map(v => {
          const y = paddingTop + chartH - (v / max) * chartH;
          return (
            <g key={v}>
              <line x1={paddingL} x2={svgW - paddingR} y1={y} y2={y}
                stroke="#e2e8f0" strokeWidth="0.8" strokeDasharray="3,3" />
              <text x={paddingL - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill="#94a3b8">{v}</text>
            </g>
          );
        })}

        {/* Bars + X labels */}
        {bars.map((b, i) => {
          const cx = paddingL + i * barGroupW + barGroupW / 2;
          const fh = (b.free / max) * chartH;
          const rh = (b.reserved / max) * chartH;
          const bx = cx - barW;
          const labelLines = b.label.split('\n');
          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Background Highlight Band on Hover */}
              {hoveredIdx === i && (
                <rect
                  x={cx - barGroupW / 2 + 2}
                  y={paddingTop}
                  width={barGroupW - 4}
                  height={chartH}
                  fill="#cbd5e1"
                  opacity="0.45"
                  rx="3"
                />
              )}

              {/* Free Stock bar */}
              <rect x={bx} y={paddingTop + chartH - fh} width={barW} height={fh}
                fill="#22c55e" rx="2" />
              {/* Reserved bar */}
              <rect x={bx + barW} y={paddingTop + chartH - rh} width={barW} height={Math.max(rh, 0)}
                fill="#3b82f6" rx="2" />
              {/* X-axis label (rotated) */}
              <text
                x={cx}
                y={paddingTop + chartH + 12}
                textAnchor="end"
                fontSize="8.5"
                fontWeight="500"
                fill={hoveredIdx === i ? '#2563eb' : '#64748b'}
                transform={`rotate(-35, ${cx}, ${paddingTop + chartH + 12})`}
              >
                {labelLines[0]} {labelLines[1]}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line x1={paddingL} x2={svgW - paddingR}
          y1={paddingTop + chartH} y2={paddingTop + chartH}
          stroke="#e2e8f0" strokeWidth="1" />
      </svg>
      <div className="bar-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: '#22c55e' }} />Free Stock</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#3b82f6' }} />Reserved</span>
      </div>
    </div>
  );
}

/* ─── Status badge helper ─── */
function StatusBadge({ status }) {
  const map = {
    'PARTIAL': 'badge-partial',
    'IN PROCESS': 'badge-inprocess',
    'COMPLETED': 'badge-completed',
    'OVERDUE': 'badge-overdue',
    'SENT': 'badge-sent',
    'DISPATCHED': 'badge-dispatched',
  };
  return <span className={`status-badge ${map[status] || ''}`}>{status}</span>;
}

/* ─── Main Overview Component ─── */
function DashboardOverview({ openJobWork, openDispatch, openSimulator }) {
  const navigate = useNavigate();
  const {
    rmStock,
    jobWorkStock,
    fgStock,
    dispatchedCoils,
    rmList,
    fgList,
    simulatedJobWorks,
    simulatedSalesOrders,
    simulatedDispatches
  } = useWorkflow();

  const rawSum = (rmList || []).reduce((sum, rm) => {
    return sum + ((Number(rm.availFactory) || 0) * (Number(rm.rate) || 112));
  }, 0);
  const rawValuation = rawSum > 0 ? rawSum : (rmStock * 112);
  const rawValuationLakhs = (rawValuation / 100000).toFixed(2);

  const jwSum = (rmList || []).reduce((sum, rm) => {
    return sum + ((Number(rm.atJobWork) || 0) * (Number(rm.rate) || 112));
  }, 0);
  const jwValuation = jwSum > 0 ? jwSum : (jobWorkStock * 112);
  const jwValuationLakhs = (jwValuation / 100000).toFixed(2);

  const fgSum = (fgList || []).reduce((sum, fg) => {
    return sum + ((Number(fg.stockQty) || 0) * (Number(fg.rate) || 2450));
  }, 0);
  const fgValuation = fgSum > 0 ? fgSum : (fgStock * 2450);
  const fgValuationLakhs = (fgValuation / 100000).toFixed(2);

  const salesSum = (simulatedSalesOrders || []).reduce((sum, so) => {
    const val = typeof so.totalValue === 'number'
      ? so.totalValue
      : (parseFloat(String(so.orderValue || '').replace(/[^0-9.]/g, '')) || (Number(so.orderedQtyCoils || 300) * 2450));
    return sum + val;
  }, 0);
  const totalReadyCoils = (simulatedSalesOrders || []).reduce((sum, so) => {
    return sum + (Number(so.reservedCoils) || Number(so.orderedQtyCoils) || 300);
  }, 0);
  const salesValuation = salesSum > 0 ? salesSum : ((totalReadyCoils || 300) * 2450);
  const salesValuationLakhs = (salesValuation / 100000).toFixed(2);

  const openOrdersCount = (simulatedSalesOrders || []).length || (totalReadyCoils > 0 ? 1 : 0);
  const lowStockFgCount = (fgList || []).filter(fg => (Number(fg.stockQty) || 0) < (Number(fg.reorderLevel) || 50)).length;

  const dynamicKpiData = kpiData.map(kpi => {
    if (kpi.id === 'raw') {
      return { 
        ...kpi, 
        value: rmStock.toLocaleString(), 
        sub: `₹${rawValuationLakhs}L` 
      };
    }
    if (kpi.id === 'jw') {
      return { 
        ...kpi, 
        value: jobWorkStock.toLocaleString(), 
        sub: 'Processing Vendors',
        sub2: `₹${jwValuationLakhs}L` 
      };
    }
    if (kpi.id === 'fg') {
      return { 
        ...kpi, 
        value: fgStock.toLocaleString(), 
        sub: `${lowStockFgCount} items below reorder`,
        sub2: `₹${fgValuationLakhs}L` 
      };
    }
    if (kpi.id === 'dispatch') {
      return {
        ...kpi,
        value: (totalReadyCoils || 300).toLocaleString(),
        sub: `Valued at ₹${salesValuationLakhs}L`,
        sub2: `${openOrdersCount} Orders`
      };
    }
    return kpi;
  });

  const dynamicStages = lifecycleStages.map(stage => {
    if (stage.id === 1) return { ...stage, value: rmStock.toLocaleString() };
    if (stage.id === 2) return { ...stage, value: jobWorkStock.toLocaleString() };
    if (stage.id === 4) return { ...stage, value: fgStock.toLocaleString() };
    if (stage.id === 5) return { ...stage, value: (simulatedSalesOrders || []).length.toString() };
    if (stage.id === 6) return { ...stage, value: (simulatedDispatches || []).length.toString() };
    return stage;
  });

  // Construct 100% live material traceability genealogy pipeline from Firestore documents
  const latestRm = rmList && rmList.length > 0 ? rmList[0] : null;
  const latestJw = simulatedJobWorks && simulatedJobWorks.length > 0 ? simulatedJobWorks[0] : null;
  const latestFg = fgList && fgList.length > 0 ? fgList[0] : null;
  const latestDc = simulatedDispatches && simulatedDispatches.length > 0 ? simulatedDispatches[0] : null;

  const dynamicTraceabilitySteps = [];

  if (latestRm) {
    dynamicTraceabilitySteps.push({
      label: `Raw Material Stock (${latestRm.code || 'RM'})`,
      sub: `${latestRm.name || 'Polymer Granules'} • ${Number(latestRm.availFactory || 0).toLocaleString()} KG Available in Factory`,
      color: 'blue'
    });
  }

  if (latestJw) {
    dynamicTraceabilitySteps.push({
      label: `Job Work Order (${latestJw.jwNo || 'JW'})`,
      sub: `${latestJw.vendor || 'Job Worker'} • Sent ${latestJw.sentQty || `${latestJw.sentQtyKg || 0} KG`}`,
      color: 'orange'
    });

    if (Number(latestJw.recQtyKg || 0) > 0 || (latestJw.recQty && latestJw.recQty !== '0 KG')) {
      dynamicTraceabilitySteps.push({
        label: `GRN Return (${latestJw.jwNo || 'GRN'})`,
        sub: `Received ${latestJw.recQty || `${latestJw.recQtyKg} KG`} • Status: ${latestJw.status || 'RECEIVED'}`,
        color: 'green'
      });
    }
  }

  if (latestFg) {
    dynamicTraceabilitySteps.push({
      label: `Finished Product (${latestFg.code || 'FG'})`,
      sub: `${latestFg.name || 'Finished Goods'} • ${Number(latestFg.stockQty || 0).toLocaleString()} Coils Stock`,
      color: 'blue'
    });
  }

  if (latestDc) {
    dynamicTraceabilitySteps.push({
      label: `Outward Dispatch (${latestDc.challanNo || latestDc.dispatchNo || 'DC'})`,
      sub: `${latestDc.customer || 'Customer'} • Dispatched ${latestDc.dispatchedQty || `${latestDc.dispatchedQtyCoils || 0} Coils`}`,
      color: 'green'
    });
  }

  // Compute live Reorder Alerts dynamically from Firestore inventory items
  const reorderAlerts = [];

  (rmList || []).forEach(rm => {
    const avail = Number(rm.availFactory || 0);
    const min = Number(rm.reorderLevel || 1000);
    if (avail < min) {
      reorderAlerts.push({
        id: rm.id,
        name: rm.name || 'Raw Material',
        code: rm.code || 'RM-PP-001',
        type: 'raw',
        available: `${avail.toLocaleString()} KG`,
        min: `${min.toLocaleString()} KG`,
        action: 'Issue JW'
      });
    }
  });

  (fgList || []).forEach(fg => {
    const stock = Number(fg.stockQty || 0);
    const min = Number(fg.reorderLevel || 50);
    if (stock < min) {
      reorderAlerts.push({
        id: fg.id,
        name: fg.name || 'Finished Good',
        code: fg.code || 'FG-SKU',
        type: 'fg',
        available: `${stock.toLocaleString()} Coils`,
        min: `${min.toLocaleString()} Coils`,
        action: 'View Stock'
      });
    }
  });

  const displayJobWorkList = simulatedJobWorks.map(s => ({
    id: s.jwNo || s.id,
    rawDocId: s.id,
    party: s.vendor || 'Job Worker',
    material: s.rawMat || 'PP Granules',
    sent: s.sentQty || `${s.sentQtyKg || 0} KG`,
    recd: s.recQty || `${s.recQtyKg || 0} KG`,
    status: s.status || 'SENT'
  }));

  const handleKpiClick = (id) => {
    if (id === 'raw') navigate('/inventory', { state: { tab: 'rm' } });
    else if (id === 'jw') navigate('/job-work');
    else if (id === 'fg') navigate('/inventory', { state: { tab: 'fg' } });
    else if (id === 'dispatch') navigate('/sales');
  };

  const handleStageClick = (stageId) => {
    switch (stageId) {
      case 1: // RAW MATERIAL
        navigate('/inventory', { state: { tab: 'rm' } });
        break;
      case 2: // AT JOB WORK
        navigate('/job-work', { state: { tab: 'material' } });
        break;
      case 3: // IN PROCESS
        navigate('/job-work', { state: { tab: 'orders' } });
        break;
      case 4: // FINISHED STOCK
        navigate('/inventory', { state: { tab: 'fg' } });
        break;
      case 5: // SALES PIPELINE
        navigate('/sales', { state: { tab: 'orders' } });
        break;
      case 6: // DISPATCHES
        navigate('/sales', { state: { tab: 'dispatches' } });
        break;
      default:
        break;
    }
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-title-row">
            <h1 className="page-title">Operations Dashboard</h1>
            <span className="plant-badge">
              <Circle size={7} fill="#22c55e" color="#22c55e" />
              Plant 1 Active
            </span>
          </div>
          <p className="page-subtitle">Real-time material flow, job worker balances, production stock, and sales dispatches.</p>
        </div>
        <div className="page-header-right">
          <button className="page-btn blue-sm" onClick={openJobWork}>
            <Plus size={13} />
            New Job Work
          </button>
          <button className="page-btn dark-sm" onClick={openDispatch}>
            <Plus size={13} />
            Dispatch Order
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="kpi-grid">
        {dynamicKpiData.map(kpi => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.id}
              className={`kpi-card kpi-${kpi.color}`}
              onClick={() => handleKpiClick(kpi.id)}
              title={`Click to view ${kpi.label}`}
            >
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value-row">
                <span className={`kpi-value${kpi.highlight ? ' kpi-orange' : ''}`}>{kpi.value}</span>
                <span className="kpi-unit">{kpi.unit}</span>
              </div>
              {kpi.trend && (
                <div className="kpi-trend positive">
                  <ArrowUpRight size={12} />
                  {kpi.trend} vs last month
                </div>
              )}
              {kpi.warn && (
                <div className="kpi-sub warn">
                  <AlertTriangle size={11} />
                  {kpi.sub}
                </div>
              )}
              {!kpi.trend && !kpi.warn && kpi.sub && (
                <div className="kpi-sub">{kpi.sub}</div>
              )}
              {kpi.sub2 && <div className="kpi-sub2">{kpi.sub2}</div>}
            </div>
          );
        })}
      </div>

      {/* ── Connected Factory Lifecycle ── */}
      <div className="lifecycle-card">
        <div className="lifecycle-header">
          <div className="lifecycle-title">
            <Zap size={14} className="lifecycle-icon" />
            CONNECTED FACTORY LIFECYCLE ENGINE
          </div>
          <button
            className="lifecycle-trace-btn"
            onClick={() => navigate('/inventory', { state: { tab: 'traceability' } })}
          >
            Traceability Explorer <ArrowUpRight size={12} />
          </button>
        </div>
        <div className="lifecycle-stages">
          {dynamicStages.map((stage) => (
            <div
              key={stage.id}
              className={`lifecycle-stage lc-${stage.color}${stage.active ? ' active' : ''}`}
              onClick={() => handleStageClick(stage.id)}
              style={{ cursor: 'pointer' }}
              title={`View ${stage.label}`}
            >
              {stage.badge && <span className="lc-badge">{stage.badge}</span>}
              <div className="lc-num">{stage.id}. {stage.label}</div>
              <div className="lc-value">{stage.value}</div>
              <div className="lc-unit">{stage.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main operational row ── */}
      <div className="ops-row">
        {/* Left: Job Work Table */}
        <div className="ops-main">
          <div className="section-card">
            <div className="section-header">
              <div>
                <div className="section-title">Active Job Work Lifecycle</div>
                <div className="section-sub">Live processing status at external vendors</div>
              </div>
              <button
                className="section-link"
                onClick={() => navigate('/job-work', { state: { tab: 'orders' } })}
              >
                View Ledger →
              </button>
            </div>
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>JW NO.</th>
                    <th>PARTY NAME</th>
                    <th>MATERIAL</th>
                    <th>SENT QTY</th>
                    <th>RCVD QTY</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {displayJobWorkList.map(jw => (
                    <tr
                      key={jw.id}
                      onClick={() => navigate('/job-work', { state: { selectedJwId: jw.id || jw.rawDocId } })}
                      style={{ cursor: 'pointer' }}
                      title={`View detail page for ${jw.id}`}
                    >
                      <td><span className="jw-link">{jw.id}</span></td>
                      <td>{jw.party}</td>
                      <td className="td-material">{jw.material}</td>
                      <td>{jw.sent}</td>
                      <td className={jw.status === 'OVERDUE' ? 'td-overdue' : ''}>{jw.recd}</td>
                      <td><StatusBadge status={jw.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts row */}
          <div className="charts-row">
            <div className="section-card chart-card">
              <div className="section-header">
                <div className="section-title">Inventory Distribution</div>
                <div className="section-sub">KG &amp; Units</div>
              </div>
              <DonutChart rmStock={rmStock} fgStock={fgStock} jobWorkStock={jobWorkStock} />
            </div>
            <div className="section-card chart-card">
              <div className="section-header">
                <div className="section-title">Finished Goods Allocation</div>
                <button
                  className="section-link"
                  onClick={() => navigate('/inventory', { state: { tab: 'fg' } })}
                  style={{ cursor: 'pointer' }}
                >
                  View Stock →
                </button>
              </div>
              <BarChart fgStock={fgStock} />
            </div>
          </div>
        </div>

        {/* Right: Dispatches + Traceability */}
        <div className="ops-sidebar">
          {/* Recent Dispatches */}
          <div className="section-card">
            <div className="section-header">
              <div className="section-title">Recent Dispatches</div>
              <button
                className="section-link"
                onClick={() => navigate('/sales', { state: { tab: 'dispatches' } })}
                style={{ cursor: 'pointer' }}
              >
                All Challans →
              </button>
            </div>
            <div className="dispatch-list">
              {simulatedDispatches.map((d, i) => (
                <div
                  key={i}
                  className="dispatch-item"
                  onClick={() => navigate('/sales', { state: { tab: 'dispatches' } })}
                  style={{ cursor: 'pointer' }}
                  title={`View dispatches for ${d.customer}`}
                >
                  <div className="dispatch-bar" />
                  <div className="dispatch-info">
                    <div className="dispatch-party">{d.customer}</div>
                    <div className="dispatch-ref">{d.challanNo || d.dispatchNo} • {d.dispatchedQty}</div>
                  </div>
                  <div className="dispatch-right">
                    <div className="dispatch-amount">{d.value}</div>
                    <StatusBadge status={d.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Material Traceability */}
          <div className="section-card traceability-card">
            <div className="trace-header">
              <div className="section-title">Material Traceability</div>
              <div className="section-sub">Real-time batch movement across Job Workers and Inventory.</div>
            </div>
            <div className="trace-steps">
              {dynamicTraceabilitySteps.length > 0 ? (
                dynamicTraceabilitySteps.map((step, i) => (
                  <div key={i} className="trace-step">
                    <div className={`trace-dot trace-dot-${step.color}`} />
                    {i < dynamicTraceabilitySteps.length - 1 && <div className="trace-line" />}
                    <div className="trace-step-info">
                      <div className="trace-step-label">{step.label}</div>
                      <div className="trace-step-sub">{step.sub}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ color: '#94a3b8', fontSize: '0.82rem', padding: '16px 0', textAlign: 'center' }}>
                  No active material movements recorded yet.
                </div>
              )}
            </div>
            <button
              className="trace-open-btn"
              onClick={() => navigate('/inventory', { state: { tab: 'traceability' } })}
              style={{ cursor: 'pointer' }}
            >
              OPEN TRACE TOOL
            </button>
          </div>
        </div>
      </div>

      {/* ── Full-Width Reorder Alerts Banner ── */}
      {reorderAlerts.length > 0 && (
        <div className="section-card reorder-banner-card">
          <div className="reorder-header">
            <AlertTriangle size={15} className="reorder-icon" />
            <span className="reorder-title">INVENTORY BELOW REORDER THRESHOLDS ({reorderAlerts.length} ITEMS)</span>
          </div>
          <div className="reorder-grid">
            {reorderAlerts.map((alert, i) => (
              <div key={i} className="reorder-item">
                <div className="reorder-item-left">
                  <div className="reorder-name">
                    {alert.name} <span className="reorder-code">({alert.code})</span>
                  </div>
                  <div className="reorder-qty">
                    Available: <span className="reorder-avail">{alert.available}</span>
                    {' '}<span className="reorder-min">(Min: {alert.min})</span>
                  </div>
                </div>
                <button
                  className="reorder-action-btn"
                  onClick={() => alert.type === 'raw' ? openJobWork() : navigate('/inventory', { state: { tab: 'fg' } })}
                  style={{ cursor: 'pointer' }}
                >
                  {alert.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/* ─── Main Dashboard Page ─── */
export default function Dashboard() {
  const [activeNav, setActiveNav] = useState('dashboard');
  const [showJobWork, setShowJobWork] = useState(false);
  const [showSalesOrder, setShowSalesOrder] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [salesOrderMode, setSalesOrderMode] = useState('sales'); // 'sales' | 'dispatch'

  const openJobWork = () => setShowJobWork(true);
  const openSalesOrder = () => { setSalesOrderMode('sales'); setShowSalesOrder(true); };
  const openDispatch = () => { setSalesOrderMode('dispatch'); setShowSalesOrder(true); };
  const openSimulator = () => setShowSimulator(true);

  return (
    <div className="erp-layout">
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} onOpenSimulator={openSimulator} />

      <div className="erp-main-area">
        <TopNav onNewJobWork={openJobWork} onSalesOrder={openSalesOrder} onOpenSimulator={openSimulator} />

        <main className="erp-content">
          {activeNav === 'jobwork' ? (
            <JobWorkHubView onOpenNewJobWork={openJobWork} />
          ) : (
            <DashboardOverview openJobWork={openJobWork} openDispatch={openDispatch} openSimulator={openSimulator} />
          )}
        </main>

        {/* ── Bottom Status Bar ── */}
        <footer className="erp-statusbar">
          <div className="status-left">
            <span className="status-online">
              <Circle size={7} fill="#22c55e" color="#22c55e" />
              Systems Online
            </span>
            <span className="status-sep">•</span>
            <span>Active Session: 2h 45m</span>
            <span className="status-sep">•</span>
            <span>Plant 1 – Rajkot GIDC</span>
          </div>
          <div className="status-right">
            <span>Kamani Plastic Industrial ERP</span>
            <span className="status-sep">•</span>
            <span className="status-edition">Unified Edition</span>
          </div>
        </footer>
      </div>

      {/* ── Modals ── */}
      {showJobWork && <NewJobWorkModal onClose={() => setShowJobWork(false)} />}
      {showSalesOrder && (
        <SalesOrderModal
          mode={salesOrderMode}
          onClose={() => setShowSalesOrder(false)}
        />
      )}
    </div>
  );
}
