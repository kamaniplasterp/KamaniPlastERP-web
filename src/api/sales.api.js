import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { updateFgStock, logStockMovement } from './inventory.api';

/**
 * Subscribe to real-time Sales Orders collection
 */
export function subscribeSalesOrders(callback) {
  if (!db) return () => {};
  const q = query(collection(db, 'salesOrders'), orderBy('createdAt', 'desc'));
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
 * Subscribe to real-time Dispatches collection
 */
export function subscribeDispatches(callback) {
  if (!db) return () => {};
  const q = query(collection(db, 'dispatches'), orderBy('createdAt', 'desc'));
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
 * Reserve stock for a Sales Order
 */
export async function reserveSalesOrderStock(soId, fgSkuId, reserveCoils = 500) {
  if (!db || !soId) throw new Error('Firestore not initialized');

  const soRef = doc(db, 'salesOrders', soId);
  await updateDoc(soRef, {
    reserved: `${reserveCoils}`,
    reservedCoils: reserveCoils,
    status: 'STOCK RESERVED',
    statusClass: 'pill-reserved',
    updatedAt: serverTimestamp()
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
 * Create a Dispatch Challan
 */
export async function createDispatch(data) {
  if (!db) throw new Error('Firestore not initialized');

  const dispatchQtyCoils = Number(data.dispatchedQtyCoils || data.qty || 300);
  const dispatchNo = data.dispatchNo || `DSP-2026-${Math.floor(10000 + Math.random() * 90000)}`;

  const dispatchDoc = {
    dispatchNo: dispatchNo,
    date: data.date || new Date().toISOString().split('T')[0],
    customer: data.customer || 'ABC Marine Traders',
    orderRef: data.orderRef || 'Ref: SO-2026-00999',
    soId: data.soId || null,
    challanNo: data.challanNo || `DC-2026-${Math.floor(100 + Math.random() * 900)}`,
    taxInvoice: data.taxInvoice || `INV-2026-${Math.floor(100 + Math.random() * 900)}`,
    ewayBill: data.ewayBill || `E-way: ${Math.floor(100000000000 + Math.random() * 900000000000)}`,
    dispatchedQty: `${dispatchQtyCoils} Coils`,
    dispatchedQtyCoils: dispatchQtyCoils,
    value: data.value || `₹${(dispatchQtyCoils * 2450).toLocaleString()}`,
    vehicle: data.vehicle || 'GJ-03-BW-9999',
    transporter: data.transporter || 'Shree Saurashtra Roadlines',
    status: 'DISPATCHED',
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'dispatches'), dispatchDoc);

  // Update Sales Order record if soId provided
  if (data.soId) {
    const currentDispatched = Number(data.currentDispatchedCoils || 0) + dispatchQtyCoils;
    const totalOrdered = Number(data.totalOrderedCoils || 500);
    const balanceCoils = Math.max(0, totalOrdered - currentDispatched);
    const isCompleted = balanceCoils <= 0;

    const soRef = doc(db, 'salesOrders', data.soId);
    await updateDoc(soRef, {
      dispatched: `${currentDispatched}`,
      dispatchedCoils: currentDispatched,
      balance: `${balanceCoils}`,
      balanceCoils: balanceCoils,
      status: isCompleted ? 'COMPLETED' : 'PARTIALLY DISPATCHED',
      statusClass: isCompleted ? 'pill-completed' : 'pill-partial-disp',
      updatedAt: serverTimestamp()
    });
  }

  // Deduct FG Stock
  if (data.fgSkuId) {
    await updateFgStock(data.fgSkuId, -dispatchQtyCoils, -dispatchQtyCoils);
  }

  // Log movement
  await logStockMovement({
    type: 'Dispatch Issue',
    typeBadge: 'inv-badge-dispatch',
    icon: '🚚',
    ref: dispatchNo,
    item: data.itemSummary || 'PP Danline Rope 6mm (Yellow)',
    batch: 'BATCH-FG-DISPATCH',
    inward: '0',
    outward: `-${dispatchQtyCoils} Coils`,
    location: 'Finished Goods Bay -> Transport',
    remarks: `Dispatched ${dispatchQtyCoils} Coils under ${dispatchDoc.challanNo}`
  });

  return docRef.id;
}
