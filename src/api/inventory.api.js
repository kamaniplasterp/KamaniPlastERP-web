import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  getDoc,
  serverTimestamp,
  query,
  where,
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
    let targetRef = null;

    if (skuId) {
      // 1. Check if skuId is a valid direct Firestore document ID
      try {
        const directRef = doc(db, 'finishedGoods', String(skuId));
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          targetRef = directRef;
        }
      } catch (e) {
        // Not a direct doc id
      }

      // 2. Query by product code (e.g. FG-LOT-04MM-954)
      if (!targetRef) {
        const qCode = query(collection(db, 'finishedGoods'), where('code', '==', String(skuId)));
        const snapCode = await getDocs(qCode);
        if (!snapCode.empty) {
          targetRef = snapCode.docs[0].ref;
        }
      }

      // 3. Query by product name
      if (!targetRef) {
        const qName = query(collection(db, 'finishedGoods'), where('name', '==', String(skuId)));
        const snapName = await getDocs(qName);
        if (!snapName.empty) {
          targetRef = snapName.docs[0].ref;
        }
      }
    }

    if (!targetRef) {
      console.warn('updateFgStock: Target SKU not found for identifier:', skuId);
      return;
    }

    await runTransaction(db, async (transaction) => {
      const docSnap = await transaction.get(targetRef);
      if (!docSnap.exists()) return;

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

/**
 * Standard Raw Material Item Names from Excel Sub Item sheet
 */
export const RM_ITEM_NAMES = [
  'GRANUALS-HDPE',
  'GRANUALS-PP',
  'GRANUALS-MIX',
  'GRANUALS-LD/LL',
  'GRINDER-HDPE',
  'GRINDER-PP',
  'GRINDER-MIX',
  'GRINDER-LD/LL',
  'YARN-FISHING YARN',
  'YARN-VIP',
  'YARN-ROPE',
  'YARN-GARUD',
  'TWINE-FISHING TWINE',
  'TWINE-VIP',
  'TWINE-ROPE'
];

/**
 * Standard Raw Material Grades from Excel Sub Item sheet
 */
export const RM_GRADES = [
  '8MFI HDPE',
  'BOROUGE',
  'HD',
  'HMEL OG',
  'MB6501',
  'MB6502',
  'PLAIN BAG HDPE',
  'ABC12',
  'RIL H030SG',
  'RIL M60075',
  'OPAL 5410',
  'OPAL R5410',
  'T9',
  'T10H',
  'SABIC.HD',
  'PP',
  'UNSPECIFIED'
];

/**
 * Standard Raw Material Suppliers from Excel Supplier Master
 */
export const RM_SUPPLIERS = [
  'RAMJIBHAI',
  'GALAXY.ENTERPRISE',
  'CHIRIMIRIPLASTICS',
  'HIMMATBHAI',
  'LALABHAI.KPI',
  'MAHALAXMI PLASTICS',
  'TIDABHAI',
  'PRAVINBHAI',
  'JENUBHAI',
  'SHAH MONOFILAMENT',
  'SANVI',
  'RAINBOW PACKAGING',
  'UNKNOWN SUPPLIER'
];

/**
 * Subscribe to real-time Raw Material Inward GRNs
 */
export function subscribeRmInwards(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'rmInwards'), orderBy('createdAt', 'desc'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching RM Inwards:', error);
    callback([]);
  });
}

/**
 * Subscribe to real-time Factory Issue slips
 */
export function subscribeRmFactoryIssues(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'rmFactoryIssues'), orderBy('createdAt', 'desc'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching Factory Issues:', error);
    callback([]);
  });
}

/**
 * Record a new Raw Material Inward GRN (matching Excel sheet 'Raw Material Inward')
 */
