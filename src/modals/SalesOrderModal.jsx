import { useState, useEffect } from 'react';
import { X, ShoppingCart, Plus, Trash2 } from 'lucide-react';
import { createSalesOrder } from '../api/sales.api';
import { subscribeBuyers } from '../api/directory.api';
import { subscribeFinishedGoods } from '../api/inventory.api';
import '../styles/Modals.css';

const GST_RATE = 0.18;

function today() { return new Date().toISOString().split('T')[0]; }
function addDays(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function genPO() {
  return `PO-2026-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function createLine() {
  return { id: `line_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`, productId: '', qty: '200', rate: '' };
}

export default function SalesOrderModal({ onClose, onSave, mode = 'sales' }) {
  const isDispatch = mode === 'dispatch';
  const [liveBuyers, setLiveBuyers] = useState([]);
  const [liveProducts, setLiveProducts] = useState([]);

  useEffect(() => {
    const unsubBu = subscribeBuyers(setLiveBuyers);
    const unsubFg = subscribeFinishedGoods(setLiveProducts);
    return () => {
      unsubBu();
      unsubFg();
    };
  }, []);

  const [form, setForm] = useState({
    customer: '',
    poNumber: genPO(),
    dispatchDate: addDays(7),
    paymentTerms: '30 Days Credit',
    remarks: '',
    freight: 1500,
  });

  const [lines, setLines] = useState([createLine()]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const setLine = (id, key, val) =>
    setLines(ls => ls.map(l => l.id === id ? { ...l, [key]: val } : l));

  const handleProductChange = (lineId, productId) => {
    const prod = liveProducts.find(p => p.id === productId);
    setLines(ls => ls.map(l => {
      if (l.id !== lineId) return l;
      return {
        ...l,
        productId,
        rate: prod && prod.rate !== undefined ? String(prod.rate) : l.rate
      };
    }));
  };

  const addLine = () => setLines(ls => [...ls, createLine()]);
  const removeLine = (id) => setLines(ls => ls.filter(l => l.id !== id));

  const lineAmounts = lines.map(l => (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0));
  const taxable = lineAmounts.reduce((s, v) => s + v, 0);
  const gst = taxable * GST_RATE;
  const freight = parseFloat(form.freight) || 0;
  const orderTotal = taxable + gst + freight;

  useEffect(() => {
    const handle = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selBuyer = liveBuyers.find(c => c.id === form.customer);
    const custLabel = selBuyer ? selBuyer.name : (form.customer || 'Customer');
    const firstLine = lines[0];
    const qtyVal = Number(firstLine?.qty || 0);
    const rateVal = Number(firstLine?.rate || 0);
    const selProduct = liveProducts.find(p => p.id === firstLine?.productId) || null;

    try {
      const payload = {
        orderNo: `SO-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        customer: custLabel,
        customerId: form.customer || null,
        poRef: form.poNumber,
        orderedQtyCoils: qtyVal,
        orderedQty: `${qtyVal} Coils`,
        rate: rateVal,
        pricePerUnit: rateVal,
        taxableSubtotal: taxable,
        gst: gst,
        freight: freight,
        orderValue: `₹${orderTotal.toLocaleString('en-IN')}`,
        grandTotal: orderTotal,
        totalValue: orderTotal,
        fgSkuId: selProduct ? (selProduct.id || selProduct.code) : '',
        fgSkuCode: selProduct ? (selProduct.code || '') : '',
        itemSummary: selProduct ? selProduct.name : '',
        status: 'STOCK RESERVED',
        reservedCoils: qtyVal,
        dispatchedCoils: 0,
        balanceCoils: qtyVal,
        date: today(),
        deliveryDate: form.dispatchDate,
        paymentTerms: form.paymentTerms,
        remarks: form.remarks
      };
      if (onSave) {
        await onSave(payload);
      } else {
        await createSalesOrder(payload);
      }
      alert(`${isDispatch ? 'Dispatch Order' : 'Sales Order'} confirmed for ${custLabel}!`);
    } catch (err) {
      console.error('Error creating sales order:', err);
    }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md">
        {/* Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon">
              <ShoppingCart size={16} />
            </div>
            <div>
              <h2 className="modal-title">
                {isDispatch ? 'Create Dispatch Order' : 'Book New Customer Sales Order'}
              </h2>
              <p className="modal-subtitle">
                {isDispatch
                  ? 'Create dispatch challan, allocate finished goods stock for delivery.'
                  : 'Create order proforma, check finished goods stock, and allocate stock.'}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Row 1 */}
          <div className="mform-row mform-col-3">
            <div className="mform-field">
              <label className="mform-label">Customer <span className="req">*</span></label>
              <select className="mform-select" value={form.customer} onChange={e => set('customer', e.target.value)} required>
                <option value="">-- Select Customer --</option>
                {liveBuyers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Buyer'} ({c.location || 'Gujarat'})
                  </option>
                ))}
              </select>
            </div>
            <div className="mform-field">
              <label className="mform-label">Customer PO Number <span className="req">*</span></label>
              <input type="text" className="mform-input" value={form.poNumber} onChange={e => set('poNumber', e.target.value)} required placeholder="PO-2026-XXXX" />
            </div>
            <div className="mform-field">
              <label className="mform-label">Target Dispatch Date <span className="req">*</span></label>
              <input type="date" className="mform-input" value={form.dispatchDate} onChange={e => set('dispatchDate', e.target.value)} required />
            </div>
          </div>

          {/* Order Line Items */}
          <div className="mform-section-header">
            <span className="mform-section-plain-title">ORDER LINE ITEMS</span>
            <button type="button" className="mform-add-line-btn" onClick={addLine}>
              <Plus size={13} /> Add Product Line
            </button>
          </div>

          <div className="mform-lines">
            {lines.map((line, idx) => {
              const prod = liveProducts.find(p => p.id === line.productId || p.code === line.productId) || {};
              const amount = (parseFloat(line.qty) || 0) * (parseFloat(line.rate) || 0);
              return (
                <div key={line.id} className="mform-line-item">
                  <div className="mform-line-grid">
                    <div className="mform-field mform-field-wide">
                      <label className="mform-label-sm">Product SKU</label>
                      <select
                        className="mform-select mform-select-sm"
                        value={line.productId}
                        onChange={e => handleProductChange(line.id, e.target.value)}
                      >
                        <option value="">-- Select Product --</option>
                        {liveProducts.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name || 'Finished Good'} ({p.code || p.id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mform-field">
                      <label className="mform-label-sm">Quantity</label>
                      <input type="number" className="mform-input mform-input-sm" value={line.qty}
                        onChange={e => setLine(line.id, 'qty', e.target.value)} min="1" placeholder="0" />
                    </div>
                    <div className="mform-field">
                      <label className="mform-label-sm">Rate (₹)</label>
                      <input type="number" className="mform-input mform-input-sm" value={line.rate}
                        onChange={e => setLine(line.id, 'rate', e.target.value)} min="0" step="0.01" placeholder="0.00" />
                    </div>
                    <div className="mform-field">
                      <label className="mform-label-sm">Amount</label>
                      <div className="mform-amount-display">
                        ₹{amount > 0 ? amount.toLocaleString('en-IN') : '0'}
                      </div>
                    </div>
                    {lines.length > 1 && (
                      <button type="button" className="mform-remove-line" onClick={() => removeLine(line.id)}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  {prod.id && (
                    <div className="mform-hint" style={{ marginTop: '6px' }}>
                      Free Stock in Godown: <span className="hint-blue">{prod.stockQty || 0} Coils</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom: Terms + Summary */}
          <div className="mform-row mform-col-2-auto">
            {/* Left: Payment Terms + Remarks */}
            <div className="mform-col-group">
              <div className="mform-field">
                <label className="mform-label">Payment &amp; Dispatch Terms</label>
                <input type="text" className="mform-input" value={form.paymentTerms}
                  onChange={e => set('paymentTerms', e.target.value)} placeholder="e.g. 30 Days Credit" />
              </div>
              <div className="mform-field">
                <label className="mform-label">Customer Order Remarks</label>
                <textarea className="mform-textarea" rows={3} value={form.remarks}
                  onChange={e => set('remarks', e.target.value)}
                  placeholder="Packaging instructions, BIS tags, special requirements..." />
              </div>
            </div>

            {/* Right: Order Summary */}
            <div className="mform-summary-box">
              <div className="summary-row">
                <span className="summary-label">Taxable Amount:</span>
                <span className="summary-val">₹{taxable.toLocaleString('en-IN')}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">GST (18%):</span>
                <span className="summary-val summary-gst">₹{gst.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
              <div className="summary-row">
                <span className="summary-label">Freight / Loading Charges</span>
                <input
                  type="number" className="summary-freight-input"
                  value={form.freight} onChange={e => set('freight', e.target.value)}
                  min="0"
                />
              </div>
              <div className="summary-divider" />
              <div className="summary-row summary-total-row">
                <span className="summary-total-label">Order Total:</span>
                <span className="summary-total-val">₹{orderTotal.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="mfooter-btn confirm">
              {isDispatch ? 'Confirm & Create Dispatch' : 'Confirm & Book Sales Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
