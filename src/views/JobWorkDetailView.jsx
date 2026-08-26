import { useState } from 'react';
import {
  ArrowLeft, FileText, Printer, GitBranch, Plus, CheckCircle2,
  AlertCircle, Truck, Package, Layers, DollarSign, Clock, Download
} from 'lucide-react';
import ReceiveJobWorkModal from '../modals/ReceiveJobWorkModal';
import { useWorkflow } from '../context/WorkflowContext';
import { receiveJobWork } from '../api/jobwork.api';
import '../styles/JobWorkHub.css';

export default function JobWorkDetailView({ jwId = 'JW-2026-0024', onBack }) {
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const { simulatedJobWorks } = useWorkflow();

  const simMatch = simulatedJobWorks.find(s => s.jwNo === jwId || s.id === jwId) || (simulatedJobWorks.length > 0 ? simulatedJobWorks[0] : null);

  const handleSaveReceiveModal = async (grnData) => {
    try {
      const recKg = Number(grnData.receivedQty || grnData.acceptedQty || 0);
      const scrapKg = Number(grnData.scrapQty || 0);
      await receiveJobWork({
        jwId: simMatch?.id || jwId,
        rawMaterialId: simMatch?.rawMaterialId || null,
        recQtyKg: recKg,
        scrapQtyKg: scrapKg,
        currentRecKg: simMatch?.recQtyKg || 0,
        currentScrapKg: simMatch?.scrapQtyKg || 0,
        totalSentKg: simMatch?.sentQtyKg || 2000,
        itemLabel: simMatch?.rawMat || 'PP Granules',
        remarks: grnData.notes || `Receipt of ${recKg} KG processed material (${scrapKg} KG scrap)`
      });
      setShowReceiveModal(false);
    } catch (err) {
      console.error('Error receiving job work:', err);
    }
  };

  const detailData = {
    id: simMatch ? (simMatch.jwNo || simMatch.id || jwId) : jwId,
    status: simMatch
      ? (simMatch.status === 'PARTIAL' ? 'PARTIALLY RECEIVED' : simMatch.status === 'COMPLETED' ? 'FULLY RECEIVED' : simMatch.status || 'SENT')
      : 'NO DATA',
    party: simMatch ? (simMatch.vendor || 'Job Worker') : 'N/A',
    challan: simMatch ? (simMatch.chNo || `CH-${jwId}`) : 'N/A',
    inputMaterialCode: simMatch ? (simMatch.rawMaterialId || 'RM-SKU') : 'N/A',
    inputMaterialName: simMatch ? (simMatch.rawMat || 'Raw Material') : 'N/A',
    process: simMatch ? (simMatch.process || 'Processing') : 'N/A',
    dispatchedQty: simMatch ? `${simMatch.sentQtyKg || simMatch.sentQty || 0} KG` : '0 KG',
    batch: simMatch ? (simMatch.batch || 'WIP-LOT') : 'N/A',
    stockSource: 'Factory Silo / Bay',
    vehicleNo: 'GJ-03-AX-4820',
    expectedOutput: simMatch ? `${simMatch.sentQtyKg || 0} KG` : '0 KG',
    receivedQty: simMatch ? `${simMatch.recQtyKg !== undefined ? simMatch.recQtyKg : 0} KG` : '0 KG',
    pendingQty: simMatch ? `${simMatch.balQtyKg !== undefined ? simMatch.balQtyKg : (simMatch.balQty || 0)} KG` : '0 KG',
    scrapQty: simMatch ? `${simMatch.scrapQtyKg || 0} KG` : '0 KG',
    expectedScrapLimit: '3.0%',
    ratePerKg: simMatch ? `₹${simMatch.charges || 8.5} / KG` : '₹0 / KG',
    processingCost: simMatch ? `₹${((Number(simMatch.sentQtyKg) || 0) * (Number(simMatch.charges) || 8.5)).toLocaleString()}` : '₹0',
    freightCost: '₹0',
    gstAmount: '₹0',
    totalCharges: simMatch ? `₹${((Number(simMatch.sentQtyKg) || 0) * (Number(simMatch.charges) || 8.5)).toLocaleString()}` : '₹0',
    paymentTerms: '30 Days Post Receipt',
    grnHistory: simMatch && (simMatch.recQtyKg > 0 || simMatch.scrapQtyKg > 0) ? [
      {
        grnNo: `GRN-${simMatch.jwNo || jwId}`,
        date: simMatch.date || '2026-08-26',
        receivedQty: `${simMatch.recQtyKg || 0} KG`,
        wastage: `${simMatch.scrapQtyKg || 0} KG`,
        acceptedQty: `${simMatch.recQtyKg || 0} KG`,
        status: 'Approved',
        location: 'WIP Storage Floor 1',
        notes: 'Process return logged in system.'
      }
    ] : [],
    auditTrail: simMatch ? [
      {
        id: jwId,
        type: 'Job Work Issue',
        date: simMatch.date || '2026-08-25',
        qtyChange: `-${simMatch.sentQtyKg || 0} KG`,
        colorClass: 'text-red',
        notes: `Dispatched 2,000 KG for processing via Challan ${simMatch ? simMatch.chNo : 'CH-JW-2026-0089'}.`
      },
      ...(simMatch && simMatch.recQty !== '0 KG' ? [{
        id: 'GRN-JW-2026-099',
        type: 'Job Work Return',
        date: '2026-08-25',
        qtyChange: `+${simMatch.recQty}`,
        colorClass: 'text-green',
        notes: `Received ${simMatch.recQty} processed material back into inventory.`
      }] : [])
    ] : []
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
          <button className="jwd-btn-orange" onClick={() => setShowReceiveModal(true)}>
            <FileText size={15} />
            Receive Material (GRN)
          </button>
          <button className="jwd-btn-dark" onClick={() => alert(`Printing Job Work Challan ${detailData.challan}...`)}>
            <Printer size={15} />
            Print Job Work Challan
          </button>
          <button className="jwd-btn-ghost" onClick={() => alert(`Tracing Lifecycle for ${detailData.id}...`)}>
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
            <div className="step-sub">2026-08-18</div>
          </div>
          <div className="pipeline-line line-done" />

          {/* Step 2 */}
          <div className="pipeline-step step-done">
            <div className="step-circle">2</div>
            <div className="step-label">Processing</div>
            <div className="step-sub">Extrusion / Yarn Making</div>
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
              <span>Job Work Processing (2000 KG @ ₹8.5):</span>
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
                    <button className="jwd-btn-ghost-xs" onClick={() => alert(`Printing GRN ${grn.grnNo}`)}>
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
