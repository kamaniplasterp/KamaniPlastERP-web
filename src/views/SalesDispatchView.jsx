import { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  ShoppingCart, Truck, Download, Search, Plus, ArrowUpRight,
  FileText, ChevronRight, CheckCircle2, AlertTriangle, ArrowUpDown, Filter,
  BarChart3, ChevronDown, ChevronUp, Users, Package, SlidersHorizontal
} from 'lucide-react';
import SalesOrderModal from '../modals/SalesOrderModal';
import DispatchChallanModal from '../modals/DispatchChallanModal';
import SalesOrderDetailView from '../drawers/SalesOrderDetailView';
import HeaderInfoTooltip from '../components/HeaderInfoTooltip';
import PageHeader, { HeaderButton } from '../components/PageHeader';
import { useWorkflow } from '../context/WorkflowContext';
import { exportToCsv } from '../utils/exportCsv';
import { printTaxInvoice, printDeliveryChallan } from '../utils/printDocument';
import { subscribeSalesOrders, subscribeDispatches, createSalesOrder, createDispatch, updateDispatchValue } from '../api/sales.api';
import '../styles/SalesDispatch.css';



export default function SalesDispatchView({ onOpenSalesOrder, onOpenDispatchModal }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { openOrdersCount, globalSearch } = useWorkflow();

  const resolveTab = (t) => {
    if (!t) return 'orders';
    if (t === 'dispatch' || t === 'dispatches') return 'dispatches';
    return 'orders';
  };

  const [activeTab, setActiveTab] = useState(() => resolveTab(searchParams.get('tab') || location.state?.tab));
  const [selectedOrderId, setSelectedOrderId] = useState(location.state?.selectedOrderId || null);

  const [liveOrders, setLiveOrders] = useState([]);
  const [liveDispatches, setLiveDispatches] = useState([]);
  const [showMetrics, setShowMetrics] = useState(false);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || location.state?.tab;
    if (tabFromUrl) {
      setActiveTab(resolveTab(tabFromUrl));
    }
    if (location.state?.selectedOrderId) {
      setSelectedOrderId(location.state.selectedOrderId);
    }
  }, [searchParams, location.state]);

  useEffect(() => {
    const unsubSo = subscribeSalesOrders(setLiveOrders);
    const unsubDc = subscribeDispatches(setLiveDispatches);
    return () => {
      unsubSo();
      unsubDc();
    };
  }, []);

  // Auto-heal any 0-value dispatches in Firestore
  useEffect(() => {
    liveDispatches.forEach(d => {
      const currentVal = typeof d.totalValue === 'number' && d.totalValue > 0
        ? d.totalValue
        : (parseFloat(String(d.value || '').replace(/[^0-9.]/g, '')) || 0);

      if (currentVal <= 0 && d.id) {
        const qty = Number(d.dispatchedQtyCoils !== undefined ? d.dispatchedQtyCoils : (parseFloat(String(d.dispatchedQty || '').replace(/[^0-9.]/g, '')) || 0));
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

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [showOrderFilterPanel, setShowOrderFilterPanel] = useState(false);
  const [showDispatchFilterPanel, setShowDispatchFilterPanel] = useState(false);
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
    const ordQty = typeof o.orderedQtyCoils === 'number' ? o.orderedQtyCoils : (parseVal(o.orderedQty) || 0);
    const dispQty = typeof o.dispatchedCoils === 'number' ? o.dispatchedCoils : (typeof o.dispatchedQtyCoils === 'number' ? o.dispatchedQtyCoils : (parseVal(o.dispatched) || 0));
    if (o.status === 'COMPLETED' || (dispQty >= ordQty && ordQty > 0)) return sum;
    const balQty = Math.max(0, ordQty - dispQty);
    const res = typeof o.reservedQtyCoils === 'number'
      ? Math.min(o.reservedQtyCoils, balQty)
      : (typeof o.reservedCoils === 'number' ? Math.min(o.reservedCoils, balQty) : (parseVal(o.reserved) || balQty));
    return sum + (Number(res) || 0);
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


  const displaySalesOrders = liveOrders.map(o => {
    const { qty, grandTotal } = calcOrderTotals(o);
    const ordQty = typeof o.orderedQtyCoils === 'number' ? o.orderedQtyCoils : (parseVal(o.orderedQty) || qty);
    const dispQty = typeof o.dispatchedCoils === 'number' ? o.dispatchedCoils : (typeof o.dispatchedQtyCoils === 'number' ? o.dispatchedQtyCoils : (parseVal(o.dispatched) || 0));
    const balQty = typeof o.balanceCoils === 'number' ? o.balanceCoils : Math.max(0, ordQty - dispQty);
    const isCompleted = o.status === 'COMPLETED' || (dispQty >= ordQty && ordQty > 0);
    const resQty = isCompleted ? 0 : (
      typeof o.reservedQtyCoils === 'number' ? Math.min(o.reservedQtyCoils, balQty) :
      (typeof o.reservedCoils === 'number' ? Math.min(o.reservedCoils, balQty) : (parseVal(o.reserved) || balQty))
    );

    const orderDateStr = o.date || o.orderDate || (o.createdAt?.seconds ? new Date(o.createdAt.seconds * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    const expDateStr = o.expDate || (o.deliveryDate ? `Exp: ${o.deliveryDate}` : '');
    const formattedVal = o.orderValue && typeof o.orderValue === 'string' && o.orderValue.startsWith('₹') 
      ? o.orderValue 
      : `₹${grandTotal.toLocaleString('en-IN')}`;

    return {
      id: o.id,
      orderNo: o.orderNo || `SO-2026-${o.id.slice(0, 4).toUpperCase()}`,
      date: orderDateStr,
      orderDate: orderDateStr,
      customer: o.customer || '-',
      destination: o.destination || '-',
      poRef: o.poRef || '-',
      expDate: expDateStr,
      itemSummary: o.itemSummary || '-',
      orderedQty: `${ordQty} Coils`,
      reserved: `${resQty} Coils`,
      dispatched: `${dispQty} Coils`,
      balance: `${balQty} Coils`,
      orderValue: formattedVal,
      totalValue: formattedVal,
      status: isCompleted ? 'COMPLETED' : (o.status || 'STOCK RESERVED'),
      statusClass: isCompleted ? 'pill-completed' : (o.statusClass || 'pill-reserved')
    };
  });

  const uniqueCustomers = Array.from(new Set(displaySalesOrders.map(o => o.customer).filter(Boolean)));

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
      date: d.date || new Date().toISOString().split('T')[0],
      customer: d.customer || (linkedSo?.customer) || '-',
      orderRef: d.orderRef || (linkedSo?.orderNo) || '-',
      challanNo: d.challanNo || `DC-2026-${d.id.slice(0, 4).toUpperCase()}`,
      invoiceNo: d.invoiceNo || d.taxInvoice || `INV-2026-${d.id.slice(0, 4).toUpperCase()}`,
      ewayBill: d.ewayBill || '-',
      dispatchedQty: `${qty} Coils`,
      dispatchedQtyCoils: qty,
      totalValue: `₹${valNum.toLocaleString('en-IN')}`,
      totalValueNum: valNum,
      rate: d.rate || linkedSo?.rate || 0,
      itemSummary: d.itemSummary || linkedSo?.itemSummary || '-',
      vehicleNo: d.vehicleNo || d.vehicle || '-',
      transporter: d.transporter || '-',
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

  const isDispatches = activeTab === 'dispatches';
  const sdTitle = isDispatches ? 'Dispatches & Delivery Challans' : 'Sales Orders & Stock Allocation';
  const sdTooltip = isDispatches 
    ? 'Outward delivery challans, truck logistics, tax invoice tracking, and customer dispatch receipts.'
    : 'Sales booking, inventory allocation, delivery challan generation, and dispatch tracking.';
  const sdBadge = isDispatches ? `${liveDispatches.length} Shipments` : `${liveOrders.length} Open Orders`;
  const sdCrumbs = [
    { label: 'Sales & Dispatch', route: '/sales' },
    { label: isDispatches ? 'Dispatches & Delivery Challans' : 'Sales Orders & Allocation' }
  ];

  // Dynamic filter categories for Sales & Dispatch
  const orderFilterCategories = useMemo(() => [
    {
      id: 'status',
      label: 'Order Status',
      icon: CheckCircle2,
      allLabel: 'All Statuses',
      options: [
        { value: 'All', label: 'All Order Statuses' },
        { value: 'Confirmed', label: 'Confirmed / Reserved' },
        { value: 'Ready', label: 'Ready for Dispatch' },
        { value: 'Partially', label: 'Partially Dispatched' },
        { value: 'Completed', label: 'Completed / Dispatched' }
      ]
    },
    {
      id: 'customer',
      label: 'Customer',
      icon: Users,
      allLabel: 'All Customers',
      options: [
        { value: 'All', label: 'All Customers' },
        ...uniqueCustomers.map(c => ({ value: c, label: c }))
      ]
    }
  ], [uniqueCustomers]);

  const dispatchFilterCategories = useMemo(() => [
    {
      id: 'status',
      label: 'Dispatch Status',
      icon: Truck,
      allLabel: 'All Statuses',
      options: [
        { value: 'All', label: 'All Statuses' },
        { value: 'DISPATCHED', label: 'Dispatched' },
        { value: 'DELIVERED', label: 'Delivered' }
      ]
    }
  ], []);

  let sdSearchProps = null;
  let sdFilterProps = null;

  if (activeTab === 'orders') {
    sdSearchProps = {
      value: orderSearch,
      onChange: setOrderSearch,
      placeholder: 'Search Order No (SO-...), Customer, PO...'
    };
    sdFilterProps = {
      categories: orderFilterCategories,
      activeFilters: { status: orderStatusFilter, customer: orderCustomerFilter },
      onApply: (f) => {
        if (f.status !== undefined) setOrderStatusFilter(f.status);
        if (f.customer !== undefined) setOrderCustomerFilter(f.customer);
      },
      onReset: () => {
        setOrderStatusFilter('All');
        setOrderCustomerFilter('All');
      }
    };
  } else if (activeTab === 'dispatches') {
    sdSearchProps = {
      value: dispatchSearch,
      onChange: setDispatchSearch,
      placeholder: 'Search Dispatch No, Challan, Invoice, Customer...'
    };
    sdFilterProps = {
      categories: dispatchFilterCategories,
      activeFilters: { status: dispatchStatusFilter },
      onApply: (f) => {
        if (f.status !== undefined) setDispatchStatusFilter(f.status);
      },
      onReset: () => {
        setDispatchStatusFilter('All');
      }
    };
  }

  const renderSdActions = () => (
    <>
      <HeaderButton
        icon={Download}
        label="Export CSV"
        onClick={() => {
          if (isDispatches) exportToCsv('Delivery_Dispatches_Ledger.csv', filteredDispatches);
          else exportToCsv('Sales_Orders_Ledger.csv', filteredOrders);
        }}
        title="Export CSV"
      />

      <HeaderButton
        icon={BarChart3}
        label={showMetrics ? 'Hide Stats' : 'Show Stats'}
        onClick={() => setShowMetrics(prev => !prev)}
        active={showMetrics}
        title={showMetrics ? 'Hide summary KPI statistics' : 'Show summary KPI statistics'}
      />

      {isDispatches ? (
        <HeaderButton
          icon={Plus}
          label="Dispatch Challan"
          variant="primary"
          onClick={openDispatchChallan}
          title="Create Delivery Dispatch Challan"
        />
      ) : (
        <HeaderButton
          icon={Plus}
          label="New Sales Order"
          variant="primary"
          onClick={openNewSalesOrder}
          title="Book New Sales Order"
        />
      )}
    </>
  );

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

  return (
    <div className="sd-hub-container">
      {/* ── Standard Unified Page Header with Breadcrumbs ── */}
      <PageHeader
        breadcrumbs={sdCrumbs}
        title={sdTitle}
        tooltip={sdTooltip}
        searchProps={sdSearchProps}
        filterProps={sdFilterProps}
        actions={renderSdActions()}
      />

      {/* ── Contextual Metric Area (Toggleable, Hidden by default for minimal UI) ── */}
      {showMetrics && (
        <div className="sd-top-kpis">
        {activeTab === 'dispatches' ? (
          <>
            <div className="sd-kpi-card">
              <span className="sd-kpi-title">Executed Dispatches</span>
              <div className="sd-kpi-val-row">
                <span className="sd-kpi-num">{liveDispatches.length}</span>
                <span className="sd-kpi-sublabel">shipments</span>
              </div>
            </div>

            <div className="sd-kpi-card sd-kpi-highlight">
              <span className="sd-kpi-title" style={{ color: '#16a34a' }}>Quantity Delivered</span>
              <div className="sd-kpi-val-row">
                <span className="sd-kpi-num" style={{ color: '#16a34a' }}>
                  {liveDispatches.reduce((sum, d) => sum + (Number(d.qty) || Number(d.dispatchedQtyCoils) || 0), 0).toLocaleString()}
                </span>
                <span className="sd-kpi-sublabel">Coils</span>
              </div>
            </div>

            <div className="sd-kpi-card">
              <span className="sd-kpi-title">Total Invoiced Value</span>
              <div className="sd-kpi-val-row">
                <span className="sd-kpi-num">₹{totalDispatchedValLakhs}L</span>
                <span className="sd-kpi-sublabel" style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '500' }}>₹{totalDispatchedValInr.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="sd-kpi-card">
              <span className="sd-kpi-title">Open Orders</span>
              <div className="sd-kpi-val-row">
                <span className="sd-kpi-num">{liveOrders.filter(o => o.status !== 'COMPLETED').length}</span>
                <span className="sd-kpi-sublabel">pending</span>
              </div>
            </div>

            <div className="sd-kpi-card sd-kpi-highlight">
              <span className="sd-kpi-title" style={{ color: '#16a34a' }}>Ready for Dispatch</span>
              <div className="sd-kpi-val-row">
                <span className="sd-kpi-num" style={{ color: '#16a34a' }}>{totalReadyCoils.toLocaleString()}</span>
                <span className="sd-kpi-sublabel">Coils</span>
              </div>
            </div>

            <div className="sd-kpi-card">
              <span className="sd-kpi-title">Booked Pipeline Value</span>
              <div className="sd-kpi-val-row">
                <span className="sd-kpi-num">₹{totalBookedRevenueLakhs}L</span>
                <span className="sd-kpi-sublabel" style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: '500' }}>₹{totalBookedRevenueInr.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </>
        )}
      </div>
      )}



      {/* ── TAB 1: Sales Orders & Stock Allocation ── */}
      {activeTab === 'orders' && (
        <div className="sd-section-card">
          {/* Active Filter Chips */}
          {(orderStatusFilter !== 'All' || orderCustomerFilter !== 'All') && (
            <div className="jw-active-chips-row" style={{ marginBottom: '10px' }}>
              <span className="jw-active-chips-label">Active:</span>
              {orderStatusFilter !== 'All' && (
                <span className="jw-filter-chip">
                  Status: <strong>{orderStatusFilter}</strong>
                  <button type="button" onClick={() => setOrderStatusFilter('All')}><CheckCircle2 size={11} /></button>
                </span>
              )}
              {orderCustomerFilter !== 'All' && (
                <span className="jw-filter-chip">
                  Customer: <strong>{orderCustomerFilter}</strong>
                  <button type="button" onClick={() => setOrderCustomerFilter('All')}><CheckCircle2 size={11} /></button>
                </span>
              )}
              <button
                type="button"
                className="jw-clear-all-link"
                onClick={() => {
                  setOrderStatusFilter('All');
                  setOrderCustomerFilter('All');
                }}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Dark Header Table */}
          <div className="sd-table-container">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>ORDER NO ↕</th>
                  <th>ORDER DATE ↕</th>
                  <th>CUSTOMER &amp; DESTINATION</th>
                  <th>ITEMS SUMMARY</th>
                  <th style={{ textAlign: 'right' }}>ORDERED QTY</th>
                  <th style={{ textAlign: 'right' }}>RESERVED</th>
                  <th style={{ textAlign: 'right' }}>DISPATCHED</th>
                  <th style={{ textAlign: 'right' }}>BALANCE</th>
                  <th style={{ textAlign: 'right' }}>ORDER VALUE ↕</th>
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
                    <td className="td-date">{row.date || row.orderDate || '—'}</td>
                    <td>
                      <div className="td-cust-name">{row.customer}</div>
                      {row.expDate && <div className="sd-po-sub">{row.expDate}</div>}
                    </td>
                    <td className="td-items-col">
                      <div className="sd-item-main">{row.itemSummary}</div>
                      {row.moreItems && <div className="sd-items-more">{row.moreItems}</div>}
                    </td>
                    <td className="td-qty-bold" style={{ textAlign: 'right' }}>{row.orderedQty}</td>
                    <td className="td-qty-blue" style={{ textAlign: 'right' }}>{row.reserved}</td>
                    <td className="td-qty-green" style={{ textAlign: 'right' }}>{row.dispatched}</td>
                    <td className="td-qty-orange" style={{ textAlign: 'right' }}>{row.balance}</td>
                    <td className="td-order-val" style={{ textAlign: 'right' }}>{row.orderValue || row.totalValue || '—'}</td>
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
          {/* Active Filter Chips */}
          {dispatchStatusFilter !== 'All' && (
            <div className="jw-active-chips-row" style={{ marginBottom: '10px' }}>
              <span className="jw-active-chips-label">Active:</span>
              <span className="jw-filter-chip">
                Status: <strong>{dispatchStatusFilter}</strong>
                <button type="button" onClick={() => setDispatchStatusFilter('All')}><CheckCircle2 size={11} /></button>
              </span>
              <button
                type="button"
                className="jw-clear-all-link"
                onClick={() => setDispatchStatusFilter('All')}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Minimalist Light Table */}
          <div className="sd-table-container">
            <table className="sd-table">
              <thead>
                <tr>
                  <th>DISPATCH NO</th>
                  <th>DATE</th>
                  <th>CUSTOMER &amp; LOGISTICS</th>
                  <th>CHALLAN &amp; INVOICE</th>
                  <th style={{ textAlign: 'right' }}>DISPATCH QTY &amp; VALUE</th>
                  <th style={{ textAlign: 'center' }}>STATUS</th>
                  <th style={{ textAlign: 'center' }}>PRINT DOCUMENTS</th>
                </tr>
              </thead>
              <tbody>
                {filteredDispatches.map(row => (
                  <tr key={row.dispatchNo}>
                    <td className="td-order-num">{row.dispatchNo}</td>
                    <td className="td-date">{row.date}</td>
                    <td>
                      <div className="td-cust-name">{row.customer}</div>
                      <div className="sd-po-sub">{row.orderRef} • {row.vehicleNo || row.vehicle || 'Direct Delivery'}</div>
                    </td>
                    <td>
                      <div className="td-code" style={{ fontWeight: '700' }}>{row.challanNo}</div>
                      <div className="sd-po-sub">{row.invoiceNo || row.taxInvoice || 'INV-2026-549'}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="td-qty-green" style={{ fontWeight: '700' }}>{row.dispatchedQty}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: '500' }}>{row.totalValue || row.value}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="sd-status-pill pill-dispatched">
                        • {row.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="sd-action-group" style={{ justifyContent: 'center' }}>
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
