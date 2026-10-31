import React from 'react';
import {
  ArrowLeft,
  Printer,
  Scale,
  Package,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Check,
  X,
  User,
  DollarSign,
  Layers,
  FileText,
  ShieldCheck,
  ClipboardCheck,
  Clock
} from 'lucide-react';
import { printGRN } from '../utils/printDocument';
import PageHeader from '../components/PageHeader';
import '../styles/JobWorkHub.css';

export default function GrnDetailView({ inward, onBack, onUpdateQc, onOpenQcModal }) {
  if (!inward) return null;

  const grossWeight = Number(inward.grossWeight || 0);
  const billedWeight = Number(inward.challanWeight || 0);
  const tareWeight = Number(
    inward.tareVarianceKg !== undefined
      ? inward.tareVarianceKg
      : (inward.varianceKg !== undefined
          ? inward.varianceKg
          : (inward.articleWeight !== undefined
              ? inward.articleWeight
              : (inward.tareDeduct !== undefined
                  ? inward.tareDeduct
                  : (grossWeight > 0 && netWeight > 0 ? Math.max(0, grossWeight - netWeight) : 0))))
  );
  const tareLimitKg = Number(inward.varianceThresholdKg || 50);
  const netWeight = Number(inward.netWeight || 0);
  const bagCount = Number(inward.bagCount ?? inward.noOfArticles ?? 0);
  const bagStockKg = Number(inward.bagStockKg ?? netWeight);
  const looseStockKg = Number(inward.looseStockKg || 0);
  const rate = Number(inward.rate || 0);
  const totalValuation = Math.round(netWeight * rate);

  // Check if tare variance exceeds allowable limit or billed weight exceeds gross weight
  const isBilledExceedsGross = billedWeight > 0 && billedWeight > grossWeight;
  const isTareVarianceExceeded = Boolean(
    inward.isTareVarianceExceeded ||
    (tareWeight > 0 && tareWeight > tareLimitKg) ||
    inward.isShortDelivery ||
    isBilledExceedsGross
  );
  const weightDiff = (billedWeight - grossWeight).toFixed(2);
  const lamination = inward.laminationType || (inward.isLaminated ? 'Laminated' : 'Non-Laminated');

  // Resolved QC check and status
  const qcCheck = inward.qcCheck;
  const effectiveQcStatus = (
    inward.qcStatus || 
    (qcCheck?.result === 'PASS' || qcCheck?.status === 'APPROVED' ? 'ACCEPTED' : 
     qcCheck?.result === 'FAIL' || qcCheck?.status === 'REJECTED' ? 'REJECTED' : 'PENDING')
  ).toUpperCase();

  // 24-hr QC SLA Overdue calculation
  const deadline = qcCheck?.deadlineDate || (qcCheck?.deadlineAt?.toDate ? qcCheck.deadlineAt.toDate() : null);
  let hoursDiff = null;
  if (deadline) {
    hoursDiff = Math.round((deadline.getTime() - Date.now()) / (1000 * 60 * 60));
  } else if (inward.date) {
    const inwDate = new Date(inward.date);
    if (!isNaN(inwDate.getTime())) {
      const defaultDeadline = new Date(inwDate.getTime() + 24 * 60 * 60 * 1000);
      hoursDiff = Math.round((defaultDeadline.getTime() - Date.now()) / (1000 * 60 * 60));
    }
  }

  const isQcOverdue = effectiveQcStatus !== 'ACCEPTED' && (
    Boolean(qcCheck?.isOverdue) || 
    (hoursDiff !== null && hoursDiff < 0)
  );
  const overdueHours = hoursDiff !== null && hoursDiff < 0 ? Math.abs(hoursDiff) : null;

  const handlePrintReceipt = () => {
    printGRN({
      slipNo: inward.grnNo,
      date: inward.date,
      grossWeight: grossWeight,
      boraCount: bagCount,
      articleWeight: tareWeight,
      netQtyKg: netWeight,
      receivedBy: inward.receivedBy || 'SURESHBHAI',
      ratePerKg: rate,
      value: totalValuation,
      remarks: inward.remarks || 'GRN raw polymer inward'
    }, {
      inputMaterialName: inward.itemName,
      party: inward.supplierName,
      challan: inward.challanNo,
      batch: inward.batchNumber
    });
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '8px 16px 40px' }}>
      {/* ── Standard Page Header with Breadcrumbs ── */}
      <PageHeader
        breadcrumbs={[
          { label: 'Inventory & Stock', route: '/inventory' },
          { label: 'Raw Materials & GRN', route: '/inventory?tab=rm' },
          { label: inward.grnNo || 'GRN Details' }
        ]}
        title={inward.grnNo || 'GRN Inward'}
        tooltip={`Supplier: ${inward.supplierName || '—'} • Challan: #${inward.challanNo || '—'} • Date: ${inward.date || '—'}`}
        actions={
          <>
            <button
              type="button"
              className="header-btn header-btn-secondary"
              onClick={onBack}
            >
              <ArrowLeft size={14} />
              <span>Back to Inward Register</span>
            </button>
            <button
              type="button"
              className="header-btn header-btn-primary"
              onClick={handlePrintReceipt}
            >
              <Printer size={14} />
              <span>Print GRN Receipt</span>
            </button>
          </>
        }
      />

      {/* ── Main Details Card ── */}
      <div 
        style={{ 
          background: '#ffffff', 
          borderRadius: '14px', 
          border: '1px solid #e2e8f0', 
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}
      >
        {/* Card Header */}
        <div 
          style={{ 
            padding: '20px 24px', 
            borderBottom: '1px solid #f1f5f9', 
            background: '#ffffff',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                {inward.grnNo || 'GRN INWARD'}
              </h1>

              {/* Batch Number badge - highlighted in RED if tare variance exceeds limit or billed weight > gross weight */}
              {isTareVarianceExceeded ? (
                <span 
                  style={{ 
                    background: '#fef2f2', 
                    color: '#dc2626', 
                    border: '1px solid #fecaca', 
                    fontSize: '0.78rem', 
                    fontWeight: 800, 
                    padding: '3px 10px', 
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                  title={isBilledExceedsGross 
                    ? `Billed Weight (${billedWeight.toLocaleString()} KG) exceeds Gross Weight (${grossWeight.toLocaleString()} KG)`
                    : `⚠️ Tare Variance Exceeded: ${tareWeight.toLocaleString()} KG exceeds allowable limit (${tareLimitKg} KG)`}
                >
                  <AlertTriangle size={13} /> {inward.batchNumber || 'NO BATCH'}
                </span>
              ) : (
                <span 
                  style={{ 
                    background: '#eff6ff', 
                    color: '#2563eb', 
                    border: '1px solid #bfdbfe', 
                    fontSize: '0.78rem', 
                    fontWeight: 700, 
                    padding: '3px 10px', 
                    borderRadius: '6px' 
                  }}
                >
                  {inward.batchNumber || 'NO BATCH'}
                </span>
              )}

              {/* QC Overdue Alert Badge */}
              {isQcOverdue ? (
                <span 
                  style={{ 
                    background: '#fee2e2', 
                    color: '#dc2626', 
                    border: '1px solid #fca5a5', 
                    fontSize: '0.78rem', 
                    fontWeight: 800, 
                    padding: '3px 10px', 
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    boxShadow: '0 1px 2px rgba(220, 38, 38, 0.1)'
                  }}
                  title="Quality Check inspection has passed the 24-hour SLA deadline"
                >
                  <Clock size={13} /> {overdueHours ? `QC Overdue by ${overdueHours}h` : 'QC SLA Overdue'}
                </span>
              ) : effectiveQcStatus === 'ACCEPTED' ? (
                <span 
                  style={{ 
                    background: '#dcfce7', 
                    color: '#15803d', 
                    border: '1px solid #bbf7d0', 
                    fontSize: '0.78rem', 
                    fontWeight: 700, 
                    padding: '3px 10px', 
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <CheckCircle2 size={13} /> QC Accepted
                </span>
              ) : null}
            </div>

            <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '6px' }}>
              Supplier: <strong style={{ color: '#0f172a' }}>{inward.supplierName || '—'}</strong>
              {inward.challanNo ? ` • Challan No: #${inward.challanNo}` : ''}
              {inward.date ? ` • Inward Date: ${inward.date}` : ''}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Estimated Valuation
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
              ₹{totalValuation.toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              @ ₹{rate.toFixed(2)} / KG
            </div>
          </div>
        </div>

        {/* ── Weight Discrepancy Warning Banner if Billed > Gross ── */}
        {isBilledExceedsGross && (
          <div 
            style={{ 
              background: '#fef2f2', 
              borderBottom: '1px solid #fecaca', 
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
            <div style={{ fontSize: '0.82rem', color: '#991b1b', lineHeight: 1.4 }}>
              <strong>Weight Discrepancy:</strong> Challan Billed Weight (<strong>{billedWeight.toLocaleString()} KG</strong>) is higher than Scale Gross Weight (<strong>{grossWeight.toLocaleString()} KG</strong>) by <strong>{weightDiff} KG</strong>.
            </div>
          </div>
        )}

        {/* ── QC SLA Overdue Warning Banner ── */}
        {isQcOverdue && (
          <div 
            style={{ 
              background: '#fff1f2', 
              borderBottom: '1px solid #fecdd3', 
              padding: '12px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} style={{ color: '#e11d48', flexShrink: 0 }} />
              <div style={{ fontSize: '0.82rem', color: '#9f1239', lineHeight: 1.4 }}>
                <strong>Quality Check Overdue:</strong> Inward polymer has exceeded the 24-hr inspection deadline{overdueHours ? ` by ${overdueHours} hours` : ''}. Immediate physical test &amp; supervisor evaluation required.
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => onOpenQcModal && onOpenQcModal(inward)}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                }}
              >
                <ClipboardCheck size={14} /> Open QC Evaluation Modal
              </button>
            </div>
          </div>
        )}

        {/* ── 4 KPI Weight Cards Bar ── */}
        <div 
          style={{ 
            padding: '20px 24px', 
            background: '#fafbfc', 
            borderBottom: '1px solid #f1f5f9',
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '12px' 
          }}
        >
          {/* Gross Scale Weight */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>SCALE GROSS WEIGHT</span>
              <Scale size={15} style={{ color: '#2563eb' }} />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
              {grossWeight.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>KG</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>Weighbridge gross</div>
          </div>

          {/* Challan Billed Weight */}
          <div 
            style={{ 
              background: isBilledExceedsGross ? '#fef2f2' : '#ffffff', 
              border: isBilledExceedsGross ? '1px solid #fecaca' : '1px solid #e2e8f0', 
              borderRadius: '10px', 
              padding: '14px' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: isBilledExceedsGross ? '#dc2626' : '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
                CHALLAN BILLED WT
              </span>
              <FileText size={15} style={{ color: isBilledExceedsGross ? '#dc2626' : '#64748b' }} />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isBilledExceedsGross ? '#dc2626' : '#0f172a', marginTop: '6px' }}>
              {billedWeight > 0 ? billedWeight.toLocaleString() : '—'} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: isBilledExceedsGross ? '#dc2626' : '#64748b' }}>KG</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: isBilledExceedsGross ? '#b91c1c' : '#94a3b8', marginTop: '2px' }}>
              {isBilledExceedsGross ? `+${weightDiff} KG over Gross` : 'Supplier invoice'}
            </div>
          </div>

          {/* Tare Deduction */}
          <div style={{ 
            background: tareWeight > tareLimitKg ? '#fff1f2' : '#ffffff', 
            border: tareWeight > tareLimitKg ? '1px solid #fecdd3' : '1px solid #e2e8f0', 
            borderRadius: '10px', 
            padding: '14px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: tareWeight > tareLimitKg ? '#be123c' : '#64748b', fontWeight: 700, letterSpacing: '0.04em' }}>
                TARE DEDUCTION {tareWeight > tareLimitKg && '(EXCEEDED)'}
              </span>
              <Package size={15} style={{ color: tareWeight > tareLimitKg ? '#e11d48' : '#dc2626' }} />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: tareWeight > tareLimitKg ? '#e11d48' : '#dc2626', marginTop: '6px' }}>
              -{tareWeight.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>KG</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: tareWeight > tareLimitKg ? '#be123c' : '#94a3b8', marginTop: '2px' }}>
              {bagCount} {inward.articleType || 'Bags'} auto-tare {tareWeight > tareLimitKg && `• Max: ${tareLimitKg} KG`}
            </div>
          </div>

          {/* Net Scale Inward */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700, letterSpacing: '0.04em' }}>SCALE NET INWARD</span>
              <CheckCircle2 size={15} style={{ color: '#16a34a' }} />
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', marginTop: '6px' }}>
              {netWeight.toLocaleString()} <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#166534' }}>KG</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#15803d', marginTop: '2px' }}>Actual inward inventory</div>
          </div>
        </div>

        {/* ── 2 Essential Specifications Cards ── */}
        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          
          {/* Section: Material & Packaging Specifications */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div 
              style={{ 
                background: '#f8fafc', 
                padding: '10px 16px', 
                borderBottom: '1px solid #e2e8f0', 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: '#334155',
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}
            >
              <Layers size={15} style={{ color: '#2563eb' }} />
              <span>Material &amp; Packaging Details</span>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Item Name:</span>
                <span style={{ fontWeight: 700, color: '#0f172a' }}>{inward.itemName || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Grade / Quality:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{inward.grade || 'Standard'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Material Form:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{inward.materialForm || 'Granule'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Color:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{inward.materialColor || 'Natural / White'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Packaging Type:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>{inward.packaging || 'Woven Bag'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Lamination:</span>
                <span 
                  style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    background: lamination === 'Laminated' ? '#e0f2fe' : '#f1f5f9',
                    color: lamination === 'Laminated' ? '#0369a1' : '#475569',
                    border: lamination === 'Laminated' ? '1px solid #bae6fd' : '1px solid #e2e8f0'
                  }}
                >
                  {lamination}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Stock Allocation & Verification */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
            <div 
              style={{ 
                background: '#f8fafc', 
                padding: '10px 16px', 
                borderBottom: '1px solid #e2e8f0', 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: '#334155',
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}
            >
              <Package size={15} style={{ color: '#16a34a' }} />
              <span>Stock Allocation &amp; Verification</span>
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Standard Bag Stock:</span>
                <span style={{ fontWeight: 700, color: '#16a34a' }}>
                  🎒 {bagCount} Bags ({bagStockKg.toLocaleString()} KG)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Loose Polymer Stock:</span>
                <span style={{ fontWeight: 700, color: looseStockKg > 0 ? '#ea580c' : '#64748b' }}>
                  🌾 {looseStockKg.toLocaleString()} KG
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Polymer Rate:</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{rate.toFixed(2)} / KG</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Quality Check:</span>
                {effectiveQcStatus === 'ACCEPTED' ? (
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
                    {onOpenQcModal && (
                      <button
                        type="button"
                        onClick={() => onOpenQcModal(inward)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#2563eb',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          textDecoration: 'underline',
                          fontWeight: 600
                        }}
                      >
                        View / Re-evaluate QC
                      </button>
                    )}
                  </div>
                ) : effectiveQcStatus === 'REJECTED' ? (
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
                    {onOpenQcModal && (
                      <button
                        type="button"
                        onClick={() => onOpenQcModal(inward)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#2563eb',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          textDecoration: 'underline',
                          fontWeight: 600
                        }}
                      >
                        View / Re-evaluate QC
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    {isQcOverdue && (
                      <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#dc2626', background: '#fee2e2', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: '4px' }}>
                        ⚠️ Overdue {overdueHours ? `${overdueHours}h` : ''}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenQcModal && onOpenQcModal(inward)}
                      style={{
                        background: isQcOverdue ? '#fee2e2' : '#2563eb',
                        color: isQcOverdue ? '#dc2626' : '#ffffff',
                        border: isQcOverdue ? '1px solid #fca5a5' : 'none',
                        borderRadius: '5px',
                        padding: '4px 10px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
                      }}
                    >
                      <ClipboardCheck size={12} />
                      <span>{isQcOverdue ? 'Evaluate QC (Overdue)' : 'Evaluate QC'}</span>
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Received By Supervisor:</span>
                <span style={{ fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <User size={13} style={{ color: '#2563eb' }} />
                  {inward.receivedBy || 'SURESHBHAI'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', fontSize: '0.82rem' }}>
                <span style={{ color: '#64748b' }}>Remarks:</span>
                <span style={{ color: '#334155', maxWidth: '60%', textAlign: 'right' }}>
                  {inward.remarks || '—'}
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* ── Section: Quality Check & Inspection Details (Underneath both cards) ── */}
        <div style={{ padding: '0 24px 24px' }}>
          <div 
            style={{ 
              border: effectiveQcStatus === 'ACCEPTED' 
                ? '1px solid #bbf7d0' 
                : effectiveQcStatus === 'REJECTED' 
                  ? '1px solid #fecaca' 
                  : '1px solid #e2e8f0', 
              borderRadius: '10px', 
              overflow: 'hidden',
              background: '#ffffff',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
            }}
          >
            {/* QC Card Header */}
            <div 
              style={{ 
                background: effectiveQcStatus === 'ACCEPTED' ? '#f0fdf4' : effectiveQcStatus === 'REJECTED' ? '#fef2f2' : isQcOverdue ? '#fff1f2' : '#f8fafc', 
                padding: '12px 18px', 
                borderBottom: effectiveQcStatus === 'ACCEPTED' ? '1px solid #bbf7d0' : effectiveQcStatus === 'REJECTED' ? '1px solid #fecaca' : isQcOverdue ? '1px solid #fecdd3' : '1px solid #e2e8f0', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={18} style={{ color: effectiveQcStatus === 'ACCEPTED' ? '#16a34a' : effectiveQcStatus === 'REJECTED' ? '#dc2626' : isQcOverdue ? '#e11d48' : '#2563eb' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
                  Quality Check &amp; Inward Inspection Details
                </span>
                <span 
                  style={{ 
                    fontSize: '0.72rem', 
                    fontWeight: 700, 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    background: effectiveQcStatus === 'ACCEPTED' ? '#dcfce7' : effectiveQcStatus === 'REJECTED' ? '#fee2e2' : isQcOverdue ? '#fee2e2' : '#fef3c7',
                    color: effectiveQcStatus === 'ACCEPTED' ? '#15803d' : effectiveQcStatus === 'REJECTED' ? '#dc2626' : isQcOverdue ? '#dc2626' : '#b45309',
                    border: effectiveQcStatus === 'ACCEPTED' ? '1px solid #86efac' : effectiveQcStatus === 'REJECTED' ? '1px solid #fca5a5' : isQcOverdue ? '1px solid #fca5a5' : '1px solid #fde68a'
                  }}
                >
                  {effectiveQcStatus === 'ACCEPTED' 
                    ? '✓ QC PASSED / ACCEPTED' 
                    : effectiveQcStatus === 'REJECTED' 
                      ? '✕ QC REJECTED' 
                      : isQcOverdue 
                        ? `⚠️ 24-HR SLA OVERDUE (${overdueHours ? `${overdueHours}h` : 'EXPIRED'})` 
                        : '⏳ PENDING EVALUATION'}
                </span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {effectiveQcStatus === 'ACCEPTED' ? (
                  <button
                    type="button"
                    onClick={() => onUpdateQc && onUpdateQc(inward, 'REJECTED')}
                    style={{
                      background: '#ffffff',
                      color: '#dc2626',
                      border: '1px solid #fca5a5',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Change to Rejected
                  </button>
                ) : effectiveQcStatus === 'REJECTED' ? (
                  <button
                    type="button"
                    onClick={() => onUpdateQc && onUpdateQc(inward, 'ACCEPTED')}
                    style={{
                      background: '#ffffff',
                      color: '#16a34a',
                      border: '1px solid #86efac',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Change to Accepted
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => onUpdateQc && onUpdateQc(inward, 'ACCEPTED')}
                      style={{
                        background: '#16a34a',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Check size={12} strokeWidth={2.5} /> Accept QC
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateQc && onUpdateQc(inward, 'REJECTED')}
                      style={{
                        background: '#dc2626',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '4px 12px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <X size={12} strokeWidth={2.5} /> Reject QC
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* QC Attributes Grid */}
            <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Inspection Result</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: effectiveQcStatus === 'ACCEPTED' ? '#16a34a' : effectiveQcStatus === 'REJECTED' ? '#dc2626' : '#d97706', marginTop: '2px' }}>
                  {effectiveQcStatus === 'ACCEPTED' ? 'Material Accepted' : effectiveQcStatus === 'REJECTED' ? 'Material Rejected' : 'Awaiting Test'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>QC Inspector</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {qcCheck?.checkedBy || (effectiveQcStatus === 'ACCEPTED' ? 'QC Lab Inspector' : 'Pending')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Verified / Approved By</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {qcCheck?.approvedBy || (effectiveQcStatus === 'ACCEPTED' ? 'DIPAKBHAI (Plant Head)' : 'Pending')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Granule Uniformity</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {qcCheck?.uniformity || 'Even (સરખો - Regular)'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Melt Flow Index (MFI)</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {qcCheck?.mfiReading ? `${qcCheck.mfiReading} g/10min` : 'Within Standard Specs'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Packaging &amp; Contamination</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                  {inward.packaging || 'Woven Bag'} • Clean &amp; Sealed
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>24-Hour QC SLA Timeline</div>
                {effectiveQcStatus === 'ACCEPTED' ? (
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#16a34a', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={13} /> Completed within SLA
                  </div>
                ) : isQcOverdue ? (
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#dc2626', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} /> Overdue by {overdueHours || '24+'} hours
                  </div>
                ) : (
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2563eb', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={13} /> {hoursDiff !== null ? `${hoursDiff}h remaining` : 'Within 24-hr SLA'}
                  </div>
                )}
              </div>
            </div>

            {/* QC Notes / Remarks */}
            <div style={{ padding: '10px 20px 14px', borderTop: '1px solid #f1f5f9', background: '#fbfcfd', fontSize: '0.78rem', color: '#475569' }}>
              <strong>Quality Inspection Notes: </strong>
              <span>
                {qcCheck?.notes || qcCheck?.trialReport || (
                  effectiveQcStatus === 'ACCEPTED'
                    ? 'Visual polymer check, packaging seal, and granule uniformity passed inward quality inspection threshold. Cleared for production issue.'
                    : effectiveQcStatus === 'REJECTED'
                      ? 'Material failed inspection criteria. Quarantined in rejection holding area.'
                      : 'Sample pending laboratory testing and moisture/uniformity audit.'
                )}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
