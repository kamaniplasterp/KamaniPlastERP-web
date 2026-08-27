import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy,
  limit,
  runTransaction,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Subscribe to real-time Raw Materials collection with optional query limit
 */
export function subscribeRawMaterials(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'rawMaterials'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching raw materials:', error);
    callback([]);
  });
}

/**
 * Subscribe to real-time Finished Goods collection with optional query limit
 */
export function subscribeFinishedGoods(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'finishedGoods'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching finished goods:', error);
    callback([]);
  });
}

/**
 * Subscribe to real-time Stock Ledger / Movements collection with default limit of 100
 */
export function subscribeStockMovements(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'stockMovements'), orderBy('createdAt', 'desc'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching stock movements:', error);
    callback([]);
  });
}

/**
 * Log an append-only stock movement to stockMovements ledger
 */
export async function logStockMovement(movementData) {
  if (!db) return null;
  const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const ref = await addDoc(collection(db, 'stockMovements'), {
    time: timeString,
    createdAt: serverTimestamp(),
    ...movementData
  });
  return ref.id;
}

/**
 * Add a new Raw Material SKU & log opening receipt movement
 */
export async function addRawMaterial(data) {
  if (!db) throw new Error('Firestore not initialized');
  
  const availQty = Number(data.availFactory || data.qty || 0);
  const status = availQty > 1000 ? 'IN STOCK' : availQty > 0 ? 'LOW STOCK' : 'OUT OF STOCK';

  const docRef = await addDoc(collection(db, 'rawMaterials'), {
    code: data.code || `RM-${Math.floor(1000 + Math.random() * 9000)}`,
    name: data.name || data.item || 'New Raw Material',
    brand: data.brand || 'Generic',
    grade: data.grade || 'Standard',
    desc: data.desc || '',
    availFactory: availQty,
    atJobWork: Number(data.atJobWork || 0),
    rate: Number(data.rate || 0),
    status: status,
    createdAt: serverTimestamp()
  });

  if (availQty > 0) {
    await logStockMovement({
      type: 'Receipt',
      typeBadge: 'inv-badge-receipt',
      icon: '📦',
      ref: data.ref || `RM-RECEIPT-${docRef.id.slice(0, 5).toUpperCase()}`,
      item: data.name || 'Raw Material Opening',
      batch: data.batch || 'LOT-OPENING',
      inward: `+${availQty} KG`,
      outward: '0 KG',
      location: data.location || 'Factory Main Silo',
      remarks: data.remarks || 'Opening stock creation'
    });
  }

  return docRef.id;
}

/**
 * Add a new Finished Goods SKU & log production movement
 */
export async function addFinishedGood(data) {
  if (!db) throw new Error('Firestore not initialized');

  const stockQty = Number(data.stockQty || data.qty || 0);
  const reorderLvl = Number(data.reorderLevel || 50);
  const status = stockQty >= reorderLvl ? 'IN STOCK' : stockQty > 0 ? 'LOW STOCK' : 'OUT OF STOCK';

  const docRef = await addDoc(collection(db, 'finishedGoods'), {
    code: data.code || `FG-${Math.floor(1000 + Math.random() * 9000)}`,
    name: data.name || 'New Finished Good',
    desc: data.desc || '',
    category: data.category || 'Danline Rope',
    stockQty: stockQty,
    reservedQty: Number(data.reservedQty || 0),
    rate: Number(data.rate || 0),
    reorderLevel: reorderLvl,
    status: status,
    createdAt: serverTimestamp()
  });

  if (stockQty > 0) {
    await logStockMovement({
      type: 'Production',
      typeBadge: 'inv-badge-prod',
      icon: '⚙️',
      ref: data.ref || `FG-PROD-${docRef.id.slice(0, 5).toUpperCase()}`,
      item: data.name || 'Finished Good Inward',
      batch: data.batch || 'BATCH-FG-INWARD',
      inward: `+${stockQty} Coils`,
      outward: '0',
      location: data.location || 'Finished Goods Warehouse',
      remarks: data.remarks || 'Production / Opening stock inward'
    });
  }

  return docRef.id;
}

/**
 * Update RM Stock counts safely using atomic Firestore runTransaction
 */
