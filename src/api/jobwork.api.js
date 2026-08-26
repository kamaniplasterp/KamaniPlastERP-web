import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy,
  increment
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { updateRmStock, logStockMovement } from './inventory.api';

/**
 * Subscribe to real-time Job Works collection
 */
export function subscribeJobWorks(callback) {
  if (!db) return () => {};
  const q = query(collection(db, 'jobWorks'), orderBy('createdAt', 'desc'));
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
 * Create a new Job Work Order
 */
export async function createJobWork(data) {
  if (!db) throw new Error('Firestore not initialized');

  const sentKg = Number(data.sentQtyKg || data.inputQty || 2000);
  const jwNo = data.jwNo || `JW-2026-${Math.floor(100 + Math.random() * 900)}`;

  const jwDoc = {
    jwNo: jwNo,
    chNo: data.chNo || `CH-${jwNo}`,
    date: data.date || new Date().toISOString().split('T')[0],
    vendor: data.vendor || 'Shree Plastic Works',
    vendorId: data.vendorId || null,
    rawMat: data.rawMat || 'PP Granules',
    rawMaterialId: data.rawMaterialId || null,
    sentQty: `${sentKg.toLocaleString()} KG`,
    sentQtyKg: sentKg,
    expectedFg: data.expectedFg || `${Math.round(sentKg * 0.96)} KG (6mm Danline)`,
    recQty: '0 KG',
    recQtyKg: 0,
    balQty: `${sentKg.toLocaleString()} KG`,
    balQtyKg: sentKg,
    status: 'SENT',
    statusClass: 'pill-blue',
    createdAt: serverTimestamp()
  };

  const docRef = await addDoc(collection(db, 'jobWorks'), jwDoc);

  // If rawMaterialId is specified, update stock counts
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
 * Receive partial or full completed material from Job Worker
 */
export async function receiveJobWork({ jwId, rawMaterialId, recQtyKg, scrapQtyKg = 0, currentRecKg = 0, currentScrapKg = 0, totalSentKg, itemLabel, remarks }) {
  if (!db || !jwId) throw new Error('Firestore not initialized');

  const newRecTotal = (Number(currentRecKg) || 0) + Number(recQtyKg || 0);
  const newScrapTotal = (Number(currentScrapKg) || 0) + Number(scrapQtyKg || 0);
  const totalAccounted = newRecTotal + newScrapTotal;
  const remainingBal = Math.max(0, (Number(totalSentKg) || 0) - totalAccounted);
  const isCompleted = remainingBal <= 0;

  const jwRef = doc(db, 'jobWorks', jwId);
  await updateDoc(jwRef, {
    recQty: `${newRecTotal.toLocaleString()} KG`,
    recQtyKg: newRecTotal,
    scrapQty: `${newScrapTotal.toLocaleString()} KG`,
    scrapQtyKg: newScrapTotal,
    balQty: `${remainingBal.toLocaleString()} KG`,
    balQtyKg: remainingBal,
    status: isCompleted ? 'COMPLETED' : 'PARTIAL',
    statusClass: isCompleted ? 'pill-green' : 'pill-orange',
    updatedAt: serverTimestamp()
  });

  // Update RM stock (increase factory available stock, decrease atJobWork count)
  const totalDeduction = Number(recQtyKg || 0) + Number(scrapQtyKg || 0);
  const recInward = Number(recQtyKg || 0);
  await updateRmStock(rawMaterialId, recInward, -totalDeduction);

  // Log stock movement
  await logStockMovement({
    type: 'JWReturn',
    typeBadge: 'inv-badge-jwreturn',
    icon: '↙',
    ref: `GRN-${jwId.slice(0, 6).toUpperCase()}`,
    item: itemLabel || 'PP Danline Rope 6mm (Yellow)',
    batch: 'WIP-RECEIPT',
    inward: `+${recQtyKg} KG`,
    outward: '0 KG',
    location: 'Job Worker -> Factory WIP Floor',
    remarks: remarks || `Receipt of ${recQtyKg} KG processed material from Job Worker`
  });
}
