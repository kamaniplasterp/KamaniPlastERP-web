import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ShoppingCart, Truck, Download, Search, Plus, ArrowUpRight,
  FileText, ChevronRight, CheckCircle2, AlertTriangle, ArrowUpDown
} from 'lucide-react';
import SalesOrderModal from '../modals/SalesOrderModal';
import DispatchChallanModal from '../modals/DispatchChallanModal';
import SalesOrderDetailView from '../drawers/SalesOrderDetailView';
import { useWorkflow } from '../context/WorkflowContext';
import { exportToCsv } from '../utils/exportCsv';
import { printTaxInvoice, printDeliveryChallan } from '../utils/printDocument';
import { subscribeSalesOrders, subscribeDispatches, createSalesOrder, createDispatch, updateDispatchValue } from '../api/sales.api';
import '../styles/SalesDispatch.css';



export default function SalesDispatchView({ onOpenSalesOrder, onOpenDispatchModal }) {
  const location = useLocation();
  const { openOrdersCount } = useWorkflow();
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'orders');
  const [selectedOrderId, setSelectedOrderId] = useState(location.state?.selectedOrderId || null);

  const [liveOrders, setLiveOrders] = useState([]);
  const [liveDispatches, setLiveDispatches] = useState([]);

  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
    }
    if (location.state?.selectedOrderId) {
      setSelectedOrderId(location.state.selectedOrderId);
    }
  }, [location.state]);

  useEffect(() => {
    const unsubSo = subscribeSalesOrders(setLiveOrders);
    const unsubDc = subscribeDispatches(setLiveDispatches);
    return () => {
      unsubSo();
      unsubDc();
    };
  }, []);

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderCustomerFilter, setOrderCustomerFilter] = useState('All');
  const [dispatchSearch, setDispatchSearch] = useState('');
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState('All');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showDispatchChallanModal, setShowDispatchChallanModal] = useState(false);
  const [salesModalMode, setSalesModalMode] = useState('sales');

  const openNewSalesOrder = () => {
    if (onOpenSalesOrder) onOpenSalesOrder();
    else {
      setSalesModalMode('sales');
      setShowSalesModal(true);
    }
  };

  const openDispatchChallan = () => {
    if (onOpenDispatchModal) onOpenDispatchModal();
    else {
      setShowDispatchChallanModal(true);
    }
  };

  const exportToCsv = (filename, rows) => {
    if (!rows || !rows.length) return;
    const separator = ',';
    const keys = Object.keys(rows[0]);
    const csvContent =
      keys.join(separator) +
      '\n' +
      rows.map(row => {
        return keys.map(k => {
          let cell = row[k] === null || row[k] === undefined ? '' : row[k];
          cell = cell instanceof Date ? cell.toLocaleString() : cell.toString().replace(/"/g, '""');
          if (cell.search(/("|,|\n)/g) >= 0) {
            cell = `"${cell}"`;
          }
          return cell;
        }).join(separator);
      }).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (selectedOrderId) {
    return (
      <div className="sd-hub-container">
        <SalesOrderDetailView
          orderId={selectedOrderId}
          onBack={() => {
            setSelectedOrderId(null);
            if (window.history.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }}
          onCreateDispatch={() => {
            setShowDispatchChallanModal(true);
          }}
        />
        {showDispatchChallanModal && (
          <DispatchChallanModal
            defaultOrderId={selectedOrderId}
            onClose={() => setShowDispatchChallanModal(false)}
          />
        )}
      </div>
    );
  }

  const parseVal = (v) => {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const calcOrderTotals = (o) => {
    const qty = Number(o.orderedQtyCoils) || parseVal(o.orderedQty) || 0;
    const rate = Number(o.rate) || (o.items && o.items[0]?.rate ? parseVal(o.items[0].rate) : 2450);
    const taxable = (qty > 0 && rate > 0) ? (qty * rate) : (parseVal(o.taxableSubtotal) || parseVal(o.orderValue) || (qty * 2450));
    const gst = Math.round(taxable * 0.18);
    const freight = Number(o.freight) || 0;
    const grandTotal = taxable + gst + freight;
    return { qty, rate, taxable, gst, freight, grandTotal };
  };

  const totalBookedRevenueInr = liveOrders.reduce((sum, o) => {
    const { grandTotal } = calcOrderTotals(o);
    return sum + grandTotal;
  }, 0);
  const totalBookedRevenueLakhs = (totalBookedRevenueInr / 100000).toFixed(2);

  const totalReadyCoils = liveOrders.reduce((sum, o) => {
    return sum + (o.reservedCoils || parseVal(o.reserved) || parseVal(o.orderedQty) || 0);
  }, 0);

  const totalDispatchedValInr = liveDispatches.reduce((sum, d) => {
    let val = typeof d.totalValue === 'number' && d.totalValue > 0
      ? d.totalValue
      : (typeof d.value === 'number' && d.value > 0
          ? d.value
          : (parseFloat(String(d.value || '').replace(/[^0-9.]/g, '')) || 0));

    if (val <= 0) {
      const q = Number(d.dispatchedQtyCoils) || parseFloat(String(d.dispatchedQty || '').replace(/[^0-9.]/g, '')) || 0;
      const linkedSo = liveOrders.find(o => o.id === d.soId || o.orderNo === d.orderRef);
      if (linkedSo && linkedSo.grandTotal && linkedSo.orderedQtyCoils) {
        val = Math.round((Number(linkedSo.grandTotal) / Number(linkedSo.orderedQtyCoils)) * q);
      } else if (linkedSo && (linkedSo.rate || linkedSo.pricePerUnit)) {
        val = Math.round(q * Number(linkedSo.rate || linkedSo.pricePerUnit) * 1.18);
      } else {
        val = Math.round(q * 2450 * 1.18);
      }
    }
    return sum + (val || 0);
  }, 0);
  const totalDispatchedValLakhs = (totalDispatchedValInr / 100000).toFixed(2);

  // Auto-heal any 0-value dispatches in Firestore
  useEffect(() => {
    liveDispatches.forEach(d => {
      const currentVal = typeof d.totalValue === 'number' && d.totalValue > 0
        ? d.totalValue
        : (parseFloat(String(d.value || '').replace(/[^0-9.]/g, '')) || 0);

      if (currentVal <= 0 && d.id) {
        const qty = Number(d.dispatchedQtyCoils) || parseFloat(String(d.dispatchedQty || '').replace(/[^0-9.]/g, '')) || 200;
        const linkedSo = liveOrders.find(o => o.id === d.soId || o.orderNo === d.orderRef);
        let correctedVal = 0;
        if (linkedSo && linkedSo.grandTotal && linkedSo.orderedQtyCoils) {
          correctedVal = Math.round((Number(linkedSo.grandTotal) / Number(linkedSo.orderedQtyCoils)) * qty);
        } else if (linkedSo && (linkedSo.rate || linkedSo.pricePerUnit)) {
          correctedVal = Math.round(qty * Number(linkedSo.rate || linkedSo.pricePerUnit) * 1.18);
        } else {
          correctedVal = Math.round(qty * 2450 * 1.18);
        }
        if (correctedVal > 0) {
          updateDispatchValue(d.id, correctedVal);
        }
      }
    });
  }, [liveDispatches, liveOrders]);

  const displaySalesOrders = liveOrders.map(o => {
    const { qty, grandTotal } = calcOrderTotals(o);
    const ordQty = typeof o.orderedQtyCoils === 'number' ? o.orderedQtyCoils : (parseVal(o.orderedQty) || qty);
    const dispQty = typeof o.dispatchedCoils === 'number' ? o.dispatchedCoils : (parseVal(o.dispatched) || 0);
    const balQty = typeof o.balanceCoils === 'number' ? o.balanceCoils : Math.max(0, ordQty - dispQty);
    const isCompleted = o.status === 'COMPLETED' || (dispQty >= ordQty && ordQty > 0);
    const resQty = isCompleted ? 0 : (typeof o.reservedCoils === 'number' ? Math.min(o.reservedCoils, balQty) : balQty);

    return {
      id: o.id,
      orderNo: o.orderNo || `SO-2026-${o.id.slice(0, 4).toUpperCase()}`,
      orderDate: o.orderDate || o.date || '2026-08-26',
      customer: o.customer || 'ABC Marine Traders',
      destination: o.destination || 'Veraval, Gujarat',
      poRef: o.poRef || 'PO-2026-901',
      itemSummary: o.itemSummary || 'PP Danline Rope 6mm (Yellow)',
      orderedQty: `${ordQty} Coils`,
      reserved: `${resQty} Coils`,
      dispatched: `${dispQty} Coils`,
      balance: `${balQty} Coils`,
      totalValue: `₹${grandTotal.toLocaleString('en-IN')}`,
      status: isCompleted ? 'COMPLETED' : (o.status || 'STOCK RESERVED'),
      statusClass: isCompleted ? 'pill-completed' : (o.statusClass || 'pill-reserved')
    };
  });

  const uniqueCustomers = Array.from(new Set(displaySalesOrders.map(o => o.customer).filter(Boolean)));

  const { globalSearch } = useWorkflow();
  const activeOrderQuery = orderSearch || globalSearch || '';
  const activeDispatchQuery = dispatchSearch || globalSearch || '';

  const filteredOrders = displaySalesOrders.filter(o => {
    const matchesSearch =
      (o.orderNo || '').toLowerCase().includes(activeOrderQuery.toLowerCase()) ||
      (o.customer || '').toLowerCase().includes(activeOrderQuery.toLowerCase()) ||
      (o.poRef || '').toLowerCase().includes(activeOrderQuery.toLowerCase()) ||
      (o.itemSummary || '').toLowerCase().includes(activeOrderQuery.toLowerCase());

    const matchesStatus =
      orderStatusFilter === 'All' ||
      (orderStatusFilter === 'Confirmed' && (o.status.includes('CONFIRMED') || o.status.includes('RESERVED'))) ||
      (orderStatusFilter === 'Reserved' && o.status.includes('RESERVED')) ||
      (orderStatusFilter === 'Ready' && (o.status.includes('RESERVED') || o.status.includes('READY'))) ||
      (orderStatusFilter === 'Completed' && (o.status.includes('COMPLETED') || o.status.includes('DELIVERED'))) ||
      (orderStatusFilter === 'Partially' && o.status.includes('PARTIAL')) ||
      o.status.toLowerCase().includes(orderStatusFilter.toLowerCase());

    const matchesCustomer = orderCustomerFilter === 'All' || o.customer === orderCustomerFilter;

    return matchesSearch && matchesStatus && matchesCustomer;
  });

  const displayDispatches = liveDispatches.map(d => {
    const qty = typeof d.dispatchedQtyCoils === 'number' && d.dispatchedQtyCoils > 0
      ? d.dispatchedQtyCoils
      : (parseFloat(String(d.dispatchedQty || '').replace(/[^0-9.]/g, '')) || 0);

    let valNum = typeof d.totalValue === 'number' && d.totalValue > 0
      ? d.totalValue
      : (typeof d.value === 'number' && d.value > 0
          ? d.value
          : (parseFloat(String(d.value || '').replace(/[^0-9.]/g, '')) || 0));

    const linkedSo = liveOrders.find(o => o.id === d.soId || o.orderNo === d.orderRef);
    if (valNum <= 0 && qty > 0) {
      if (linkedSo && linkedSo.grandTotal && linkedSo.orderedQtyCoils) {
        valNum = Math.round((Number(linkedSo.grandTotal) / Number(linkedSo.orderedQtyCoils)) * qty);
      } else if (linkedSo && (linkedSo.rate || linkedSo.pricePerUnit)) {
        valNum = Math.round(qty * Number(linkedSo.rate || linkedSo.pricePerUnit) * 1.18);
      } else {
        valNum = Math.round(qty * 2450 * 1.18);
      }
    }

    return {
      id: d.id,
      dispatchNo: d.dispatchNo || `DSP-2026-${d.id.slice(0, 4).toUpperCase()}`,
      date: d.date || '2026-08-26',
      customer: d.customer || (linkedSo?.customer) || 'ABC Marine Traders',
      orderRef: d.orderRef || (linkedSo?.orderNo) || 'SO-2026-5601',
      challanNo: d.challanNo || `DC-2026-${d.id.slice(0, 4).toUpperCase()}`,
      invoiceNo: d.invoiceNo || d.taxInvoice || `INV-2026-${d.id.slice(0, 4).toUpperCase()}`,
      ewayBill: d.ewayBill || 'G00354008407',
      dispatchedQty: `${qty} Coils`,
      dispatchedQtyCoils: qty,
      totalValue: `₹${valNum.toLocaleString('en-IN')}`,
      totalValueNum: valNum,
      rate: d.rate || linkedSo?.rate || 2450,
      itemSummary: d.itemSummary || linkedSo?.itemSummary || 'PP Danline High Tenacity Rope (Yellow)',
      vehicleNo: d.vehicleNo || d.vehicle || 'GJ-03-BW-7821',
      transporter: d.transporter || 'Shree Saurashtra Roadlines',
      status: d.status || 'DISPATCHED',
      raw: { ...d, totalValue: valNum, value: `₹${valNum.toLocaleString('en-IN')}` }
    };
  });

  const filteredDispatches = displayDispatches.filter(d => {
    const matchesSearch =
      (d.dispatchNo || '').toLowerCase().includes(activeDispatchQuery.toLowerCase()) ||
      (d.challanNo || '').toLowerCase().includes(activeDispatchQuery.toLowerCase()) ||
      (d.invoiceNo || '').toLowerCase().includes(activeDispatchQuery.toLowerCase()) ||
      (d.customer || '').toLowerCase().includes(activeDispatchQuery.toLowerCase()) ||
      (d.vehicleNo || '').toLowerCase().includes(activeDispatchQuery.toLowerCase());

    const matchesStatus = dispatchStatusFilter === 'All' || d.status.toLowerCase().includes(dispatchStatusFilter.toLowerCase());

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="sd-hub-container">
      {/* ── Page Header ── */}
      <div className="sd-page-header">
        <div className="sd-header-left">
          <div className="sd-title-row">
            <h1 className="sd-page-title">Sales &amp; Dispatch Logistics Hub</h1>
            <span className="sd-badge-blue">{liveOrders.length} Open Orders</span>
          </div>
          <p className="sd-page-subtitle">
            End-to-end sales booking, inventory allocation, delivery challan generation, and dispatch tracking.
          </p>
        </div>

        <div className="sd-header-right">
          <button className="sd-btn-primary-blue" onClick={openNewSalesOrder}>
            <Plus size={15} /> New Sales Order
          </button>
          <button className="sd-btn-dark-head" onClick={openDispatchChallan}>
            <Plus size={15} /> Dispatch Challan
          </button>
        </div>
      </div>

      {/* ── Top 4 KPI Cards Grid ── */}
      <div className="sd-top-kpis">
        <div className="sd-kpi-card">
          <span className="sd-kpi-title">TOTAL BOOKED REVENUE</span>
          <div className="sd-kpi-val-row">
            <span className="sd-kpi-num">₹{totalBookedRevenueLakhs}L</span>
          </div>
        </div>

        <div className="sd-kpi-card">
          <span className="sd-kpi-title">READY FOR DISPATCH</span>
          <div className="sd-kpi-val-row">
            <span className="sd-kpi-num">{totalReadyCoils.toLocaleString()}</span>
            <span className="sd-kpi-sublabel">Coils</span>
          </div>
        </div>

        <div className="sd-kpi-card">
          <span className="sd-kpi-title">COMPLETED DISPATCHES</span>
          <div className="sd-kpi-val-row">
            <span className="sd-kpi-num">{liveDispatches.length}</span>
            <span className="sd-kpi-sublabel">shipments</span>
          </div>
        </div>

        <div className="sd-kpi-card">
          <span className="sd-kpi-title">DISPATCHED VALUE</span>
          <div className="sd-kpi-val-row">
            <span className="sd-kpi-num">₹{totalDispatchedValLakhs}L</span>
          </div>
        </div>
      </div>

      {/* ── Segmented Tab Bar ── */}
      <div className="sd-tab-bar">
        <button
          className={`sd-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <ShoppingCart size={14} />
          Sales Orders &amp; Stock Allocation
          <span className="sd-tab-badge">{liveOrders.length}</span>
        </button>

        <button
          className={`sd-tab-btn ${activeTab === 'dispatches' ? 'active' : ''}`}
          onClick={() => setActiveTab('dispatches')}
        >
          <Truck size={14} />
          Dispatches &amp; Delivery Challans
          <span className="sd-tab-badge">{liveDispatches.length}</span>
        </button>
      </div>

      {/* ── TAB 1: Sales Orders & Stock Allocation ── */}
      {activeTab === 'orders' && (
        <div className="sd-section-card">
          <div className="sd-section-header">
            <div className="sd-title-group">
              <div className="sd-title-row-inner">
                <h2 className="sd-section-title">Sales Orders Ledger</h2>
                <span className="sd-badge-purple">{liveOrders.length} Booked Orders</span>
              </div>
              <p className="sd-section-subtitle">
                Manage customer POs, finished goods stock reservations, partial dispatches, and delivery status.
              </p>
            </div>

            <div className="sd-header-right">
              <button className="sd-btn-ghost" onClick={() => exportToCsv('Sales_Orders_Ledger.csv', filteredOrders)} style={{ cursor: 'pointer' }}>
                <Download size={14} /> Export CSV
              </button>
              <button className="sd-btn-dark-pill" onClick={openNewSalesOrder}>
                <Plus size={14} /> New Sales Order
              </button>
            </div>
          </div>

          {/* 4 Summary KPI Cards Row */}
          <div className="sd-summary-kpi-grid">
            <div className="sd-skpi-card">
              <div className="sd-skpi-title">TOTAL BOOKED ORDERS</div>
              <div className="sd-skpi-val-row">
                <span className="sd-skpi-val">{liveOrders.length}</span>
              </div>
              <div className="sd-skpi-sub">Value: ₹{totalBookedRevenueLakhs} Lakhs</div>
            </div>

            <div className="sd-skpi-card">
              <div className="sd-skpi-title">OPEN PENDING ORDERS</div>
              <div className="sd-skpi-val-row">
                <span className="sd-skpi-val sd-text-blue">{liveOrders.filter(o => o.status !== 'COMPLETED').length}</span>
              </div>
              <div className="sd-skpi-sub">Awaiting fulfillment / dispatch</div>
            </div>

            <div className="sd-skpi-card sd-skpi-green">
              <div className="sd-skpi-title sd-skpi-title-green">READY TO DISPATCH</div>
              <div className="sd-skpi-val-row">
                <span className="sd-skpi-val sd-text-green">{liveOrders.filter(o => (o.reservedCoils || parseVal(o.reserved) || parseVal(o.orderedQty) || 0) > 0).length}</span>
              </div>
              <div className="sd-skpi-sub">Stock reserved &amp; ready</div>
            </div>

            <div className="sd-skpi-card">
              <div className="sd-skpi-title">TOTAL ORDER PIPELINE</div>
              <div className="sd-skpi-val-row">
                <span className="sd-skpi-val">₹{totalBookedRevenueInr.toLocaleString('en-IN')}</span>
              </div>
              <div className="sd-skpi-sub">Gross commercial bookings</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="sd-filter-bar">
            <div className="sd-search-input-wrap">
              <Search size={14} className="sd-search-icon" />
              <input
                type="text"
                placeholder="Search Order No (SO-...), Customer Name, PO Number..."
                className="sd-filter-search"
                value={orderSearch}
                onChange={e => setOrderSearch(e.target.value)}
              />
            </div>

            <select
              className="sd-filter-select"
              value={orderStatusFilter}
              onChange={e => setOrderStatusFilter(e.target.value)}
            >
              <option value="All">All Order Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Reserved">Stock Reserved</option>
              <option value="Ready">Ready to Dispatch</option>
              <option value="Completed">Completed</option>
              <option value="Partially">Partially Dispatched</option>
            </select>

            <select
              className="sd-filter-select"
              value={orderCustomerFilter}
              onChange={e => setOrderCustomerFilter(e.target.value)}
            >
              <option value="All">All Customers</option>
              {uniqueCustomers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Dark Header Table */}
          <div className="sd-table-container">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>ORDER NO ↕</th>
                  <th>ORDER DATE ↕</th>
                  <th>CUSTOMER &amp; DESTINATION</th>
                  <th>ITEMS SUMMARY</th>
                  <th>ORDERED QTY</th>
                  <th>RESERVED</th>
                  <th>DISPATCHED</th>
                  <th>BALANCE</th>
                  <th>ORDER VALUE ↕</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(row => (
                  <tr
                    key={row.orderNo}
                    onClick={() => setSelectedOrderId(row.orderNo)}
                    style={{ cursor: 'pointer' }}
                    title={`Click to open Sales Order Detail page for ${row.orderNo}`}
                  >
                    <td className="td-order-num">
                      <span className="sd-id-link">{row.orderNo}</span>
                      <span className="sd-po-sub">{row.poRef}</span>
                    </td>
                    <td className="td-date">{row.date}</td>
                    <td>
                      <div className="td-cust-name">{row.customer}</div>
                      <div className="sd-po-sub">{row.expDate}</div>
                    </td>
                    <td className="td-items-col">
                      <div className="sd-item-main">{row.itemSummary}</div>
                      {row.moreItems && <div className="sd-items-more">{row.moreItems}</div>}
                    </td>
                    <td className="td-qty-bold">{row.orderedQty}</td>
                    <td className="td-qty-blue">{row.reserved}</td>
                    <td className="td-qty-green">{row.dispatched}</td>
                    <td className="td-qty-orange">{row.balance}</td>
                    <td className="td-order-val">{row.orderValue}</td>
                    <td>
                      <span className={`sd-status-pill ${row.statusClass}`}>
                        • {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="sd-action-group" onClick={e => e.stopPropagation()}>
                        <button className="sd-btn-dispatch" onClick={openDispatchChallan}>
                          Dispatch
                        </button>
                        <button
                          className="sd-icon-action"
                          title="View Sales Order Details"
                          onClick={() => setSelectedOrderId(row.orderNo || row.id)}
                        >
                          <ChevronRight size={14} />
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

      {/* ── TAB 2: Dispatches & Delivery Challans ── */}
      {activeTab === 'dispatches' && (
        <div className="sd-section-card">
          <div className="sd-section-header">
            <div className="sd-title-group">
              <div className="sd-title-row-inner">
                <h2 className="sd-section-title">Dispatch &amp; Delivery Challan Registry</h2>
                <span className="sd-badge-green">{liveDispatches.length} Outward Consignments</span>
              </div>
              <p className="sd-section-subtitle">
                Generate delivery challans, GST tax invoices, E-Way bills, and transport vehicle gate passes for customer deliveries.
              </p>
            </div>

            <div className="sd-header-right">
              <button className="sd-btn-ghost" onClick={() => exportToCsv('Delivery_Dispatches_Ledger.csv', filteredDispatches)} style={{ cursor: 'pointer' }}>
                <Download size={14} /> Export CSV
              </button>
              <button className="sd-btn-dark-pill" onClick={openDispatchChallan}>
                <Plus size={14} /> New Dispatch Challan
              </button>
            </div>
          </div>

          {/* 3 Summary KPI Cards Row */}
          <div className="sd-summary-kpi-grid">
            <div className="sd-skpi-card">
              <div className="sd-skpi-title">TOTAL DISPATCHES EXECUTED</div>
              <div className="sd-skpi-val-row">
                <span className="sd-skpi-val">{liveDispatches.length}</span>
              </div>
              <div className="sd-skpi-sub">With full statutory compliance</div>
            </div>

            <div className="sd-skpi-card sd-skpi-green">
              <div className="sd-skpi-title sd-skpi-title-green">TOTAL QUANTITY DELIVERED</div>
              <div className="sd-skpi-val-row">
                <span className="sd-skpi-val sd-text-green">
                  {liveDispatches.reduce((sum, d) => sum + (Number(d.qty) || Number(d.dispatchedQtyCoils) || 0), 0)}
                </span>
                <span className="sd-skpi-unit">Coils</span>
              </div>
              <div className="sd-skpi-sub">Dispatched to customer docks</div>
            </div>

            <div className="sd-skpi-card">
              <div className="sd-skpi-title">TOTAL DISPATCHED VALUE</div>
              <div className="sd-skpi-val-row">
                <span className="sd-skpi-val">
                  ₹{totalDispatchedValInr.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="sd-skpi-sub">Invoiced customer revenue</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="sd-filter-bar">
            <div className="sd-search-input-wrap">
              <Search size={14} className="sd-search-icon" />
              <input
                type="text"
                placeholder="Search Dispatch No, Challan No (DC-...), Tax Invoice (INV-...), Vehicle, Customer..."
                className="sd-filter-search"
                value={dispatchSearch}
                onChange={e => setDispatchSearch(e.target.value)}
              />
            </div>

            <select
              className="sd-filter-select"
              value={dispatchStatusFilter}
              onChange={e => setDispatchStatusFilter(e.target.value)}
            >
              <option value="All">All Dispatch Statuses</option>
              <option value="Dispatched">Dispatched</option>
              <option value="In Transit">In Transit</option>
              <option value="Delivered">Delivered</option>
            </select>
          </div>

          {/* Dark Header Table */}
          <div className="sd-table-container">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>DISPATCH NO</th>
                  <th>DATE</th>
                  <th>CUSTOMER &amp; ORDER REF</th>
                  <th>DELIVERY CHALLAN</th>
                  <th>TAX INVOICE</th>
                  <th>DISPATCHED QTY</th>
                  <th>VALUE (₹)</th>
                  <th>TRANSPORTER &amp; VEHICLE</th>
                  <th>STATUS</th>
                  <th>PRINT DOCUMENTS</th>
                </tr>
              </thead>
              <tbody>
                {filteredDispatches.map(row => (
                  <tr key={row.dispatchNo}>
                    <td className="td-order-num">{row.dispatchNo}</td>
                    <td className="td-date">{row.date}</td>
                    <td>
                      <div className="td-cust-name">{row.customer}</div>
                      <div className="sd-po-sub">{row.orderRef}</div>
                    </td>
                    <td className="td-code">{row.challanNo}</td>
                    <td>
                      <div className="inv-item-name">{row.invoiceNo || row.taxInvoice || 'INV-2026-549'}</div>
                      <div className="sd-po-sub">{row.ewayBill}</div>
                    </td>
                    <td className="td-qty-green">{row.dispatchedQty}</td>
                    <td className="td-order-val">{row.totalValue || row.value}</td>
                    <td>
                      <div className="sd-item-main">{row.vehicleNo || row.vehicle}</div>
                      <div className="sd-po-sub">{row.transporter}</div>
                    </td>
                    <td>
                      <span className="sd-status-pill pill-dispatched">
                        • {row.status}
                      </span>
                    </td>
                    <td>
                      <div className="sd-action-group">
                        <button className="sd-btn-doc-dark" title="Print Delivery Challan" onClick={() => printDeliveryChallan({ ...row, ...(row.raw || {}) })}>
                          Challan
                        </button>
                        <button className="sd-btn-doc" title="Print GST Tax Invoice" onClick={() => printTaxInvoice({ ...row, ...(row.raw || {}), grandTotal: row.totalValueNum, totalValue: row.totalValueNum })}>
                          Invoice
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

      {/* ── Local Modals ── */}
      {showSalesModal && (
        <SalesOrderModal
          mode={salesModalMode}
          onClose={() => setShowSalesModal(false)}
        />
      )}
      {showDispatchChallanModal && (
        <DispatchChallanModal onClose={() => setShowDispatchChallanModal(false)} />
      )}
    </div>
  );
}
