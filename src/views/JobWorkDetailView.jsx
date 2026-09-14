import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, Printer, GitBranch, Plus, CheckCircle2,
  AlertCircle, Truck, Package, Layers, DollarSign, Clock, Download,
  Calculator, UserCheck, ShieldCheck, Receipt
} from 'lucide-react';
import ReceiveJobWorkModal from '../modals/ReceiveJobWorkModal';
import { useWorkflow } from '../context/WorkflowContext';
import { receiveJobWork } from '../api/jobwork.api';
import { printJobWorkChallan, printInwardDeliverySlip, printGRN } from '../utils/printDocument';
import '../styles/JobWorkHub.css';

export default function JobWorkDetailView({ jwId = 'JW-2026-0024', onBack }) {
  const navigate = useNavigate();
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const { simulatedJobWorks, rmList } = useWorkflow();

  const simMatch = simulatedJobWorks.find(s => s.jwNo === jwId || s.id === jwId) || (simulatedJobWorks.length > 0 ? simulatedJobWorks[0] : null);
  const matchingRm = rmList.find(r => r.id === simMatch?.rawMaterialId || r.code === simMatch?.rawMaterialId || r.name === simMatch?.rawMat);

  const grossWght = Number(
    simMatch?.grossWeight !== undefined && simMatch?.grossWeight !== null ? simMatch.grossWeight :
    (simMatch?.sentQtyKg || 0)
  );
  const boraCnt = Number(
    simMatch?.boraCount !== undefined && simMatch?.boraCount !== null ? simMatch.boraCount :
    (simMatch?.noOfBora !== undefined && simMatch?.noOfBora !== null ? simMatch.noOfBora : (simMatch?.noOfArticles || 0))
  );
  const tareWeight = Number(
    simMatch?.articleWeight !== undefined && simMatch?.articleWeight !== null ? simMatch.articleWeight :
    (simMatch?.artWght !== undefined ? simMatch.artWght : (boraCnt * 0.2))
  );
  const netWeight = Number(
    simMatch?.netWeight !== undefined && simMatch?.netWeight !== null ? simMatch.netWeight :
    simMatch?.netWeightKg !== undefined ? simMatch.netWeightKg :
    Math.max(0, grossWght - tareWeight)
  );
  const sentNum = Number(simMatch?.sentQtyKg) || netWeight || (simMatch?.sentQty ? parseFloat(String(simMatch.sentQty).replace(/[^0-9.]/g, '')) : 0) || (simMatch?.inputQty ? Number(simMatch.inputQty) : 0);
  const bLossPct = Number(
    simMatch?.bLossPct !== undefined && simMatch?.bLossPct !== null ? simMatch.bLossPct :
    simMatch?.bLossPercent !== undefined && simMatch?.bLossPercent !== null ? simMatch.bLossPercent :
    (parseFloat(String(simMatch?.wastage || 0).replace(/[^0-9.]/g, '')) || 0)
  );
  const bLossKg = Number(
    simMatch?.bLossKg !== undefined && simMatch?.bLossKg !== null ? simMatch.bLossKg :
    (netWeight * (bLossPct / 100))
  );
  const netOutwardKg = Number(
    simMatch?.netWeightFinal !== undefined && simMatch?.netWeightFinal !== null ? simMatch.netWeightFinal :
    simMatch?.netOutwardKg !== undefined && simMatch?.netOutwardKg !== null ? simMatch.netOutwardKg :
    Math.max(0, netWeight - bLossKg)
  );

  const recNum = simMatch?.recQtyKg !== undefined ? Number(simMatch.recQtyKg) : (simMatch?.receivedQty ? parseFloat(String(simMatch.receivedQty).replace(/[^0-9.]/g, '')) : 0);
  const scrapNum = simMatch?.scrapQtyKg !== undefined ? Number(simMatch.scrapQtyKg) : (simMatch?.scrapQty ? parseFloat(String(simMatch.scrapQty).replace(/[^0-9.]/g, '')) : 0);
  const reworkNum = Number(simMatch?.reworkQtyKg || 0);
  const rejectionNum = Number(simMatch?.rejectionQtyKg || 0);
  
  const pendingFromDoc = (simMatch?.pendingQty !== undefined && simMatch?.pendingQty !== null)
    ? Number(simMatch.pendingQty)
    : (simMatch?.balQtyKg !== undefined && simMatch?.balQtyKg !== null ? Number(simMatch.balQtyKg) : null);

  const balNum = pendingFromDoc !== null
    ? pendingFromDoc
    : Math.max(0, netOutwardKg - recNum - scrapNum - rejectionNum);

  let chargeRate = 0;
  if (typeof simMatch?.ratePerKg === 'number' && simMatch.ratePerKg > 0) {
    chargeRate = simMatch.ratePerKg;
  } else if (typeof simMatch?.processingRate === 'number' && simMatch.processingRate > 0) {
    chargeRate = simMatch.processingRate;
  } else if (typeof simMatch?.charges === 'number' && simMatch.charges > 0) {
    chargeRate = simMatch.charges < 100 ? simMatch.charges : Math.round(simMatch.charges / (sentNum || 1));
  } else {
    chargeRate = 17.5;
  }

  const totalCost = Math.round(sentNum * chargeRate);
  const rmCode = matchingRm?.code || simMatch?.rawMaterialCode || simMatch?.rawMaterialId || '';
  const issueDate = simMatch?.date || simMatch?.challanDate || '';
  const returnDate = simMatch?.expectedReturn || '';
  const processName = simMatch?.process || simMatch?.processType || 'GRANUAL - FISHING YARN';
  const currentChallan = simMatch?.chNo || simMatch?.challan || `CH-${simMatch?.jwNo || jwId}`;
  const subChal = simMatch?.subChalNo || '1';
  const workOrder = simMatch?.workOrder || 'WO-1001';
  const department = simMatch?.department || 'Job Work Extrusion';
  const batchNo = simMatch?.batch || simMatch?.batchNo || '';
  const vehicle = simMatch?.vehicleNo || simMatch?.vehicle || '';
  const issuedBy = simMatch?.issuedBy || 'SURESHBHAI';
  const approvedBy = simMatch?.approvedBy || 'FINAL APPROVED';
  const isCompleted = balNum <= 0 || simMatch?.status === 'COMPLETED' || simMatch?.status === 'FULLY RECEIVED';

  const inwardReceipts = Array.isArray(simMatch?.inwardReceipts) && simMatch.inwardReceipts.length > 0
    ? simMatch.inwardReceipts
    : (recNum > 0 || scrapNum > 0 ? [
        {
          slipNo: `SLIP-${currentChallan}`,
          date: returnDate || issueDate,
          grossWeight: recNum + (boraCnt * 0.2),
          boraCount: boraCnt,
          articleWeight: boraCnt * 0.2,
          netQtyKg: recNum,
          reworkQtyKg: reworkNum,
          rejectionQtyKg: rejectionNum,
          scrapQtyKg: scrapNum,
          samplePcs: Number(simMatch?.samplePcs || 10),
          sampleWeight: Number(simMatch?.sampleWeight || 0.5),
          receivedBy: 'RAMILBHAI',
          ratePerKg: chargeRate,
          value: recNum * chargeRate,
          status: 'Approved',
          remarks: 'Process return logged in system.'
        }
      ] : []);

  const detailData = {
    id: simMatch?.jwNo || simMatch?.id || jwId,
    status: isCompleted ? 'FULLY RECEIVED' : (recNum > 0 ? 'PARTIALLY RECEIVED' : (simMatch?.status || 'SENT')),
    statusClass: isCompleted ? 'pill-completed' : (recNum > 0 ? 'pill-partial' : 'pill-blue'),
    party: simMatch?.vendor || simMatch?.party || 'Job Worker',
    challan: currentChallan,
    subChalNo: subChal,
    workOrder: workOrder,
    department: department,
    inputMaterialCode: rmCode,
    inputMaterialName: simMatch?.rawMat || matchingRm?.name || 'Raw Material',
    grade: simMatch?.grade || '',
    process: processName,
    grossWeight: `${grossWght.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG`,
    grossWeightNum: grossWght,
    boraCount: `${boraCnt} Bora`,
    boraCountNum: boraCnt,
    articleWeight: `${tareWeight.toFixed(2)} KG`,
    articleWeightNum: tareWeight,
    dispatchedQty: `${netWeight.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG`,
    sentQtyKg: netWeight,
    inputQty: netWeight,
    bLossPct: `${bLossPct}%`,
    bLossPctNum: bLossPct,
    bLossKg: `${bLossKg.toFixed(1)} KG`,
    bLossKgNum: bLossKg,
    netOutwardExpected: `${netOutwardKg.toFixed(1)} KG`,
    netOutwardKg: netOutwardKg,
    batch: batchNo,
    stockSource: simMatch?.stockSource || 'Factory Silo A',
    vehicleNo: vehicle,
    date: issueDate,
    expectedReturn: returnDate,
    expectedOutput: simMatch?.expectedFg || `${netOutwardKg.toFixed(1)} KG`,
    receivedQty: `${recNum.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG`,
    recQtyKg: recNum,
    pendingQty: `${balNum.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG`,
    balQtyKg: balNum,
    scrapQty: `${scrapNum.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG`,
    scrapQtyKg: scrapNum,
    reworkQty: `${reworkNum.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG`,
    rejectionQty: `${rejectionNum.toLocaleString('en-IN', { maximumFractionDigits: 1 })} KG`,
    samplePcs: Number(simMatch?.samplePcs || 10),
    sampleWeight: Number(simMatch?.sampleWeight || 0.5),
    issuedBy: issuedBy,
    approvedBy: approvedBy,
    ratePerKg: `₹${chargeRate} / KG`,
    processingCost: `₹${totalCost.toLocaleString('en-IN')}`,
    totalCharges: `₹${totalCost.toLocaleString('en-IN')}`,
    paymentTerms: '30 Days Post Inward Receipt'
  };


  const handleSaveReceiveModal = async (grnData) => {
    try {
      await receiveJobWork({
        jwId: simMatch?.id || jwId,
        rawMaterialId: simMatch?.rawMaterialId || null,
        recGrossWeight: grnData.recGrossWeight,
        recBoraCount: grnData.recBoraCount,
        recArticleType: grnData.recArticleType,
        recArticleWeight: grnData.recArticleWeight,
        recQtyKg: grnData.recQtyKg,
        reworkQtyKg: grnData.reworkQtyKg,
        rejectionQtyKg: grnData.rejectionQtyKg,
        scrapQtyKg: grnData.scrapQtyKg,
        currentRecKg: recNum,
        currentScrapKg: scrapNum,
        totalSentKg: sentNum || 1000,
        inwardSlipNo: grnData.inwardSlipNo,
        inwardDate: grnData.inwardDate,
        receivedBy: grnData.receivedBy,
        ratePerKg: grnData.ratePerKg,
        samplePcs: grnData.samplePcs,
        sampleWeight: grnData.sampleWeight,
        itemLabel: detailData.inputMaterialName,
        remarks: grnData.notes || `Inward Slip ${grnData.inwardSlipNo} recorded`
      });
      setShowReceiveModal(false);
    } catch (err) {
      console.error('Error in detail receive GRN:', err);
    }
  };

  const handleTraceLifecycle = () => {
    navigate('/inventory', { state: { tab: 'traceability', search: detailData.id } });
  };

  const handlePrintInwardSlip = () => {
    const latestSlip = inwardReceipts.length > 0 ? inwardReceipts[0] : {
      slipNo: `SLIP-${currentChallan}`,
      date: returnDate || issueDate || new Date().toISOString().split('T')[0],
      grossWeight: recNum > 0 ? recNum + (boraCnt * 0.2) : grossWght,
      boraCount: boraCnt,
      articleWeight: tareWeight,
      netQtyKg: recNum > 0 ? recNum : netOutwardKg,
      reworkQtyKg: reworkNum,
      rejectionQtyKg: rejectionNum,
      scrapQtyKg: scrapNum,
      samplePcs: Number(simMatch?.samplePcs || 10),
      sampleWeight: Number(simMatch?.sampleWeight || 0.5),
      receivedBy: 'RAMILBHAI',
      ratePerKg: chargeRate,
      value: (recNum > 0 ? recNum : netOutwardKg) * chargeRate,
      status: 'Approved',
      remarks: 'Process return logged in system.'
    };
    printInwardDeliverySlip(latestSlip, detailData);
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
              Party: <strong>{detailData.party}</strong> • Challan: <strong>#{detailData.challan}</strong> • Dept: <strong>{detailData.department}</strong>
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
              Record Inward Slip
            </button>
          )}
          <button className="jwd-btn-dark" title="Print Rule 55 Delivery Challan (Outward)" onClick={() => printJobWorkChallan(detailData)}>
            <Printer size={15} />
            Print Rule 55 Challan
          </button>
          <button
            className="jwd-btn-dark"
            style={{ background: '#0284c7', borderColor: '#0284c7', color: '#ffffff' }}
            title="Print Job Work Inward Delivery Slip (Sheet 22: Inward Slip)"
            onClick={handlePrintInwardSlip}
          >
            <Receipt size={15} />
            Print Inward Slip
          </button>
          <button className="jwd-btn-ghost" onClick={handleTraceLifecycle} title="Explore Material Genealogy">
            <GitBranch size={15} />
            Trace Lifecycle
          </button>
        </div>
      </div>

      {/* ── JOB WORK EXECUTION PIPELINE (Stepper Bar) ── */}
      <div className="jwd-card jwd-stepper-card">
        <div className="jwd-card-sublabel">RULE 55 STATUTORY JOB WORK LIFECYCLE</div>
        <div className="jwd-pipeline-steps">
          <div className="pipeline-step step-done">
            <div className="step-circle">1</div>
            <div className="step-label">Outward Issued</div>
            <div className="step-sub">{detailData.date} ({detailData.dispatchedQty})</div>
          </div>
          <div className="pipeline-line line-done" />

          <div className="pipeline-step step-done">
            <div className="step-circle">2</div>
            <div className="step-label">Outside Processing</div>
            <div className="step-sub">{detailData.process}</div>
          </div>
          <div className="pipeline-line line-done" />

          <div className="pipeline-step step-done">
            <div className="step-circle">3</div>
            <div className="step-label">Inward Received</div>
            <div className="step-sub">{detailData.receivedQty}</div>
          </div>
          <div className={`pipeline-line ${isCompleted ? 'line-done' : 'line-pending'}`} />

          <div className={`pipeline-step ${isCompleted ? 'step-done' : 'step-pending'}`}>
            <div className="step-circle">4</div>
            <div className="step-label">Reconciled</div>
            <div className="step-sub">Target: {detailData.expectedOutput}</div>
          </div>
        </div>
      </div>

      {/* ── 3 Summary Cards Row (Middle Grid) ── */}
      <div className="jwd-summary-grid">
        {/* Card 1: Input Material & Packaging Tare */}
        <div className="jwd-card">
          <div className="jwd-card-header-line">
            <span className="jwd-card-title-sm">OUTWARD SPECIFICATIONS</span>
            <span className="jwd-code-tag">{detailData.workOrder}</span>
          </div>
          <div className="jwd-item-title">{detailData.inputMaterialName} {detailData.grade ? `^ ${detailData.grade}` : ''}</div>
          <div className="jwd-item-sub">Process: {detailData.process}</div>

          <div className="jwd-kv-grid" style={{ marginTop: '10px' }}>
            <div>
              <span className="jwd-k-label">Gross Scale Weight:</span>
              <span className="jwd-v-val font-bold">{detailData.grossWeight}</span>
            </div>
            <div>
              <span className="jwd-k-label">Bora / Tare:</span>
              <span className="jwd-v-val">{detailData.boraCount} ({detailData.articleWeight})</span>
            </div>
            <div>
              <span className="jwd-k-label">Net Dispatched:</span>
              <span className="jwd-v-val font-bold" style={{ color: '#0284c7' }}>{detailData.dispatchedQty}</span>
            </div>
            <div>
              <span className="jwd-k-label">B.Loss Allowance:</span>
              <span className="jwd-v-val">{detailData.bLossPct} ({detailData.bLossKg})</span>
            </div>
            <div>
              <span className="jwd-k-label">Issued By:</span>
              <span className="jwd-v-val">{detailData.issuedBy}</span>
            </div>
            <div>
              <span className="jwd-k-label">Approval Status:</span>
              <span className="jwd-v-val">{detailData.approvedBy}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Output & Wastage Balance */}
        <div className="jwd-card">
          <div className="jwd-card-header-line">
            <span className="jwd-card-title-sm">WEIGHT RECONCILIATION</span>
            <span className="jwd-badge-green-sm">Yield Monitored</span>
          </div>

          <div className="jwd-boxes-2x2">
            <div className="jwd-kpi-box box-grey">
              <span className="box-lbl">NET RECEIVABLE</span>
              <span className="box-val">{detailData.expectedOutput}</span>
            </div>
            <div className="jwd-kpi-box box-green">
              <span className="box-lbl">INWARD RECEIVED</span>
              <span className="box-val text-green">{detailData.receivedQty}</span>
            </div>
            <div className="jwd-kpi-box box-orange">
              <span className="box-lbl">PENDING BALANCE</span>
              <span className="box-val text-orange">{detailData.pendingQty}</span>
            </div>
            <div className="jwd-kpi-box box-red">
              <span className="box-lbl">SCRAP &amp; REJECT</span>
              <span className="box-val text-red">{(scrapNum + rejectionNum).toFixed(1)} KG</span>
            </div>
          </div>

          <div className="jwd-scrap-limit">
            QA Sample Audit: <strong>{detailData.samplePcs} PCs ({detailData.sampleWeight} KG)</strong>
          </div>
        </div>

        {/* Card 3: Processing Charges & Rate Master */}
        <div className="jwd-card">
          <div className="jwd-card-header-line">
            <span className="jwd-card-title-sm">PROCESSING CHARGES &amp; VALUE</span>
            <span className="jwd-rate-tag">{detailData.ratePerKg}</span>
          </div>

          <div className="jwd-charges-list">
            <div className="charge-line">
              <span>Rate Master ({detailData.process}):</span>
              <span>{detailData.ratePerKg}</span>
            </div>
            <div className="charge-line">
              <span>Gross Outward Value:</span>
              <span>{detailData.processingCost}</span>
            </div>
            <div className="charge-line">
              <span>Rejection / Extra Cutting:</span>
              <span style={{ color: '#dc2626' }}>-₹{(rejectionNum * 100).toLocaleString('en-IN')}</span>
            </div>
            <div className="charge-total-line">
              <span>Net Processing Payable:</span>
              <span className="total-val">{detailData.totalCharges}</span>
            </div>
          </div>

          <div className="jwd-payment-terms">
            Payment Terms: <strong>{detailData.paymentTerms}</strong>
          </div>
        </div>
      </div>

      {/* ── Inward Receipts (Slip History) Table ── */}
      <div className="jwd-card">
        <div className="jwd-section-header-inline">
          <div>
            <div className="jwd-section-title-md">
              <Receipt size={16} className="inline-icon" /> Job Work Inward Slips (Receipt History)
            </div>
            <div className="jwd-section-sub font-normal">Audit of all incoming slips with Bora tare, rework, rejection, and supervisor signatures</div>
          </div>
          {!isCompleted && (
            <button className="jwd-btn-dark-sm" onClick={() => setShowReceiveModal(true)}>
              <Plus size={14} /> Record Inward Slip
            </button>
          )}
        </div>

        <div className="jwd-table-wrap">
          <table className="jwd-table">
            <thead>
              <tr>
                <th>INWARD SLIP NO.</th>
                <th>RECEIPT DATE</th>
                <th>GROSS (KG)</th>
                <th>BORA COUNT</th>
                <th>NET RECD (KG)</th>
                <th>REWORK / REJECT</th>
                <th>SAMPLE</th>
                <th>RECEIVED BY</th>
                <th>VALUE (₹)</th>
                <th>QA STATUS</th>
                <th style={{ textAlign: 'center', width: '120px', minWidth: '110px' }}>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {inwardReceipts.length > 0 ? (
                inwardReceipts.map((grn, gi) => (
                  <tr key={gi}>
                    <td className="font-mono font-bold" style={{ color: '#ea580c' }}>{grn.slipNo}</td>
                    <td>{grn.date}</td>
                    <td>{grn.grossWeight ? `${Number(grn.grossWeight).toFixed(1)} KG` : '—'}</td>
                    <td>{grn.boraCount ? `${grn.boraCount} Bora` : '—'}</td>
                    <td className="font-bold" style={{ color: '#16a34a' }}>{Number(grn.netQtyKg || 0).toFixed(1)} KG</td>
                    <td style={{ color: '#dc2626' }}>
                      {(Number(grn.reworkQtyKg || 0) + Number(grn.rejectionQtyKg || 0)).toFixed(1)} KG
                    </td>
                    <td>{grn.samplePcs || 10} PCs ({grn.sampleWeight || 0.5}k)</td>
                    <td>{grn.receivedBy || 'RAMILBHAI'}</td>
                    <td className="font-bold">₹{Number(grn.value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td>
                      <span className="badge-green-sm">✓ {grn.status || 'Approved'}</span>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        className="jw-slip-print-btn"
                        title="Print Job Work Inward Delivery Slip"
                        onClick={() => printInwardDeliverySlip(grn, detailData)}
                      >
                        <Printer size={13} />
                        <span>Print Slip</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '18px', color: '#64748b' }}>
                    No inward receipt slips recorded yet for this challan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Receive Material Dialog (Inward Slip Modal) ── */}
      {showReceiveModal && (
        <ReceiveJobWorkModal
          row={{
            id: detailData.id,
            jwNo: detailData.id,
            chNo: detailData.challan,
            party: detailData.party,
            material: detailData.inputMaterialName,
            balQtyKg: balNum,
            ratePerKg: chargeRate
          }}
          onClose={() => setShowReceiveModal(false)}
          onSave={handleSaveReceiveModal}
        />
      )}
    </div>
  );
}
