import { useState, useEffect } from 'react';
import { X, Truck } from 'lucide-react';
import { createDispatch, subscribeSalesOrders } from '../api/sales.api';
import '../styles/Modals.css';

export default function DispatchChallanModal({ onClose, onSave, defaultOrderId }) {
  const [liveSalesOrders, setLiveSalesOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(defaultOrderId || '');
  const [quantities, setQuantities] = useState({});

  const parseBal = (so) => {
    if (!so) return 0;
    if (typeof so.balanceCoils === 'number') return so.balanceCoils;
    const n = parseFloat(String(so.balance || '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? (Number(so.orderedQtyCoils || 300) - Number(so.dispatchedCoils || 0)) : n;
  };

  useEffect(() => {
    const unsubSo = subscribeSalesOrders((list) => {
      setLiveSalesOrders(list);
      const openOnly = list.filter(o => parseBal(o) > 0 || (o.status !== 'COMPLETED' && o.status !== 'DELIVERED'));
      if (openOnly.length > 0 && !selectedOrder) {
        const first = openOnly[0];
        const selId = first.orderNo || first.id;
        setSelectedOrder(selId);
        const bal = parseBal(first);
        setQuantities({ [first.id || first.orderNo || 'item1']: bal });
      }
    });
    return () => unsubSo();
  }, []);

  const openSalesOrders = liveSalesOrders.filter(o => parseBal(o) > 0 || (o.status !== 'COMPLETED' && o.status !== 'DELIVERED'));
  const currentOrderObj = liveSalesOrders.find(o => (o.orderNo || o.id) === selectedOrder) || openSalesOrders[0] || liveSalesOrders[0];

  const handleOrderChange = (orderId) => {
    setSelectedOrder(orderId);
    const obj = liveSalesOrders.find(o => (o.orderNo || o.id) === orderId);
    if (obj) {
      const bal = parseBal(obj);
      setQuantities({ [obj.id || obj.orderNo || 'item1']: bal });
    }
  };

  const handleQtyChange = (itemId, val) => {
    setQuantities(prev => ({ ...prev, [itemId]: val }));
  };

  const [form, setForm] = useState({
    transporter: 'Shree Saurashtra Roadlines',
    vehicleNo: '',
    driverName: '',
    driverMobile: '',
    lrNumber: '',
    remarks: ''
  });

  const handleChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const targetOrder = currentOrderObj || {};
    const itemId = targetOrder.id || targetOrder.orderNo || 'item1';
    const remainingBalance = parseBal(targetOrder);
    const enteredQty = Number(quantities[itemId] !== undefined ? quantities[itemId] : remainingBalance);

    if (enteredQty <= 0) {
      alert('Please enter a valid dispatch quantity greater than 0 Coils.');
      return;
    }

    if (remainingBalance > 0 && enteredQty > remainingBalance) {
      alert(`Cannot dispatch ${enteredQty} Coils! Remaining balance on order is only ${remainingBalance} Coils.`);
      return;
    }

    try {
      if (onSave) {
        await onSave({ orderId: selectedOrder, quantities, ...form });
      } else {
        await createDispatch({
          soId: targetOrder.id,
          customer: targetOrder.customer || 'Customer',
          orderRef: targetOrder.orderNo || `Ref: ${selectedOrder}`,
          dispatchedQtyCoils: enteredQty,
          totalOrderedCoils: targetOrder.orderedQtyCoils || enteredQty,
          currentDispatchedCoils: targetOrder.dispatchedCoils || 0,
          fgSkuId: targetOrder.fgSkuId || null,
          vehicle: form.vehicleNo || 'GJ-03-BW-5544',
          vehicleNo: form.vehicleNo || 'GJ-03-BW-5544',
          transporter: form.transporter || 'Shree Saurashtra Roadlines'
        });
      }
      alert(`Outward Dispatch Challan for ${targetOrder.customer || 'Customer'} generated successfully!`);
    } catch (err) {
      console.error('Error creating dispatch:', err);
    }
    onClose();
  };

  const remainingCoils = parseBal(currentOrderObj);
  const activeItems = currentOrderObj ? [{
    id: currentOrderObj.id || currentOrderObj.orderNo || 'item1',
    name: currentOrderObj.itemSummary || 'HDPE / PP Danline Rope',
    total: currentOrderObj.orderedQty || `${currentOrderObj.orderedQtyCoils || 0} Coils`,
    dispatched: currentOrderObj.dispatched || `${currentOrderObj.dispatchedCoils || 0} Coils`,
    balance: `${remainingCoils} Coils`,
    balanceNum: remainingCoils,
    unit: 'Coils'
  }] : [];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md">
        {/* Dark Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
              <Truck size={16} />
            </div>
            <div>
              <h2 className="modal-title">Generate Outward Dispatch Challan</h2>
              <p className="modal-subtitle">Creates Delivery Challan, GST Tax Invoice, and E-Way Bill record.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Target Sales Order Select */}
          <div className="mform-field">
            <label className="mform-label">Target Sales Order <span className="req">*</span></label>
            <select
              className="mform-select"
              value={selectedOrder}
              onChange={e => handleOrderChange(e.target.value)}
              required
            >
              <option value="">-- Select Sales Order --</option>
              {openSalesOrders.length > 0 ? (
                openSalesOrders.map(so => (
                  <option key={so.id} value={so.orderNo || so.id}>
                    {so.orderNo || so.id} – {so.customer} (Bal: {parseBal(so)} Coils)
                  </option>
                ))
              ) : (
                liveSalesOrders.map(so => (
                  <option key={so.id} value={so.orderNo || so.id}>
                    {so.orderNo || so.id} – {so.customer} (Bal: {parseBal(so)} Coils)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Select Quantity to Dispatch Box */}
          <div className="dispatch-items-box">
            <div className="dispatch-items-title">SELECT QUANTITY TO DISPATCH</div>
            {activeItems.map(item => (
              <div key={item.id} className="dispatch-item-row">
                <div className="dispatch-item-info">
                  <div className="dispatch-item-name">{item.name}</div>
                  <div className="dispatch-item-sub">
                    Total Order: {item.total} | Dispatched: {item.dispatched} | Balance: <span style={{ color: '#f97316', fontWeight: '800' }}>{item.balance}</span>
                  </div>
                </div>
                <div className="dispatch-qty-wrap">
                  <span className="dispatch-qty-label">Dispatch Qty</span>
                  <input
                    type="number"
                    className="dispatch-qty-input"
                    max={item.balanceNum > 0 ? item.balanceNum : undefined}
                    min="1"
                    value={quantities[item.id] !== undefined ? quantities[item.id] : item.balanceNum}
                    onChange={e => handleQtyChange(item.id, e.target.value)}
                    required
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Transporter & Vehicle Number */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Transporter Name <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                value={form.transporter}
                onChange={e => handleChange('transporter', e.target.value)}
                placeholder="e.g. Shree Saurashtra Roadlines"
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Vehicle Number <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                value={form.vehicleNo}
                onChange={e => handleChange('vehicleNo', e.target.value)}
                placeholder="e.g. GJ-03-BW-7821"
                required
              />
            </div>
          </div>

          {/* Driver Name, Driver Mobile, LR Number */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Driver Name</label>
              <input
                type="text"
                className="mform-input"
                value={form.driverName}
                onChange={e => handleChange('driverName', e.target.value)}
                placeholder="e.g. Rameshwar Yadav"
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Driver Mobile</label>
              <input
                type="text"
                className="mform-input"
                value={form.driverMobile}
                onChange={e => handleChange('driverMobile', e.target.value)}
                placeholder="e.g. +91 98980 12345"
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">LR / Bilty Number</label>
              <input
                type="text"
                className="mform-input"
                value={form.lrNumber}
                onChange={e => handleChange('lrNumber', e.target.value)}
                placeholder="e.g. LR-2026-5967"
              />
            </div>
          </div>

          {/* Gate Pass & Security Remarks */}
          <div className="mform-field">
            <label className="mform-label">Gate Pass &amp; Security Remarks</label>
            <input
              type="text"
              className="mform-input"
              value={form.remarks}
              onChange={e => handleChange('remarks', e.target.value)}
              placeholder="Enter security & loading gate remarks..."
            />
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mfooter-btn green-btn">
              Issue Dispatch &amp; Gate Pass
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