export async function updateRmStock(skuId, factoryDelta = 0, jwDelta = 0) {
  if (!db) return;
  try {
    let targetRef = skuId ? doc(db, 'rawMaterials', skuId) : null;

    if (!targetRef) {
      const allSnap = await getDocs(collection(db, 'rawMaterials'));
      if (!allSnap.empty) {
        targetRef = allSnap.docs[0].ref;
      } else {
        return;
      }
    }

    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(targetRef);
      if (!docSnap.exists()) {
        const fallbackSnap = await getDocs(collection(db, 'rawMaterials'));
        if (fallbackSnap.empty) return;
        const fbRef = fallbackSnap.docs[0].ref;
        const fbDoc = await transaction.get(fbRef);
        if (!fbDoc.exists()) return;
        
        const fbData = fbDoc.data();
        const newAvail = Math.max(0, (Number(fbData.availFactory) || 0) + factoryDelta);
        const newJw = Math.max(0, (Number(fbData.atJobWork) || 0) + jwDelta);
        const reorderLvl = Number(fbData.reorderLevel || 1000);
        const newStatus = newAvail >= reorderLvl ? 'IN STOCK' : newAvail > 0 ? 'LOW STOCK' : 'OUT OF STOCK';

        transaction.update(fbRef, {
          availFactory: newAvail,
          atJobWork: newJw,
          status: newStatus,
          updatedAt: serverTimestamp()
        });
        return;
      }

      const data = docSnap.data();
      const newAvail = Math.max(0, (Number(data.availFactory) || 0) + factoryDelta);
      const newJw = Math.max(0, (Number(data.atJobWork) || 0) + jwDelta);
      const reorderLvl = Number(data.reorderLevel || 1000);
      const newStatus = newAvail >= reorderLvl ? 'IN STOCK' : newAvail > 0 ? 'LOW STOCK' : 'OUT OF STOCK';

      transaction.update(targetRef, {
        availFactory: newAvail,
        atJobWork: newJw,
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    });
  } catch (err) {
    console.error('Error updating RM stock atomically:', err);
  }
}

/**
 * Update FG Stock counts safely using atomic Firestore runTransaction
 */
export async function updateFgStock(skuId, stockDelta = 0, reservedDelta = 0) {
  if (!db) return;
  try {
    let targetRef = skuId ? doc(db, 'finishedGoods', skuId) : null;

    if (!targetRef) {
      const allSnap = await getDocs(collection(db, 'finishedGoods'));
      if (!allSnap.empty) {
        targetRef = allSnap.docs[0].ref;
      } else {
        return;
      }
    }

    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(targetRef);
      if (!docSnap.exists()) {
        const fallbackSnap = await getDocs(collection(db, 'finishedGoods'));
        if (fallbackSnap.empty) return;
        const fbRef = fallbackSnap.docs[0].ref;
        const fbDoc = await transaction.get(fbRef);
        if (!fbDoc.exists()) return;
        
        const fbData = fbDoc.data();
        const newStock = Math.max(0, (Number(fbData.stockQty) || 0) + stockDelta);
        const newReserved = Math.max(0, (Number(fbData.reservedQty) || 0) + reservedDelta);
        const reorderLvl = Number(fbData.reorderLevel || 50);
        const newStatus = newStock >= reorderLvl ? 'IN STOCK' : newStock > 0 ? 'LOW STOCK' : 'OUT OF STOCK';

        transaction.update(fbRef, {
          stockQty: newStock,
          reservedQty: newReserved,
          status: newStatus,
          updatedAt: serverTimestamp()
        });
        return;
      }

      const data = docSnap.data();
      const newStock = Math.max(0, (Number(data.stockQty) || 0) + stockDelta);
      const newReserved = Math.max(0, (Number(data.reservedQty) || 0) + reservedDelta);
      const reorderLvl = Number(data.reorderLevel || 50);
      const newStatus = newStock >= reorderLvl ? 'IN STOCK' : newStock > 0 ? 'LOW STOCK' : 'OUT OF STOCK';

      transaction.update(targetRef, {
        stockQty: newStock,
        reservedQty: newReserved,
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    });
  } catch (err) {
    console.error('Error updating FG stock atomically:', err);
  }
}