export async function recordRmInward(data) {
  if (!db) throw new Error('Firestore not initialized');

  const grossWght = Number(data.grossWeight || 0);
  const boraCount = Number(data.boraCount || data.noOfArticles || 0);
  const articleType = data.articleType || 'BORA';
  const unitTare = Number(data.unitTare !== undefined ? data.unitTare : (articleType === 'BORA' ? 0.200 : (articleType === 'PLASTIC CONE' ? 0.025 : (articleType === 'KHALI BAG' ? 0.120 : (articleType === 'THELI' ? 0.015 : 0)))));
  const articleTareWeight = Number(data.articleWeight !== undefined ? data.articleWeight : (boraCount * unitTare));
  const netInwardKg = grossWght > 0 ? Math.max(0, grossWght - articleTareWeight) : Number(data.netWeight || 0);

  const grnRef = await addDoc(collection(db, 'rmInwards'), {
    grnNo: data.grnNo || `GRN-${Math.floor(1000 + Math.random() * 9000)}`,
    challanNo: data.challanNo || '',
    date: data.date || new Date().toISOString().split('T')[0],
    supplierName: data.supplierName || 'RAMJIBHAI',
    itemName: data.itemName || 'GRANUALS-HDPE',
    grade: data.grade || 'HD',
    grossWeight: grossWght,
    noOfArticles: boraCount,
    articleType,
    articleWeight: articleTareWeight,
    netWeight: netInwardKg,
    rate: Number(data.rate || 112),
    receivedBy: data.receivedBy || 'SURESHBHAI',
    remarks: data.remarks || 'Raw material inward received',
    createdAt: serverTimestamp()
  });

  // Find or update matching rawMaterial SKU in Firestore
  const rmSnap = await getDocs(collection(db, 'rawMaterials'));
  let matchedRm = null;
  for (const docSnap of rmSnap.docs) {
    const d = docSnap.data();
    if (
      (d.name && d.name.toLowerCase() === (data.itemName || '').toLowerCase()) ||
      (d.code && d.code.toLowerCase().includes((data.grade || '').toLowerCase())) ||
      (d.grade && d.grade.toLowerCase() === (data.grade || '').toLowerCase())
    ) {
      matchedRm = { id: docSnap.id, ...d };
      break;
    }
  }

  if (matchedRm) {
    await updateRmStock(matchedRm.id, netInwardKg, 0);
  } else {
    await addRawMaterial({
      code: `RM-${(data.itemName || 'POLY').slice(0, 4).toUpperCase()}-${(data.grade || 'STD').slice(0, 3).toUpperCase()}`,
      name: data.itemName,
      brand: data.supplierName,
      grade: data.grade,
      desc: `${data.itemName} ^ ${data.grade}`,
      availFactory: netInwardKg,
      rate: Number(data.rate || 112),
      reorderLevel: 1000
    });
  }

  await logStockMovement({
    type: 'Receipt',
    typeBadge: 'inv-badge-receipt',
    icon: '📦',
    ref: data.grnNo || `GRN-INWARD`,
    item: `${data.itemName} ^ ${data.grade}`,
    batch: data.challanNo ? `CHL-${data.challanNo}` : 'LOT-INWARD',
    inward: `+${netInwardKg} KG`,
    outward: '0 KG',
    location: 'Factory Main Silo',
    remarks: `Inward from ${data.supplierName} (${boraCount} ${articleType})`
  });

  return grnRef.id;
}

/**
 * Issue Raw Material to Factory Machine/Extrusion (matching Excel sheet 'Issue To Factory')
 */
export async function issueRmToFactory(data) {
  if (!db) throw new Error('Firestore not initialized');

  const grossWght = Number(data.grossWeight || 0);
  const articleWght = Number(data.articleWeight || 0);
  const netWght = grossWght > 0 ? Math.max(0, grossWght - articleWght) : Number(data.netWeight || data.qty || 0);

  const issueRef = await addDoc(collection(db, 'rmFactoryIssues'), {
    slipNo: data.slipNo || `ISS-${Math.floor(1000 + Math.random() * 9000)}`,
    date: data.date || new Date().toISOString().split('T')[0],
    rawMaterialId: data.rawMaterialId || '',
    itemName: data.itemName || 'GRANUALS-HDPE',
    grade: data.grade || '',
    grossWeight: grossWght,
    articleWeight: articleWght,
    netWeight: netWght,
    quantity: Number(data.quantity || 1),
    issuedBy: data.issuedBy || 'SURESHBHAI',
    remarks: data.remarks || 'Issued to internal extrusion plant',
    createdAt: serverTimestamp()
  });

  if (data.rawMaterialId) {
    await updateRmStock(data.rawMaterialId, -netWght, 0);
  }

  await logStockMovement({
    type: 'Issue to Factory',
    typeBadge: 'inv-badge-issue',
    icon: '🏭',
    ref: data.slipNo || `ISSUE-SLIP`,
    item: `${data.itemName} ^ ${data.grade}`,
    batch: 'PLANT-EXTRUSION',
    inward: '0 KG',
    outward: `-${netWght} KG`,
    location: 'Plant Line 1 (Extrusion)',
    remarks: data.remarks || 'Internal plant issue'
  });

  return issueRef.id;
}

