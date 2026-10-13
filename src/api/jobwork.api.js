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
import { 
  updateRmStock, 
  updateFgStock, 
  updateScrapStock, 
  logStockMovement, 
  addInventoryBagsBatch 
} from './inventory.api';

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
 * Generate next sequential delivery challan number formatted matching physical registers:
 * e.g. 000010126 / 1
 */
export async function getNextChallanNumber() {
  if (!db) {
    const fallbackSeq = 10126;
    return {
      baseChallan: String(fallbackSeq).padStart(9, '0'),
      subChallan: '1',
      formatted: `${String(fallbackSeq).padStart(9, '0')} / 1`
    };
  }

  try {
    const q = query(collection(db, 'jobWorks'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    let highestSeq = 10125;
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const rawCh = String(data.chNo || data.jwNo || '');
      const match = rawCh.match(/(\d{5,})/);
      if (match) {
        const val = parseInt(match[1], 10);
        if (!isNaN(val) && val > highestSeq && val < 900000000) {
          highestSeq = val;
        }
      }
    });

    const nextSeq = highestSeq + 1;
    const padded = String(nextSeq).padStart(9, '0');
    return {
      baseChallan: padded,
      subChallan: '1',
      formatted: `${padded} / 1`
    };
  } catch (err) {
    console.warn('Error calculating next challan, using fallback:', err);
    return {
      baseChallan: '000010126',
      subChallan: '1',
      formatted: '000010126 / 1'
    };
  }
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
    // Location & Routing (KPI, Marvel, Double Job Work)
    sourceLocation: data.sourceLocation || 'KPI Godown',
    targetLocation: data.targetLocation || data.vendor || 'Job Worker Site',
    isDoubleJobWork: Boolean(data.isDoubleJobWork),

    // Process Master Details
    process: data.process || data.processType || 'GRANUAL - FISHING YARN',
    processId: data.processId || '',
    isFixedWeight: Boolean(data.isFixedWeight),
    standardBagWeightKg: Number(data.standardBagWeightKg || 0),

    // Dispatched Accessories / Packing Material (Kokda, LD Bags, Outer Thela)
    spoolsCount: Number(data.spoolsCount || 0),
    spoolsQtyKg: Number(data.spoolsQtyKg || 0),
    ldBagsQtyKg: Number(data.ldBagsQtyKg || 0),
    outerBagsCount: Number(data.outerBagsCount || 0),

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
    location: `${jwDoc.sourceLocation} -> ${data.vendor || 'Job Worker'}`,
    remarks: data.remarks || `Dispatched ${sentKg} KG to ${data.vendor || 'Job Worker'} from ${jwDoc.sourceLocation}`
  });

  return docRef.id;
}

