import { 
  collection, 
  onSnapshot, 
  addDoc, 
  doc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { updateRmStock, logStockMovement } from './inventory.api';

/**
 * Subscribe to real-time Job Works collection with optional limit
 */
export function subscribeJobWorks(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'jobWorks'), orderBy('createdAt', 'desc'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching job works:', error);
    callback([]);
  });
}

/**
 * Create a new Job Work Order with atomic stock update & movement logging
 */
export async function createJobWork(data) {
  if (!db) throw new Error('Firestore not initialized');

  const sentKg = Number(data.sentQtyKg || data.inputQty || data.dispatchQty || 0);
  const jwNo = data.jwNo || `JW-2026-${Math.floor(100 + Math.random() * 900)}`;
  const chargesRate = Number(data.charges || data.processingRate || data.ratePerKg || 0);

  const jwDoc = {
    jwNo: jwNo,
    chNo: data.chNo || `CH-${jwNo}`,
    date: data.date || data.challanDate || new Date().toISOString().split('T')[0],
    expectedReturn: data.expectedReturn || '',
    vendor: data.vendor || '',
    vendorId: data.vendorId || null,
    rawMat: data.rawMat || '',
    rawMaterialId: data.rawMaterialId || null,
    process: data.process || data.processType || '',
    sentQty: `${sentKg.toLocaleString()} KG`,
    sentQtyKg: sentKg,
    expectedFg: data.expectedFg || '',
    recQty: '0 KG',
    recQtyKg: 0,
    balQty: `${sentKg.toLocaleString()} KG`,
    balQtyKg: sentKg,
    scrapQtyKg: 0,
    charges: chargesRate,
    ratePerKg: chargesRate,
    batch: data.batch || data.batchNo || '',
    vehicleNo: data.vehicleNo || data.vehicle || '',
    stockSource: data.stockSource || 'Factory Silo',
    wastage: data.wastage || '0%',
    status: 'SENT',
    statusClass: 'pill-blue',
    remarks: data.remarks || '',
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'jobWorks'), jwDoc);

  // If rawMaterialId is specified, update RM stock atomically
  if (data.rawMaterialId) {
    await updateRmStock(data.rawMaterialId, -sentKg, sentKg);
  }

  // Log movement in stock ledger
  await logStockMovement({
    type: 'JWIssue',
    typeBadge: 'inv-badge-jwissue',
    icon: '🚚',
    ref: jwNo,
    item: data.rawMat || 'PP Granules',
    batch: data.batch || 'BATCH-RM-JW',
    inward: '0 KG',
    outward: `-${sentKg} KG`,
    location: `Factory Silo -> ${data.vendor || 'Job Worker'}`,
    remarks: data.remarks || `Dispatched ${sentKg} KG to job worker`
  });

  return docRef.id;
}

/**
 * Receive partial or full completed material from Job Worker atomically
 */
export async function receiveJobWork({ jwId, rawMaterialId, recQtyKg, scrapQtyKg = 0, currentRecKg = 0, currentScrapKg = 0, totalSentKg, itemLabel, remarks }) {
  if (!db || !jwId) throw new Error('Firestore not initialized');

  let targetRef = doc(db, 'jobWorks', jwId);
  try {
    const qSnap = await getDocs(query(collection(db, 'jobWorks'), where('jwNo', '==', jwId)));
    if (!qSnap.empty) {
      targetRef = qSnap.docs[0].ref;
    }
  } catch (e) {
    console.warn('Direct ID used for jobWork receive');
  }

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(targetRef);
    const existingData = docSnap.exists() ? docSnap.data() : {};
    
    const recSoFar = (Number(existingData.recQtyKg) || Number(currentRecKg) || 0) + Number(recQtyKg || 0);
    const scrapSoFar = (Number(existingData.scrapQtyKg) || Number(currentScrapKg) || 0) + Number(scrapQtyKg || 0);
    const sentTotal = Number(existingData.sentQtyKg) || Number(totalSentKg) || (recSoFar + scrapSoFar);
    const remBal = Math.max(0, sentTotal - (recSoFar + scrapSoFar));
    const compState = remBal <= 0;

    transaction.set(targetRef, {
      recQty: `${recSoFar.toLocaleString()} KG`,
      recQtyKg: recSoFar,
      scrapQty: `${scrapSoFar.toLocaleString()} KG`,
      scrapQtyKg: scrapSoFar,
      balQty: `${remBal.toLocaleString()} KG`,
      balQtyKg: remBal,
      status: compState ? 'COMPLETED' : 'PARTIAL',
      statusClass: compState ? 'pill-green' : 'pill-orange',
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  // Update RM stock atomically (increase factory available stock, decrease atJobWork count)
  const totalDeduction = Number(recQtyKg || 0) + Number(scrapQtyKg || 0);
  const recInward = Number(recQtyKg || 0);
  if (rawMaterialId) {
    await updateRmStock(rawMaterialId, recInward, -totalDeduction);
  }

  // Log stock movement
  await logStockMovement({
    type: 'JWReturn',
    typeBadge: 'inv-badge-jwreturn',
    icon: '↙',
    ref: `GRN-${String(jwId).slice(0, 8).toUpperCase()}`,
    item: itemLabel || 'Processed Material',
    batch: 'WIP-RECEIPT',
    inward: `+${recQtyKg} KG`,
    outward: '0 KG',
    location: 'Job Worker -> Factory WIP Floor',
    remarks: remarks || `Receipt of ${recQtyKg} KG processed material from Job Worker`
  });
}

