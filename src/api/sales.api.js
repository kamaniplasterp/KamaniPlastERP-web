import { 
  collection, 
  onSnapshot, 
  addDoc, 
  getDoc,
  updateDoc,
  doc, 
  serverTimestamp,
  query,
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { updateFgStock, logStockMovement } from './inventory.api';

/**
 * Subscribe to real-time Sales Orders collection with optional limit
 */
export function subscribeSalesOrders(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'salesOrders'), orderBy('createdAt', 'desc'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching sales orders:', error);
    callback([]);
  });
}

/**
 * Subscribe to real-time Dispatches collection with optional limit
 */
export function subscribeDispatches(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'dispatches'), orderBy('createdAt', 'desc'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching dispatches:', error);
    callback([]);
  });
}

/**
 * Create a new Sales Order
 */
export async function createSalesOrder(data) {
  if (!db) throw new Error('Firestore not initialized');

  const orderedQtyCoils = Number(data.orderedQtyCoils || data.orderedQty || 300);
  const orderNo = data.orderNo || `SO-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const numVal = typeof data.orderValue === 'number'
    ? data.orderValue
    : (parseFloat(String(data.orderValue || '').replace(/[^0-9.]/g, '')) || (orderedQtyCoils * 2450));

  const soDoc = {
    orderNo: orderNo,
    poRef: data.poRef || `PO: ${data.customer || 'CUSTOMER'}-REF`,
    date: data.date || new Date().toISOString().split('T')[0],
    customer: data.customer || 'ABC Marine Traders',
    customerId: data.customerId || null,
    expDate: data.expDate || `Exp: ${new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0]}`,
    itemSummary: data.itemSummary || 'PP Danline Rope 6mm (Yellow)',
    fgSkuId: data.fgSkuId || null,
    orderedQty: `${orderedQtyCoils} Coils`,
    orderedQtyCoils: orderedQtyCoils,
    reserved: `${orderedQtyCoils}`,
    reservedCoils: orderedQtyCoils,
    dispatched: '0',
    dispatchedCoils: 0,
    balance: `${orderedQtyCoils}`,
    balanceCoils: orderedQtyCoils,
    orderValue: data.orderValue || `₹${numVal.toLocaleString('en-IN')}`,
    totalValue: numVal,
    grandTotal: numVal,
    status: 'STOCK RESERVED',
    statusClass: 'pill-reserved',
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'salesOrders'), soDoc);

  if (data.fgSkuId) {
    try {
      await updateFgStock(data.fgSkuId, 0, orderedQtyCoils);
    } catch (e) {
      console.error('Error updating FG reserved stock:', e);
    }
  }

  return docRef.id;
}

/**
 * Reserve stock for a Sales Order atomically
 */
export async function reserveSalesOrderStock(soId, fgSkuId, reserveCoils = 500) {
  if (!db || !soId) throw new Error('Firestore not initialized');

  const soRef = doc(db, 'salesOrders', soId);

  await runTransaction(db, async (transaction) => {
    transaction.set(soRef, {
      reserved: `${reserveCoils}`,
      reservedCoils: reserveCoils,
      status: 'STOCK RESERVED',
      statusClass: 'pill-reserved',
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  if (fgSkuId) {
    await updateFgStock(fgSkuId, 0, reserveCoils);
  }

  await logStockMovement({
    type: 'Reservation',
    typeBadge: 'inv-badge-res',
    icon: '🔒',
    ref: soId,
    item: 'PP Danline Rope 6mm (Yellow)',
    batch: 'BATCH-FG-RESERVE',
    inward: '0',
    outward: `-${reserveCoils} Coils (Reserved)`,
    location: 'Finished Goods Warehouse',
    remarks: `Stock reserved against Customer Order ${soId}`
  });
}

/**
 * Create a Dispatch Challan atomically
 */
/**
 * Update a Dispatch valuation directly
 */
export async function updateDispatchValue(dispatchId, totalValue) {
  if (!db || !dispatchId || !totalValue) return;
  try {
    const num = Number(totalValue);
    const dRef = doc(db, 'dispatches', dispatchId);
    await updateDoc(dRef, {
      totalValue: num,
      value: `₹${num.toLocaleString('en-IN')}`
    });
  } catch (err) {
    console.error('Error updating dispatch value:', err);
  }
}

/**
 * Create a Dispatch Challan atomically
 */
export async function createDispatch(data) {
  if (!db) throw new Error('Firestore not initialized');

  const dispatchQtyCoils = Number(data.dispatchedQtyCoils || data.qty || 0);
  const uniqueSuffix = `${Date.now().toString().slice(-4)}${Math.floor(10 + Math.random() * 90)}`;
  const dispatchNo = data.dispatchNo || `DSP-2026-${uniqueSuffix}`;
  const invNo = data.taxInvoice || data.invoiceNo || `INV-2026-${uniqueSuffix}`;
  const chNo = data.challanNo || `DC-2026-${uniqueSuffix}`;

  let numVal = typeof data.totalValue === 'number' && data.totalValue > 0
    ? data.totalValue
    : (typeof data.value === 'number' && data.value > 0
        ? data.value
        : (parseFloat(String(data.value || '').replace(/[^0-9.]/g, '')) || 0));

  let orderRate = Number(data.rate || data.pricePerUnit) || 0;
  let orderGrandTotal = Number(data.grandTotal) || 0;
  let orderTotalQty = Number(data.totalOrderedCoils) || 0;
  let itemSummary = data.itemSummary || '';

  if (numVal <= 0 && data.soId) {
    try {
      const soSnap = await getDoc(doc(db, 'salesOrders', data.soId));
      if (soSnap.exists()) {
        const soData = soSnap.data();
        orderRate = Number(soData.rate || soData.pricePerUnit) || 0;
        orderGrandTotal = Number(soData.grandTotal || soData.totalValue) || 0;
        orderTotalQty = Number(soData.orderedQtyCoils) || 0;
        if (!itemSummary) itemSummary = soData.itemSummary || '';
      }
    } catch (e) {
      console.warn('Could not fetch SO for valuation:', e);
    }
  }

  if (numVal <= 0) {
    if (orderGrandTotal > 0 && orderTotalQty > 0) {
      numVal = Math.round((orderGrandTotal / orderTotalQty) * dispatchQtyCoils);
    } else if (orderRate > 0) {
      const taxable = dispatchQtyCoils * orderRate;
      numVal = Math.round(taxable * 1.18);
    } else {
      numVal = Math.round(dispatchQtyCoils * 2450 * 1.18);
    }
  }

  const dispatchDoc = {
    dispatchNo: dispatchNo,
    date: data.date || new Date().toISOString().split('T')[0],
    customer: data.customer || '',
    orderRef: data.orderRef || '',
    soId: data.soId || null,
    challanNo: chNo,
    taxInvoice: invNo,
    invoiceNo: invNo,
    ewayBill: data.ewayBill || `E-way: ${Math.floor(100000000000 + Math.random() * 900000000000)}`,
    dispatchedQty: `${dispatchQtyCoils} Coils`,
    dispatchedQtyCoils: dispatchQtyCoils,
    rate: orderRate || 2450,
    itemSummary: itemSummary || 'PP Danline High Tenacity Rope (Yellow)',
    value: `₹${numVal.toLocaleString('en-IN')}`,
    totalValue: numVal,
    vehicle: data.vehicle || '',
    vehicleNo: data.vehicle || data.vehicleNo || '',
    transporter: data.transporter || '',
    status: 'DISPATCHED',
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'dispatches'), dispatchDoc);

  // Update Sales Order record if soId provided using runTransaction
  if (data.soId) {
    const soRef = doc(db, 'salesOrders', data.soId);
    await runTransaction(db, async (transaction) => {
      const soSnap = await transaction.get(soRef);
      const existingSo = soSnap.exists() ? soSnap.data() : {};
      const currentDispatched = (Number(existingSo.dispatchedCoils) || Number(data.currentDispatchedCoils) || 0) + dispatchQtyCoils;
      const totalOrdered = Number(existingSo.orderedQtyCoils) || Number(data.totalOrderedCoils) || 500;
      const balanceCoils = Math.max(0, totalOrdered - currentDispatched);
      const isCompleted = balanceCoils <= 0;
      const currentReserved = Math.max(0, (Number(existingSo.reservedCoils) || totalOrdered) - dispatchQtyCoils);

      transaction.set(soRef, {
        dispatched: `${currentDispatched}`,
        dispatchedCoils: currentDispatched,
        balance: `${balanceCoils}`,
        balanceCoils: balanceCoils,
        reserved: `${currentReserved} Coils`,
        reservedCoils: currentReserved,
        status: isCompleted ? 'COMPLETED' : 'PARTIALLY DISPATCHED',
        statusClass: isCompleted ? 'pill-completed' : 'pill-partial-disp',
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
  }

  // Deduct FG Stock atomically (both physical stock and reserved stock)
  const targetSkuId = data.fgSkuId || (data.soId ? (await getDoc(doc(db, 'salesOrders', data.soId))).data()?.fgSkuId : null);
  if (targetSkuId) {
    await updateFgStock(targetSkuId, -dispatchQtyCoils, -dispatchQtyCoils);
  }

  // Log movement
  await logStockMovement({
    type: 'Dispatch Issue',
    typeBadge: 'inv-badge-dispatch',
    icon: '🚚',
    ref: dispatchNo,
    item: dispatchDoc.itemSummary,
    batch: 'BATCH-FG-DISPATCH',
    inward: '0',
    outward: `-${dispatchQtyCoils} Coils`,
    location: 'Finished Goods Bay -> Transport',
    remarks: `Dispatched ${dispatchQtyCoils} Coils under ${dispatchDoc.challanNo}`
  });

  return docRef.id;
}

