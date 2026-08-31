import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Printer, GitBranch, Plus, CheckCircle2,
  AlertCircle, Truck, Package, Layers, DollarSign, Clock, Download
} from 'lucide-react';
import ReceiveJobWorkModal from '../modals/ReceiveJobWorkModal';
import { useWorkflow } from '../context/WorkflowContext';
import { receiveJobWork } from '../api/jobwork.api';
import { printJobWorkChallan, printGRN } from '../utils/printDocument';
import '../styles/JobWorkHub.css';

export default function JobWorkDetailView({ jwId = 'JW-2026-0024', onBack }) {
  const navigate = useNavigate();
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const { simulatedJobWorks, rmList } = useWorkflow();

  const simMatch = simulatedJobWorks.find(s => s.jwNo === jwId || s.id === jwId) || (simulatedJobWorks.length > 0 ? simulatedJobWorks[0] : null);
  const matchingRm = rmList.find(r => r.id === simMatch?.rawMaterialId || r.code === simMatch?.rawMaterialId || r.name === simMatch?.rawMat);

  const sentNum = Number(simMatch?.sentQtyKg) || (simMatch?.sentQty ? parseFloat(String(simMatch.sentQty).replace(/[^0-9.]/g, '')) : 0) || (simMatch?.inputQty ? Number(simMatch.inputQty) : 0);
  const recNum = simMatch?.recQtyKg !== undefined ? Number(simMatch.recQtyKg) : (simMatch?.receivedQty ? parseFloat(String(simMatch.receivedQty).replace(/[^0-9.]/g, '')) : 0);
  const scrapNum = simMatch?.scrapQtyKg !== undefined ? Number(simMatch.scrapQtyKg) : (simMatch?.scrapQty ? parseFloat(String(simMatch.scrapQty).replace(/[^0-9.]/g, '')) : 0);
  const balNum = simMatch?.balQtyKg !== undefined ? Number(simMatch.balQtyKg) : Math.max(0, sentNum - recNum - scrapNum);

  let chargeRate = 0;
  if (typeof simMatch?.ratePerKg === 'number' && simMatch.ratePerKg > 0) {
    chargeRate = simMatch.ratePerKg;
  } else if (typeof simMatch?.processingRate === 'number' && simMatch.processingRate > 0) {
    chargeRate = simMatch.processingRate;
  } else if (typeof simMatch?.charges === 'number' && simMatch.charges > 0) {
    chargeRate = simMatch.charges < 100 ? simMatch.charges : Math.round(simMatch.charges / (sentNum || 1));
  } else {
    chargeRate = 12;
  }

  const totalCost = Math.round(sentNum * chargeRate);
  const rmCode = matchingRm?.code || simMatch?.rawMaterialCode || simMatch?.rawMaterialId || '';
  const issueDate = simMatch?.date || simMatch?.challanDate || '';
  const returnDate = simMatch?.expectedReturn || '';
  const processName = simMatch?.process || simMatch?.processType || '';
  const currentChallan = simMatch?.chNo || simMatch?.challan || `CH-${simMatch?.jwNo || jwId}`;
  const batchNo = simMatch?.batch || simMatch?.batchNo || '';
  const vehicle = simMatch?.vehicleNo || simMatch?.vehicle || '';
  const isCompleted = balNum <= 0 || simMatch?.status === 'COMPLETED' || simMatch?.status === 'FULLY RECEIVED';

  const detailData = {
    id: simMatch?.jwNo || simMatch?.id || jwId,
    status: isCompleted ? 'FULLY RECEIVED' : (recNum > 0 ? 'PARTIALLY RECEIVED' : (simMatch?.status || 'SENT')),
    statusClass: isCompleted ? 'pill-completed' : (recNum > 0 ? 'pill-partial' : 'pill-blue'),
    party: simMatch?.vendor || simMatch?.party || '',
    challan: currentChallan,
    inputMaterialCode: rmCode,
    inputMaterialName: simMatch?.rawMat || matchingRm?.name || '',
    process: processName,
    dispatchedQty: `${sentNum.toLocaleString('en-IN')} KG`,
    batch: batchNo,
    stockSource: simMatch?.stockSource || 'Factory Silo',
    vehicleNo: vehicle,
    date: issueDate,
    expectedReturn: returnDate,
    expectedOutput: simMatch?.expectedFg || `${sentNum.toLocaleString('en-IN')} KG`,
    receivedQty: `${recNum.toLocaleString('en-IN')} KG`,
    pendingQty: `${balNum.toLocaleString('en-IN')} KG`,
    scrapQty: `${scrapNum.toLocaleString('en-IN')} KG`,
    expectedScrapLimit: simMatch?.wastage || '0%',
    ratePerKg: `₹${chargeRate} / KG`,
    processingCost: `₹${totalCost.toLocaleString('en-IN')}`,
    freightCost: '₹0',
    gstAmount: '₹0',
    totalCharges: `₹${totalCost.toLocaleString('en-IN')}`,
    paymentTerms: '30 Days Post Receipt',
    grnHistory: (recNum > 0 || scrapNum > 0) ? [
      {
        grnNo: `GRN-${simMatch?.jwNo || jwId}`,
        date: '2026-08-26',
        receivedQty: `${recNum.toLocaleString('en-IN')} KG`,
        wastage: `${scrapNum.toLocaleString('en-IN')} KG`,
        acceptedQty: `${recNum.toLocaleString('en-IN')} KG`,
        status: 'Approved',
        location: 'WIP Storage Floor 1',
        notes: 'Process return logged in system.'
      }
    ] : [],
    auditTrail: [
      {
        id: jwId,
        type: 'Job Work Issue',
        date: issueDate,
        qtyChange: `-${sentNum.toLocaleString('en-IN')} KG`,
        colorClass: 'text-red',
        notes: `Dispatched ${sentNum.toLocaleString('en-IN')} KG for processing via Challan ${currentChallan}.`
      },
      ...(recNum > 0 ? [{
        id: `GRN-${simMatch?.jwNo || jwId}`,
        type: 'Job Work Return',
        date: '2026-08-26',
        qtyChange: `+${recNum.toLocaleString('en-IN')} KG`,
        colorClass: 'text-green',
        notes: `Received ${recNum.toLocaleString('en-IN')} KG processed material back into inventory.`
      }] : [])
    ]
  };

  const handleSaveReceiveModal = async (grnData) => {
    try {
      const recKg = Number(grnData.receivedQty || grnData.acceptedQty || 0);
      const scrapKg = Number(grnData.scrapQty || 0);
      await receiveJobWork({
        jwId: simMatch?.id || jwId,
        rawMaterialId: simMatch?.rawMaterialId || null,
        recQtyKg: recKg,
        scrapQtyKg: scrapKg,
        currentRecKg: recNum,
        currentScrapKg: scrapNum,
        totalSentKg: sentNum || 1000,
        itemLabel: detailData.inputMaterialName || 'Processed Material',
        remarks: grnData.notes || `GRN Receipt of ${recKg} KG (${grnData.qualityStatus || 'Approved'})`
      });
      setShowReceiveModal(false);
    } catch (err) {
      console.error('Error in detail receive GRN:', err);
    }
  };

  const handleTraceLifecycle = () => {
    navigate('/inventory', { state: { tab: 'traceability', search: detailData.id } });
  };

  return (
    <div className="jw-detail-container">
      {/* ── Top Navigation Bar ── */}
      <div className="jw-detail-header-card">
        <div className="jwd-header-left">
          <button className="jwd-back-btn" onClick={onBack} title="Back to Job Work List">
            <ArrowLeft size={18} />
          </button>
          <div className="jwd-title-box">
            <div className="jwd-title-row">
              <h1 className="jwd-id-title">{detailData.id}</h1>
              <span className={`jw-status-pill ${detailData.status === 'FULLY RECEIVED' ? 'pill-completed' : 'pill-partial'}`}>• {detailData.status}</span>
            </div>
            <p className="jwd-subtitle">
              Party: <strong>{detailData.party}</strong> • Challan: <strong>{detailData.challan}</strong>
            </p>
          </div>
        </div>

        <div className="jwd-header-right">
          {isCompleted ? (
            <button className="jwd-btn-orange" disabled style={{ opacity: 0.6, cursor: 'not-allowed', background: '#f1f5f9', color: '#64748b', borderColor: '#cbd5e1' }} title="Material fully received (0 KG pending)">
              <CheckCircle2 size={15} />
              Fully Received
            </button>
          ) : (
            <button className="jwd-btn-orange" onClick={() => setShowReceiveModal(true)}>
              <FileText size={15} />
              Receive Material (GRN)
            </button>
          )}
          <button className="jwd-btn-dark" title="Print Job Work Challan" onClick={() => printJobWorkChallan(detailData)}>
            <Printer size={15} />
            Print Job Work Challan
          </button>
          <button className="jwd-btn-ghost" onClick={handleTraceLifecycle} title="Explore Material Genealogy">
            <GitBranch size={15} />
            Trace Lifecycle
          </button>
        </div>
      </div>

      {/* ── JOB WORK EXECUTION PIPELINE (Stepper Bar) ── */}
      <div className="jwd-card jwd-stepper-card">
        <div className="jwd-card-sublabel">JOB WORK EXECUTION PIPELINE</div>
        <div className="jwd-pipeline-steps">
          {/* Step 1 */}
          <div className="pipeline-step step-done">
            <div className="step-circle">1</div>
            <div className="step-label">Material Sent</div>
            <div className="step-sub">{detailData.date}</div>
          </div>
          <div className="pipeline-line line-done" />

          {/* Step 2 */}
          <div className="pipeline-step step-done">
            <div className="step-circle">2</div>
            <div className="step-label">Processing</div>
            <div className="step-sub">{detailData.process}</div>
          </div>
          <div className="pipeline-line line-done" />

          {/* Step 3 */}
          <div className="pipeline-step step-done">
            <div className="step-circle">3</div>
            <div className="step-label">Partially Received</div>
            <div className="step-sub">{detailData.receivedQty}</div>
          </div>
          <div className={`pipeline-line ${detailData.status === 'FULLY RECEIVED' ? 'line-done' : 'line-pending'}`} />

          {/* Step 4 */}
          <div className={`pipeline-step ${detailData.status === 'FULLY RECEIVED' ? 'step-done' : 'step-pending'}`}>
            <div className="step-circle">4</div>
            <div className="step-label">Completed / Full GRN</div>
            <div className="step-sub">Target: {detailData.expectedOutput}</div>
          </div>
        </div>
      </div>

      {/* ── 3 Summary Cards Row (Middle Grid) ── */}
      <div className="jwd-summary-grid">
        {/* Card 1: Input Material */}
        <div className="jwd-card">
          <div className="jwd-card-header-line">
            <span className="jwd-card-title-sm">INPUT MATERIAL</span>
            <span className="jwd-code-tag">{detailData.inputMaterialCode}</span>
          </div>
          <div className="jwd-item-title">{detailData.inputMaterialName}</div>
          <div className="jwd-item-sub">Process: {detailData.process}</div>

          <div className="jwd-kv-grid">
            <div>
              <span className="jwd-k-label">Dispatched Qty:</span>
              <span className="jwd-v-val font-bold">{detailData.dispatchedQty}</span>
            </div>
            <div>
              <span className="jwd-k-label">Batch / Lot:</span>
              <span className="jwd-v-val font-mono">{detailData.batch}</span>
            </div>
            <div>
              <span className="jwd-k-label">Stock Source:</span>
              <span className="jwd-v-val">{detailData.stockSource}</span>
            </div>
            <div>
              <span className="jwd-k-label">Vehicle No:</span>
              <span className="jwd-v-val font-mono">{detailData.vehicleNo}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Output & Wastage */}
        <div className="jwd-card">
          <div className="jwd-card-header-line">
            <span className="jwd-card-title-sm">OUTPUT &amp; WASTAGE</span>
            <span className="jwd-badge-green-sm">62.4% Accounted</span>
          </div>

          <div className="jwd-boxes-2x2">
            <div className="jwd-kpi-box box-grey">
              <span className="box-lbl">EXPECTED OUTPUT</span>
              <span className="box-val">{detailData.expectedOutput}</span>
            </div>
            <div className="jwd-kpi-box box-green">
              <span className="box-lbl">RECEIVED QUANTITY</span>
              <span className="box-val text-green">{detailData.receivedQty}</span>
            </div>
            <div className="jwd-kpi-box box-orange">
              <span className="box-lbl">PENDING QUANTITY</span>
              <span className="box-val text-orange">{detailData.pendingQty}</span>
            </div>
            <div className="jwd-kpi-box box-red">
              <span className="box-lbl">SCRAP / WASTAGE</span>
              <span className="box-val text-red">{detailData.scrapQty}</span>
            </div>
          </div>

          <div className="jwd-scrap-limit">
            Expected Scrap Limit: <strong>{detailData.expectedScrapLimit}</strong>
          </div>
        </div>

        {/* Card 3: Processing Charges */}
        <div className="jwd-card">
          <div className="jwd-card-header-line">
            <span className="jwd-card-title-sm">PROCESSING CHARGES</span>
            <span className="jwd-rate-tag">{detailData.ratePerKg}</span>
          </div>

          <div className="jwd-charges-list">
            <div className="charge-line">
              <span>Job Work Processing ({detailData.dispatchedQty} @ {detailData.ratePerKg}):</span>
              <span>{detailData.processingCost}</span>
            </div>
            <div className="charge-line">
              <span>Freight / Loading Charges:</span>
              <span>{detailData.freightCost}</span>
            </div>
            <div className="charge-line">
              <span>GST (18% Reverse Charge / Tax):</span>
              <span>{detailData.gstAmount}</span>
            </div>
            <div className="charge-total-line">
              <span>Total Payable Charges:</span>
              <span className="total-val">{detailData.totalCharges}</span>
            </div>
          </div>

          <div className="jwd-payment-terms">
            Payment Terms: <strong>{detailData.paymentTerms}</strong>
          </div>
        </div>
      </div>

      {/* ── MATERIAL TRACEABILITY & FLOW ROUTE ── */}
      <div className="jwd-card">
        <div className="jwd-card-sublabel">MATERIAL TRACEABILITY &amp; FLOW ROUTE</div>
        <div className="jwd-flow-route">
          <div className="flow-route-card route-grey">
            <span className="step-tag">STEP 1</span>
            <div className="route-title">Raw Material Stock</div>
            <div className="route-sub">Silo Bay A-1</div>
          </div>

          <span className="route-arrow">&rarr;</span>

          <div className="flow-route-card route-gold">
            <span className="step-tag tag-gold">STEP 2 (OUTWARD)</span>
            <div className="route-title">{detailData.party}</div>
            <div className="route-sub font-mono">{detailData.challan}</div>
          </div>

          <span className="route-arrow">&rarr;</span>

          <div className="flow-route-card route-green">
            <span className="step-tag tag-green">STEP 3 (RETURN)</span>
            <div className="route-title">{detailData.receivedQty} Returned</div>
            <div className="route-sub">WIP Storage / Bay</div>
          </div>
        </div>
      </div>

      {/* ── Goods Receipt Notes (GRN History) Table ── */}
      <div className="jwd-card">
        <div className="jwd-section-header-inline">
          <div>
            <div className="jwd-section-title-md">
              <FileText size={16} className="inline-icon" /> Goods Receipt Notes (GRN History)
            </div>
            <div className="jwd-section-sub font-normal">Every lot receipt and quality inspection recorded</div>
          </div>
          <button className="jwd-btn-dark-sm" onClick={() => setShowReceiveModal(true)}>
            <Plus size={14} /> Record Receipt
          </button>
        </div>

        <div className="jwd-table-wrap">
          <table className="jwd-table">
            <thead>
              <tr>
                <th>GRN NUMBER</th>
                <th>RECEIPT DATE</th>
                <th>RECEIVED QTY</th>
                <th>WASTAGE / SCRAP</th>
                <th>ACCEPTED QTY</th>
                <th>QUALITY STATUS</th>
                <th>STOCK LOCATION</th>
                <th>NOTES &amp; INSPECTION</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {detailData.grnHistory.map(grn => (
                <tr key={grn.grnNo}>
                  <td className="font-mono font-bold text-dark">{grn.grnNo}</td>
                  <td className="text-muted">{grn.date}</td>
                  <td className="font-bold text-green">{grn.receivedQty}</td>
                  <td className="font-bold text-red">{grn.wastage}</td>
                  <td className="font-bold text-dark">{grn.acceptedQty}</td>
                  <td>
                    <span className="jw-status-badge pill-completed">• {grn.status}</span>
                  </td>
                  <td>{grn.location}</td>
                  <td className="text-sub font-normal">{grn.notes}</td>
                  <td>
                    <button className="jwd-btn-ghost-xs" title="Print Goods Receipt Note" onClick={() => printGRN(grn, detailData)}>
                      Print GRN
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── AUDIT TRAIL & LINKED STOCK MOVEMENTS (2) ── */}
      <div className="jwd-card">
        <div className="jwd-card-sublabel">
          <Clock size={14} className="inline-icon" /> AUDIT TRAIL &amp; LINKED STOCK MOVEMENTS ({detailData.auditTrail.length})
        </div>

        <div className="jwd-audit-list">
          {detailData.auditTrail.map((item, idx) => (
            <div key={idx} className="jwd-audit-item">
              <div className="audit-header-line">
                <div className="audit-title-left">
                  <span className="audit-id font-mono font-bold">{item.id}</span>
                  <span className="audit-type-badge">{item.type}</span>
                  <span className="audit-date text-muted">• {item.date}</span>
                </div>
                <span className={`audit-qty ${item.colorClass}`}>{item.qtyChange}</span>
              </div>
              <p className="audit-notes">{item.notes}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Receive Material Modal */}
      {showReceiveModal && (
        <ReceiveJobWorkModal
          row={{ jwNo: detailData.id, id: simMatch?.id || jwId, party: detailData.party, balQtyKg: simMatch?.balQtyKg !== undefined ? simMatch.balQtyKg : 2000 }}
          onClose={() => setShowReceiveModal(false)}
          onSave={handleSaveReceiveModal}
        />
      )}
    </div>
  );
}