/**
 * Receive partial or full completed material from Job Worker atomically
 * Incorporates Accessories Usage Deductions, Net Material Reconciliation & Bag Serials
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
  remarks,
  // Accessories & Reconciliation
  spoolsRemainingKg = 0,
  ldBagsRemainingKg = 0,
  outerBagsRemainingCount = 0,
  rawMaterialRemainingKg = 0,
  scrapRatePerKg = 70,
  targetGodown = 'KPI Godown',
  bagsList = [],
  lineItems = []
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

  let calculatedNetMaterialKg = Number(recQtyKg || 0);
  let effectiveScrapKg = Number(scrapQtyKg || 0);

  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(targetRef);
    const existingData = docSnap.exists() ? docSnap.data() : {};
    
    // Accessories consumption
    const spoolsDispatched = Number(existingData.spoolsQtyKg || 0);
    const spoolsUsed = Math.max(0, spoolsDispatched - Number(spoolsRemainingKg || 0));
    const ldBagsDispatched = Number(existingData.ldBagsQtyKg || 0);
    const ldBagsUsed = Math.max(0, ldBagsDispatched - Number(ldBagsRemainingKg || 0));
    const outerBagsDispatched = Number(existingData.outerBagsCount || 0);
    const outerBagsUsed = Math.max(0, outerBagsDispatched - Number(outerBagsRemainingCount || 0));

    // If gross weight provided, deduce used accessories to arrive at net product
    if (Number(recGrossWeight) > 0 && (spoolsUsed > 0 || ldBagsUsed > 0)) {
      calculatedNetMaterialKg = Math.max(0, Number(recGrossWeight) - (spoolsUsed + ldBagsUsed));
    } else if (Number(recQtyKg) > 0) {
      calculatedNetMaterialKg = Number(recQtyKg);
    } else {
      calculatedNetMaterialKg = Number(recGrossWeight || 0);
    }

    const sentTotal = Number(existingData.sentQtyKg) || Number(totalSentKg) || calculatedNetMaterialKg;
    const rmConsumed = Math.max(0, sentTotal - Number(rawMaterialRemainingKg || 0));

    if (effectiveScrapKg <= 0 && Number(rawMaterialRemainingKg) >= 0 && rmConsumed > calculatedNetMaterialKg) {
      effectiveScrapKg = Math.max(0, rmConsumed - calculatedNetMaterialKg);
    }

    const rateNum = Number(ratePerKg || existingData.ratePerKg || 0);
    const processingPayable = calculatedNetMaterialKg * rateNum;
    const scrapRebate = effectiveScrapKg * Number(scrapRatePerKg || 70);
    const netPayable = Math.max(0, processingPayable - scrapRebate);

    const receiptEntry = {
      slipNo: receiptSlip,
      date: dateOfReceipt,
      grossWeight: Number(recGrossWeight || calculatedNetMaterialKg),
      boraCount: Number(recBoraCount || 0),
      articleType: recArticleType,
      articleWeight: Number(recArticleWeight || 0),
      netQtyKg: calculatedNetMaterialKg,
      reworkQtyKg: Number(reworkQtyKg || 0),
      rejectionQtyKg: Number(rejectionQtyKg || 0),
      scrapQtyKg: effectiveScrapKg,
      samplePcs: Number(samplePcs || 0),
      sampleWeight: Number(sampleWeight || 0),
      receivedBy: receivedBy,
      ratePerKg: rateNum,
      processingPayable: processingPayable,
      scrapRatePerKg: Number(scrapRatePerKg || 70),
      scrapRebate: scrapRebate,
      netPayable: netPayable,
      value: processingPayable,
      // Accessories Audit
      spoolsRemainingKg: Number(spoolsRemainingKg || 0),
      spoolsUsedKg: spoolsUsed,
      ldBagsRemainingKg: Number(ldBagsRemainingKg || 0),
      ldBagsUsedKg: ldBagsUsed,
      outerBagsRemainingCount: Number(outerBagsRemainingCount || 0),
      outerBagsUsedCount: outerBagsUsed,
      rawMaterialRemainingKg: Number(rawMaterialRemainingKg || 0),
      targetGodown: targetGodown,
      lineItems: Array.isArray(lineItems) ? lineItems : [],
      remarks: remarks || '',
      recordedAt: new Date().toISOString()
    };

    const recSoFar = (Number(existingData.recQtyKg) || Number(currentRecKg) || 0) + calculatedNetMaterialKg;
    const scrapSoFar = (Number(existingData.scrapQtyKg) || Number(currentScrapKg) || 0) + effectiveScrapKg;
    const reworkSoFar = (Number(existingData.reworkQtyKg) || 0) + Number(reworkQtyKg || 0);
    const rejectionSoFar = (Number(existingData.rejectionQtyKg) || 0) + Number(rejectionQtyKg || 0);
    const recBoraSoFar = (Number(existingData.recBoraCount) || 0) + Number(recBoraCount || 0);

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

  // If bag list was generated, write bags to inventory_bags
  if (Array.isArray(bagsList) && bagsList.length > 0) {
    try {
      await addInventoryBagsBatch(bagsList.map((b, idx) => ({
        bagNumber: b.bagNumber !== undefined ? b.bagNumber : (idx + 1),
        inwardSlipNo: receiptSlip,
        jobWorkNo: jwId,
        productName: itemLabel || 'Processed Material',
        quality: b.quality || 'ANDN',
        size: b.size || '3x3',
        standardWeightKg: Number(b.standardWeightKg || 50),
        actualWeightKg: Number(b.actualWeightKg || 50),
        coilCount: Number(b.coilCount || 12),
        stockType: b.stockType || (Number(b.actualWeightKg) >= 48 ? 'FIXED' : 'LOOSE'),
        location: targetGodown,
        status: 'AVAILABLE',
        receivedAt: dateOfReceipt
      })));
    } catch (bagErr) {
      console.error('Error saving bag serials:', bagErr);
    }
  }

  // 1. Deduct RM consumed from Job Worker balance (factory polymer is NOT incremented; it converted to FG)
  const totalDeduction = calculatedNetMaterialKg + effectiveScrapKg + Number(rejectionQtyKg || 0);
  if (rawMaterialId) {
    await updateRmStock(rawMaterialId, 0, -totalDeduction);
  }

  // 2. Increment Finished Goods Inventory for processed items
  const coilsReceived = (Array.isArray(bagsList) && bagsList.length > 0)
    ? bagsList.reduce((acc, b) => acc + (Number(b.coilCount) || 12), 0)
    : Math.round(calculatedNetMaterialKg / 4.16); // Standard ~12 coils per 50kg bag

  await updateFgStock(data.fgSkuId || itemLabel || 'Processed Material', coilsReceived, 0, {
    name: itemLabel || 'Processed Material',
    location: targetGodown,
    category: 'Job Work Output'
  });

  // 3. Update physical Scrap inventory if scrap was recovered
  if (effectiveScrapKg > 0) {
    await updateScrapStock(effectiveScrapKg, Number(scrapRatePerKg || 70));
    await logStockMovement({
      type: 'Scrap Inward',
      typeBadge: 'inv-badge-scrap',
      icon: '♻️',
      ref: receiptSlip,
      item: `Recovered Scrap (${itemLabel || 'Job Work'})`,
      batch: 'SCRAP-RECOVERY',
      inward: `+${effectiveScrapKg} KG`,
      outward: '0 KG',
      location: `Job Worker -> Scrap Bay`,
      remarks: `Scrap recovered from Job Worker under ${receiptSlip} @ ₹${scrapRatePerKg || 70}/kg`
    });
  }

  // 4. Log Finished Goods stock movement
  await logStockMovement({
    type: 'JWReturn',
    typeBadge: 'inv-badge-jwreturn',
    icon: '↙',
    ref: receiptSlip,
    item: itemLabel || 'Processed Material',
    batch: 'WIP-RECEIPT',
    inward: `+${coilsReceived} Coils (${calculatedNetMaterialKg} KG)`,
    outward: '0 KG',
    location: `Job Worker -> ${targetGodown}`,
    remarks: remarks || `Receipt Slip ${receiptSlip} of ${calculatedNetMaterialKg} KG (${recBoraCount} Bags) at ${targetGodown}`
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
