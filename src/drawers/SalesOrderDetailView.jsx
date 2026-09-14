import React from 'react';
import { ArrowLeft, Truck, Printer } from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import { printSalesOrderAck } from '../utils/printDocument';
import '../styles/SalesOrderDetail.css';

export default function SalesOrderDetailView({ orderId, onBack, onCreateDispatch }) {
  const { simulatedSalesOrders, simulatedDispatches } = useWorkflow();
  const simMatch = simulatedSalesOrders.find(so => so.orderNo === orderId || so.id === orderId);

  const linkedDispatches = (simulatedDispatches || []).filter(d =>
    d.soId === orderId ||
    d.soId === simMatch?.id ||
    d.orderRef === orderId ||
    d.orderRef === simMatch?.orderNo ||
    (typeof d.orderRef === 'string' && (d.orderRef.includes(orderId) || (simMatch?.orderNo && d.orderRef.includes(simMatch.orderNo))))
  );

  const parseVal = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const orderedQtyNum = simMatch ? (Number(simMatch.orderedQtyCoils) || parseVal(simMatch.orderedQty) || 0) : 0;
  const dispatchedQtyNum = simMatch ? (Number(simMatch.dispatchedCoils) || Number(simMatch.dispatchedQtyCoils) || parseVal(simMatch.dispatched) || 0) : 0;
  const balanceQtyNum = Math.max(0, orderedQtyNum - dispatchedQtyNum);
  const rawReserved = simMatch ? (Number(simMatch.reservedQtyCoils) || Number(simMatch.reservedCoils) || parseVal(simMatch.reserved) || 0) : 0;
  const reservedQtyNum = Math.min(rawReserved, balanceQtyNum);

  // Rate per unit (taxable rate)
  const rateNum = Number(simMatch?.rate) || Number(simMatch?.pricePerUnit) || 2450;
  // Subtotal (Taxable)
  const taxableSubtotalNum = (orderedQtyNum > 0 && rateNum > 0) ? (orderedQtyNum * rateNum) : (Number(simMatch?.taxableSubtotal) || 0);
  // GST (18%)
  const gstNum = Math.round(taxableSubtotalNum * 0.18);
  // Freight
  const freightNum = Number(simMatch?.freight) || 0;
  // Grand Total
  const grandTotalNum = taxableSubtotalNum + gstNum + freightNum;

  const defaultItems = (simMatch?.items && simMatch.items.length > 0) ? simMatch.items : [
    {
      id: 1,
      desc: simMatch?.itemSummary || simMatch?.productName || 'PP Danline Rope 6mm (Yellow)',
      code: simMatch?.fgSkuId || 'FG-PPD-06-YL',
      product: simMatch?.itemSummary || simMatch?.productName || 'PP Danline Rope 6mm (Yellow)',
      diaColor: simMatch?.spec || '6 mm • Bright Yellow',
      orderedQty: `${orderedQtyNum} Coils`,
      reserved: `${reservedQtyNum} Coils`,
      dispatched: `${dispatchedQtyNum} Coils`,
      balance: `${balanceQtyNum} Coils`,
      rate: `₹${rateNum.toLocaleString('en-IN')}`,
      amount: `₹${taxableSubtotalNum.toLocaleString('en-IN')}`
    }
  ];

  const orderDetails = {
    id: simMatch?.orderNo || simMatch?.id || orderId || 'SO-2026-4150',
    status: simMatch?.status || 'STOCK RESERVED',
    statusClass: simMatch?.status === 'COMPLETED' ? 'pill-completed' : (simMatch?.status === 'DISPATCHED' ? 'pill-dispatched' : 'pill-confirmed'),
    customer: simMatch?.customer || 'ABC Marine Traders',
    poRef: simMatch?.poRef || 'PO-2026-6111',
    address: simMatch?.deliveryAddress || simMatch?.destination || 'Plot 45, Commercial Dock, Veraval, Gujarat',
    orderDate: simMatch?.orderDate || simMatch?.date || '2026-08-26',
    targetDispatch: simMatch?.targetDispatch || simMatch?.deliveryDate || '2026-08-30',
    paymentTerms: simMatch?.paymentTerms || '30 Days Post Dispatch',
    ordered: orderedQtyNum,
    reserved: reservedQtyNum,
    dispatched: dispatchedQtyNum,
    remaining: `${balanceQtyNum} Coils`,
    taxableSubtotal: taxableSubtotalNum,
    subtotal: `₹${taxableSubtotalNum.toLocaleString('en-IN')}`,
    gstNum,
    gst: `₹${gstNum.toLocaleString('en-IN')}`,
    freightNum,
    freight: `₹${freightNum.toLocaleString('en-IN')}`,
    grandTotalNum,
    grandTotal: `₹${grandTotalNum.toLocaleString('en-IN')}`,
    items: defaultItems
  };

  return (
    <div className="so-detail-view">
      {/* Top Banner Navigation Header */}
      <div className="so-detail-header">
        <div className="so-header-left">
          <button className="so-back-btn" onClick={onBack} title="Back to Sales Orders">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="so-title-row">
              <h1 className="so-order-id">{orderDetails.id}</h1>
              <span className={`so-status-badge ${orderDetails.statusClass || 'pill-confirmed'}`}>
                • {orderDetails.status}
              </span>
            </div>
            <div className="so-header-sub">
              Customer: <strong>{orderDetails.customer}</strong> • {orderDetails.poRef}
            </div>
          </div>
        </div>

        <div className="so-header-right">
          <button className="so-btn-create-dispatch" onClick={onCreateDispatch}>
            <Truck size={15} /> Create Dispatch Challan
          </button>
          <button className="so-btn-print" onClick={() => printSalesOrderAck(orderDetails)}>
            <Printer size={15} /> Print Order Ack
          </button>
        </div>
      </div>

      {/* 3 KPI Summary Cards Grid */}
      <div className="so-kpi-cards-grid">
        {/* Card 1: Customer & Delivery Info */}
        <div className="so-kpi-card">
          <div className="so-card-title">CUSTOMER &amp; DELIVERY INFO</div>
          <div className="so-cust-name">{orderDetails.customer}</div>
          <div className="so-cust-address">{orderDetails.address}</div>

          <div className="so-info-lines">
            <div className="so-info-line">
              <span className="so-info-label">Order Date:</span>
              <span className="so-info-val">{orderDetails.orderDate}</span>
            </div>
            <div className="so-info-line">
              <span className="so-info-label">Target Dispatch:</span>
              <span className="so-info-val">{orderDetails.targetDispatch}</span>
            </div>
            <div className="so-info-line">
              <span className="so-info-label">Payment Terms:</span>
              <span className="so-info-val">{orderDetails.paymentTerms}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Stock Allocation Status */}
        <div className="so-kpi-card">
          <div className="so-card-title">STOCK ALLOCATION STATUS</div>
          <div className="so-alloc-boxes">
            <div className="so-alloc-box">
              <div className="so-alloc-label">Ordered</div>
              <div className="so-alloc-num text-dark">{orderDetails.ordered}</div>
            </div>
            <div className="so-alloc-box box-blue">
              <div className="so-alloc-label">Reserved</div>
              <div className="so-alloc-num text-blue">{orderDetails.reserved}</div>
            </div>
            <div className="so-alloc-box box-green">
              <div className="so-alloc-label">Dispatched</div>
              <div className="so-alloc-num text-green">{orderDetails.dispatched}</div>
            </div>
          </div>
          <div className="so-alloc-footer">
            Remaining to Dispatch: <span className="text-orange">{orderDetails.remaining}</span>
          </div>
        </div>

        {/* Card 3: Commercial Summary */}
        <div className="so-kpi-card">
          <div className="so-card-title">COMMERCIAL SUMMARY</div>
          <div className="so-comm-lines">
            <div className="so-comm-line">
              <span>Subtotal (Taxable):</span>
              <span className="so-comm-val">{orderDetails.subtotal}</span>
            </div>
            <div className="so-comm-line">
              <span>GST (18%):</span>
              <span className="so-comm-val">{orderDetails.gst}</span>
            </div>
            <div className="so-comm-line">
              <span>Freight:</span>
              <span className="so-comm-val">{orderDetails.freight}</span>
            </div>
            <div className="so-comm-line so-total-line">
              <span>Grand Total:</span>
              <span className="so-total-val">{orderDetails.grandTotal}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ordered Product Items Section */}
      <div className="so-section-card">
        <div className="so-section-header">
          <div className="so-section-title">
            Ordered Product Items ({orderDetails.items.length})
          </div>
        </div>

        <div className="so-table-wrap">
          <table className="so-table">
            <thead>
              <tr>
                <th>#</th>
                <th>PRODUCT DESCRIPTION</th>
                <th>DIA &amp; COLOR</th>
                <th>ORDERED QTY</th>
                <th>RESERVED</th>
                <th>DISPATCHED</th>
                <th>BALANCE</th>
                <th>RATE (₹)</th>
                <th>AMOUNT (₹)</th>
              </tr>
            </thead>
            <tbody>
              {orderDetails.items.map(item => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>
                    <div className="so-item-name">{item.desc}</div>
                    <div className="so-item-code">{item.code}</div>
                  </td>
                  <td>{item.diaColor}</td>
                  <td className="text-bold">{item.orderedQty}</td>
                  <td className="text-blue">{item.reserved}</td>
                  <td className="text-green">{item.dispatched}</td>
                  <td className="text-orange">{item.balance}</td>
                  <td>{item.rate}</td>
                  <td className="text-bold-dark">{item.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dispatches & Delivery Challans Issued Section */}
      <div className="so-section-card">
        <div className="so-section-header">
          <div className="so-section-title">
            <Truck size={16} className="text-green" /> Dispatches &amp; Delivery Challans Issued ({linkedDispatches.length})
          </div>
          <button className="so-btn-create-sm" onClick={onCreateDispatch}>
            + Create Dispatch
          </button>
        </div>

        {linkedDispatches.length > 0 ? (
          <div className="so-table-wrap">
            <table className="so-table">
              <thead>
                <tr>
                  <th>DISPATCH NO</th>
                  <th>DISPATCH DATE</th>
                  <th>CHALLAN NO</th>
                  <th>TAX INVOICE</th>
                  <th>DISPATCHED QTY</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {linkedDispatches.map(d => (
                  <tr key={d.id || d.dispatchNo}>
                    <td className="so-item-name">{d.dispatchNo || `DSP-2026-${d.id.slice(0, 4).toUpperCase()}`}</td>
                    <td>{d.date || '2026-08-26'}</td>
                    <td>{d.challanNo || 'DC-2026-0182'}</td>
                    <td>{d.taxInvoice || d.invoiceNo || 'INV-2026-0921'}</td>
                    <td className="text-green text-bold">{typeof d.dispatchedQtyCoils === 'number' ? `${d.dispatchedQtyCoils} Coils` : (d.dispatchedQty || '0 Coils')}</td>
                    <td><span className="so-status-badge pill-confirmed">• {d.status || 'DISPATCHED'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="so-empty-dispatches">
            No outward dispatches recorded yet for this order. Click "Create Dispatch" to generate delivery notes and e-way bill.
          </div>
        )}
      </div>
    </div>
  );
}
