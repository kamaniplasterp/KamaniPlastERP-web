import { 
  collection, 
  onSnapshot, 
  addDoc, 
  deleteDoc,
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
export function subscribeJobWorks(callback, limitCount = 200) {
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
 * Standard tare weights for article types matching Excel Misc Master
 */
export const ARTICLE_TARE_DEFAULTS = {
  'BORA': 0.200,          // 200 grams per bora
  'PLASTIC CONE': 0.025,  // 25 grams per cone
  'KHALI BAG': 0.120,     // 120 grams per bag
  'THELI': 0.015,         // 15 grams per theli
  'NONE': 0.000
};

/**
 * Standard Process list matching Excel Sub Item & Misc Master
 */
export const JW_PROCESS_LIST = [
  'GRANUAL - FISHING YARN',
  'GRANUAL - VIP YARN',
  'VIP YARN- TWINE HANK',
  'VIP YARN- TWINE CONE',
  'VIP TWINE - 20GRAM',
  'FISHING CONE - 100GRAM CONE',
  'FISHING CONE - 200GRAM CONE',
  'FISHING YARN - TWINE',
  'GARUD YARN - CONE',
  'ROPE COIL - 404',
  'ROPE COIL - 405',
  'ROPE COIL - 406',
  'ROPE COIL - 4121',
  'ROPE COIL - 4121 SINGLE LABEL',
  'ROPE COIL - 41212',
  'ROPE COIL - 4124',
  'TAPE EXTRUSION & SPINNING',
  'MONOFILAMENT EXTRUSION',
  'ROPE WINDING & PACKING',
  'TWISTING & BRAIDING'
];

/**
 * Standard Personnel List matching Excel Misc Master
 */
export const AUTHORIZED_PERSONS = [
  'SURESHBHAI',
  'DIPAKBHAI',
  'SUDHIRBHAI',
  'MANSUKHBHAI',
  'RAMILBHAI',
  'ILYASHBHAI',
  'DHARMENDRABHAI',
  'DHURMITBHAI',
  'PRAVINBHAI',
  'HIMMATBHAI'
];

/**
 * Create a new Job Work Order with atomic stock update & movement logging
 * Stores full schema aligned with Excel JW-Outward and Delivery Challan
 */
export async function createJobWork(data) {
  if (!db) throw new Error('Firestore not initialized');

  const grossWght = Number(data.grossWeight || data.grossWght || 0);
  const boraCount = Number(data.boraCount || data.noOfBora || data.noOfArtcls || 0);
  const articleType = data.articleType || (boraCount > 0 ? 'BORA' : 'NONE');
  const unitTare = Number(data.unitTare || ARTICLE_TARE_DEFAULTS[articleType] || (articleType === 'BORA' ? 0.2 : 0));
  const articleWeight = Number(data.articleWeight !== undefined ? data.articleWeight : (boraCount * unitTare));
  
  // Net weight = Gross - Article tare (or fallback to sentQtyKg)
  const calculatedNetKg = grossWght > 0 ? Math.max(0, grossWght - articleWeight) : Number(data.sentQtyKg || data.inputQty || data.dispatchQty || 0);
  const sentKg = calculatedNetKg;

  // Burning Loss / Process Loss
  const bLossPct = Number(data.bLossPct !== undefined ? data.bLossPct : (parseFloat(String(data.wastage || 0).replace(/[^0-9.]/g, '')) || 0));
  const bLossKg = Number(data.bLossKg !== undefined ? data.bLossKg : (sentKg * (bLossPct / 100)));
  const netOutwardKg = Math.max(0, sentKg - bLossKg);

  const jwSeries = data.challanSeries || 'JW-2026-';
  const autoNum = Math.floor(1000 + Math.random() * 9000);
  const jwNo = data.jwNo || `${jwSeries}${autoNum}`;
  const chNo = data.chNo || data.chalNo || `${autoNum}`;
  const chargesRate = Number(data.ratePerKg || data.charges || data.processingRate || 0);
  const totalCharges = Number(data.totalCharges || (sentKg * chargesRate));

  const jwDoc = {
    // Challan & Classification
    jwNo,
    chNo: String(chNo),
    challanSeries: jwSeries,
    subChalNo: data.subChalNo || '1',
    workOrder: data.workOrder || data.workOrderNo || `WO-${autoNum}`,
    department: data.department || 'Job Work Extrusion',
    date: data.date || data.challanDate || new Date().toISOString().split('T')[0],
    expectedReturn: data.expectedReturn || '',
    durationDays: Number(data.durationDays || data.duration || 5),

    // Party / Vendor
    vendor: data.vendor || data.party || '',
    vendorId: data.vendorId || null,

    // Material Details
    rawMat: data.rawMat || data.material || '',
    grade: data.grade || '',
    rawMaterialId: data.rawMaterialId || null,
    process: data.process || data.processType || 'GRANUAL - FISHING YARN',

    // Weight & Packaging Matrix (Matching Excel JW-Outward)
    grossWeight: grossWght || sentKg,
    boraCount: boraCount,
    articleType: articleType,
    articleWeight: articleWeight,
    sentQtyKg: sentKg,
    sentQty: `${sentKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG`,

    // Burning / Process Loss
    bLossPct: bLossPct,
    bLossKg: bLossKg,
    netOutwardKg: netOutwardKg,
    expectedFg: data.expectedFg || `${netOutwardKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG`,
    wastage: `${bLossPct}%`,

    // Pieces & Sample Matrix
    pieces: Number(data.pieces || data.pcs || 0),
    samplePcs: Number(data.samplePcs || data.smplPcs || 0),
    sampleWeight: Number(data.sampleWeight || data.samplePcsWght || 0),

    // Inward tracking initial state
    recQty: '0 KG',
    recQtyKg: 0,
    recBoraCount: 0,
    balQty: `${sentKg.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG`,
    balQtyKg: sentKg,
    scrapQtyKg: 0,
    reworkQtyKg: 0,
    rejectionQtyKg: 0,
    inwardReceipts: [],

    // Financials
    charges: chargesRate,
    ratePerKg: chargesRate,
    totalCharges: totalCharges,

    // Logistics & Administration
    batch: data.batch || data.batchNo || `BATCH-${autoNum}`,
    vehicleNo: data.vehicleNo || data.vehicle || '',
    stockSource: data.stockSource || 'Factory Silo A',
    issuedBy: data.issuedBy || 'SURESHBHAI',
    approvedBy: data.approvedBy || 'FINAL APPROVED',
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
    ref: chNo,
    item: `${data.rawMat || 'Raw Material'}${data.grade ? ' ^ ' + data.grade : ''}`,
    batch: jwDoc.batch,
    inward: '0 KG',
    outward: `-${sentKg} KG`,
    location: `Factory Silo -> ${data.vendor || 'Job Worker'}`,
    remarks: data.remarks || `Dispatched ${sentKg} KG (${boraCount} Bora) to ${data.vendor || 'Job Worker'}`
  });

  return docRef.id;
}

/**
 * Receive partial or full completed material from Job Worker atomically
 * Stores full schema aligned with Excel JW-Inward and Inward Slip
 */
export async function receiveJobWork({ 
  jwId, 
  rawMaterialId, 
  recQtyKg, 
  recGrossWeight = 0,
  recBoraCount = 0,
  recArticleType = 'BORA',
  recArticleWeight = 0,
  reworkQtyKg = 0,
  rejectionQtyKg = 0,
  scrapQtyKg = 0, 
  currentRecKg = 0, 
  currentScrapKg = 0, 
  totalSentKg, 
  inwardSlipNo,
  inwardDate,
  receivedBy = 'RAMILBHAI',
  itemLabel, 
  ratePerKg,
  samplePcs = 0,
  sampleWeight = 0,
  remarks 
}) {
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

  const receiptSlip = inwardSlipNo || `INW-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateOfReceipt = inwardDate || new Date().toISOString().split('T')[0];

  const receiptEntry = {
    slipNo: receiptSlip,
    date: dateOfReceipt,
    grossWeight: Number(recGrossWeight || recQtyKg),
    boraCount: Number(recBoraCount || 0),
    articleType: recArticleType,
    articleWeight: Number(recArticleWeight || 0),
    netQtyKg: Number(recQtyKg || 0),
    reworkQtyKg: Number(reworkQtyKg || 0),
    rejectionQtyKg: Number(rejectionQtyKg || 0),
    scrapQtyKg: Number(scrapQtyKg || 0),
    samplePcs: Number(samplePcs || 0),
    sampleWeight: Number(sampleWeight || 0),
    receivedBy: receivedBy,
    ratePerKg: Number(ratePerKg || 0),
    value: Number(recQtyKg || 0) * Number(ratePerKg || 0),
    remarks: remarks || '',
    recordedAt: new Date().toISOString()
  };

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(targetRef);
    const existingData = docSnap.exists() ? docSnap.data() : {};
    
    const recSoFar = (Number(existingData.recQtyKg) || Number(currentRecKg) || 0) + Number(recQtyKg || 0);
    const scrapSoFar = (Number(existingData.scrapQtyKg) || Number(currentScrapKg) || 0) + Number(scrapQtyKg || 0);
    const reworkSoFar = (Number(existingData.reworkQtyKg) || 0) + Number(reworkQtyKg || 0);
    const rejectionSoFar = (Number(existingData.rejectionQtyKg) || 0) + Number(rejectionQtyKg || 0);
    const recBoraSoFar = (Number(existingData.recBoraCount) || 0) + Number(recBoraCount || 0);

    const sentTotal = Number(existingData.sentQtyKg) || Number(totalSentKg) || (recSoFar + scrapSoFar);
    const remBal = Math.max(0, sentTotal - (recSoFar + scrapSoFar + rejectionSoFar));
    const compState = remBal <= 0;

    const existingReceipts = Array.isArray(existingData.inwardReceipts) ? existingData.inwardReceipts : [];

    transaction.set(targetRef, {
      recQty: `${recSoFar.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG`,
      recQtyKg: recSoFar,
      recBoraCount: recBoraSoFar,
      scrapQty: `${scrapSoFar.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG`,
      scrapQtyKg: scrapSoFar,
      reworkQtyKg: reworkSoFar,
      rejectionQtyKg: rejectionSoFar,
      balQty: `${remBal.toLocaleString('en-IN', { maximumFractionDigits: 2 })} KG`,
      balQtyKg: remBal,
      inwardReceipts: [...existingReceipts, receiptEntry],
      status: compState ? 'COMPLETED' : 'PARTIAL',
      statusClass: compState ? 'pill-green' : 'pill-orange',
      updatedAt: serverTimestamp()
    }, { merge: true });
  });

  // Update RM stock atomically (increase factory available stock, decrease atJobWork count)
  const totalDeduction = Number(recQtyKg || 0) + Number(scrapQtyKg || 0) + Number(rejectionQtyKg || 0);
  const recInward = Number(recQtyKg || 0);
  if (rawMaterialId) {
    await updateRmStock(rawMaterialId, recInward, -totalDeduction);
  }

  // Log stock movement
  await logStockMovement({
    type: 'JWReturn',
    typeBadge: 'inv-badge-jwreturn',
    icon: '↙',
    ref: receiptSlip,
    item: itemLabel || 'Processed Material',
    batch: 'WIP-RECEIPT',
    inward: `+${recQtyKg} KG`,
    outward: '0 KG',
    location: 'Job Worker -> Factory WIP Floor',
    remarks: remarks || `Receipt Slip ${receiptSlip} of ${recQtyKg} KG (${recBoraCount} Bora) received by ${receivedBy}`
  });
}

/**
 * Subscribe to real-time Extra Cutting / Deductions collection
 */
export function subscribeExtraCuttings(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'extraCuttings'), orderBy('createdAt', 'desc'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching extra cuttings:', error);
    callback([]);
  });
}

/**
 * Add a new Extra Cutting / Deductions entry
 */
export async function addExtraCutting(data) {
  if (!db) throw new Error('Firestore not initialized');
  const weightKg = Number(data.weightKg || data.weight || 0);
  const rate = Number(data.rate || 0);
  const totalAmount = Number((weightKg * rate).toFixed(2));

  const ref = await addDoc(collection(db, 'extraCuttings'), {
    date: data.date || new Date().toISOString().split('T')[0],
    partyName: data.partyName || '',
    deductionDetails: data.deductionDetails || '',
    weightKg: weightKg,
    rate: rate,
    totalAmount: totalAmount,
    remarks: data.remarks || '',
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Delete an Extra Cutting entry
 */
export async function deleteExtraCutting(id) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'extraCuttings', id));
}
