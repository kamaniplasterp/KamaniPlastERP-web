import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc,
  setDoc,
  writeBatch,
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
import { createQcCheck } from './qc.api';
import { logAuditEvent } from './audit.api';
import { createNotification } from './notifications.api';

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

  logAuditEvent({
    category: 'INVENTORY',
    action: 'RAW_MATERIAL_SKU_CREATED',
    summary: `Created Raw Material SKU: ${data.name || 'RM'} (${data.code || docRef.id}) with opening stock ${availQty} KG`,
    targetId: data.code || docRef.id,
    details: data
  });

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
    diaColor: data.diaColor || (data.diaSize ? `${data.diaSize} • ${data.colorTracer || data.color || ''}` : (data.size ? `${data.size} • ${data.color || ''}` : '')),
    diaSize: data.diaSize || data.size || '',
    colorTracer: data.colorTracer || data.color || '',
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

  logAuditEvent({
    category: 'INVENTORY',
    action: 'FINISHED_GOODS_SKU_CREATED',
    summary: `Created Finished Good SKU: ${data.name || 'FG'} (${data.code || docRef.id}) with initial stock ${stockQty} Coils`,
    targetId: data.code || docRef.id,
    details: data
  });

  return docRef.id;
}

/**
 * Update RM Stock counts safely using atomic Firestore runTransaction
 */
export async function updateRmStock(skuId, factoryDelta = 0, jwDelta = 0, looseDelta = 0) {
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
        const newLoose = Math.max(0, (Number(fbData.looseStockKg) || 0) + looseDelta);
        const reorderLvl = Number(fbData.reorderLevel || 1000);
        const newStatus = newAvail >= reorderLvl ? 'IN STOCK' : newAvail > 0 ? 'LOW STOCK' : 'OUT OF STOCK';

        transaction.update(fbRef, {
          availFactory: newAvail,
          atJobWork: newJw,
          looseStockKg: newLoose,
          status: newStatus,
          updatedAt: serverTimestamp()
        });
        return;
      }

      const data = docSnap.data();
      const newAvail = Math.max(0, (Number(data.availFactory) || 0) + factoryDelta);
      const newJw = Math.max(0, (Number(data.atJobWork) || 0) + jwDelta);
      const newLoose = Math.max(0, (Number(data.looseStockKg) || 0) + looseDelta);
      const reorderLvl = Number(data.reorderLevel || 1000);
      const newStatus = newAvail >= reorderLvl ? 'IN STOCK' : newAvail > 0 ? 'LOW STOCK' : 'OUT OF STOCK';

      transaction.update(targetRef, {
        availFactory: newAvail,
        atJobWork: newJw,
        looseStockKg: newLoose,
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    });
  } catch (err) {
    console.error('Error updating RM stock atomically:', err);
  }
}

/**
 * Update Loose Stock quantity in KG (Change 6)
 */
export async function updateLooseStock(rawMaterialId, deltaKg) {
  return updateRmStock(rawMaterialId, 0, 0, deltaKg);
}

/**
 * Update FG Stock counts safely using atomic Firestore runTransaction
 */
export async function updateFgStock(skuId, stockDelta = 0, reservedDelta = 0, meta = {}) {
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
      if (stockDelta > 0) {
        // Auto-create FG doc if new variant is received from Job Work
        const codeClean = String(skuId || 'FG').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 15).toUpperCase();
        await addDoc(collection(db, 'finishedGoods'), {
          code: meta.code || `FG-${codeClean}-${Date.now().toString().slice(-4)}`,
          name: meta.name || String(skuId),
          category: meta.category || 'Job Work Output',
          desc: meta.desc || `Finished Goods processed: ${skuId}`,
          stockQty: Math.max(0, stockDelta),
          reservedQty: Math.max(0, reservedDelta),
          rate: Number(meta.rate || 2450),
          location: meta.location || 'Finished Goods Bay',
          status: 'IN STOCK',
          reorderLevel: 50,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        return;
      }
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
 * Update physical Scrap stock atomically
 */
export async function updateScrapStock(scrapDeltaKg = 0, defaultRate = 70) {
  if (!db || !scrapDeltaKg) return;
  try {
    const scrapRef = doc(db, 'settings', 'scrapInventory');
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(scrapRef);
      const existing = snap.exists() ? snap.data() : { totalScrapKg: 0, defaultRate };
      const currentKg = Number(existing.totalScrapKg || 0);
      const newKg = Math.max(0, currentKg + scrapDeltaKg);
      transaction.set(scrapRef, {
        totalScrapKg: newKg,
        defaultRate: Number(defaultRate || 70),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
  } catch (err) {
    console.error('Error updating scrap stock:', err);
  }
}

/**
 * Subscribe to real-time physical Scrap stock
 */
export function subscribeScrapStock(callback) {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'settings', 'scrapInventory'), (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data());
    } else {
      callback({ totalScrapKg: 0, defaultRate: 70 });
    }
  }, (err) => {
    console.error('Error fetching scrap stock:', err);
    callback({ totalScrapKg: 0, defaultRate: 70 });
  });
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

  const looseStockKg = Number(data.looseStockKg || 0);
  const bagCount = Number(data.bagCount || (boraCount || 0));
  const bagStockKg = Number(data.bagStockKg || (netInwardKg > looseStockKg ? netInwardKg - looseStockKg : netInwardKg));

  const grnDocData = {
    grnNo: data.grnNo || `GRN-${Math.floor(1000 + Math.random() * 9000)}`,
    challanNo: data.challanNo || '',
    date: data.date || new Date().toISOString().split('T')[0],
    supplierName: data.supplierName || 'RAMJIBHAI',
    itemName: data.itemName || 'GRANUALS-HDPE',
    grade: data.grade || 'HD',
    // 5 material attributes & batch (Change 3)
    materialForm: data.materialForm || 'Granule',
    materialColor: data.materialColor || 'Natural',
    packaging: data.packaging || 'Woven Bag',
    laminationType: data.laminationType || (data.isLaminated ? 'Laminated' : 'Non-Laminated'),
    isLaminated: Boolean(data.isLaminated || data.laminationType === 'Laminated'),
    batchNumber: data.batchNumber || `BATCH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    grossWeight: grossWght,
    noOfArticles: boraCount,
    articleType,
    articleWeight: articleTareWeight,
    varianceKg: articleTareWeight, // Tare deduction / variance (Change 4)
    tareDeduct: articleTareWeight,
    isTareVarianceExceeded: Boolean(data.isTareVarianceExceeded !== undefined ? data.isTareVarianceExceeded : (articleTareWeight > Number(data.varianceThresholdKg || 50))),
    tareVarianceKg: articleTareWeight,
    varianceThresholdKg: Number(data.varianceThresholdKg || 50),
    netWeight: netInwardKg,
    challanWeight: Number(data.challanWeight || 0),
    shortfallKg: Number(data.shortfallKg || 0),
    isShortDelivery: Boolean(data.isShortDelivery),
    // Dual stock system (Change 6)
    bagCount,
    bagStockKg,
    looseStockKg,
    rate: Number(data.rate || 112),
    receivedBy: data.receivedBy || 'SURESHBHAI',
    remarks: data.remarks || 'Raw material inward received',
    createdAt: serverTimestamp()
  };

  const grnRef = await addDoc(collection(db, 'rmInwards'), grnDocData);

  // Record Audit Trail
  logAuditEvent({
    category: 'INVENTORY',
    action: 'RAW_MATERIAL_INWARD_CREATED',
    summary: `Inward GRN ${grnDocData.grnNo} recorded for ${grnDocData.supplierName} (${grnDocData.itemName} - ${grnDocData.netWeight} KG net)`,
    targetId: grnDocData.grnNo,
    details: {
      grnId: grnRef.id,
      grnNo: grnDocData.grnNo,
      supplierName: grnDocData.supplierName,
      challanNo: grnDocData.challanNo,
      netWeight: grnDocData.netWeight,
      grossWeight: grnDocData.grossWeight,
      bagCount: grnDocData.bagCount
    }
  });

  // Auto-trigger Mandatory QC Workflow (Change 5)
  try {
    await createQcCheck(grnRef.id, {
      ...grnDocData,
      id: grnRef.id
    });
  } catch (qcErr) {
    console.warn('Auto create QC check error:', qcErr);
  }

  // Trigger Tare Variance or Weight Discrepancy Notification
  if (grnDocData.isTareVarianceExceeded || (grnDocData.tareDeduct > Number(grnDocData.varianceThresholdKg || 50))) {
    const diff = (grnDocData.tareDeduct - Number(grnDocData.varianceThresholdKg || 50)).toFixed(1);
    createNotification({
      sourceKey: `TARE_EXCEEDED_${grnDocData.grnNo}`,
      title: `Tare Variance Exceeded: ${grnDocData.grnNo}`,
      message: `Tare deduction of ${grnDocData.tareDeduct} KG exceeds threshold (${grnDocData.varianceThresholdKg || 50} KG) by ${diff} KG. Bag count: ${grnDocData.bagCount}.`,
      category: 'WEIGHT',
      severity: 'high',
      targetRoles: ['admin'],
      actionPath: '/inventory',
      actionState: { tab: 'rm', subView: 'inward', search: grnDocData.batchNumber || grnDocData.grnNo },
      meta: `${grnDocData.supplierName} • ${grnDocData.itemName} • Inward: ${grnDocData.date}`,
      timeTag: 'Tare Exceeded'
    }).catch(console.warn);
  }

  if (Number(grnDocData.challanWeight) > 0 && Number(grnDocData.challanWeight) > Number(grnDocData.grossWeight)) {
    const diff = (Number(grnDocData.challanWeight) - Number(grnDocData.grossWeight)).toFixed(1);
    createNotification({
      sourceKey: `WEIGHT_DISCREPANCY_${grnDocData.grnNo}`,
      title: `Weight Discrepancy: ${grnDocData.grnNo}`,
      message: `Billed weight (${Number(grnDocData.challanWeight).toLocaleString()} KG) exceeds Gross (${Number(grnDocData.grossWeight).toLocaleString()} KG) by ${diff} KG. Batch: ${grnDocData.batchNumber || '—'}.`,
      category: 'WEIGHT',
      severity: 'high',
      targetRoles: ['admin', 'accountant'],
      actionPath: '/inventory',
      actionState: { tab: 'rm', subView: 'inward', search: grnDocData.batchNumber || grnDocData.grnNo },
      meta: `${grnDocData.supplierName} • Challan #${grnDocData.challanNo || '—'}`,
      timeTag: grnDocData.date || 'Recent'
    }).catch(console.warn);
  }

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
    await updateRmStock(matchedRm.id, netInwardKg, 0, looseStockKg);
  } else {
    await addRawMaterial({
      code: `RM-${(data.itemName || 'POLY').slice(0, 4).toUpperCase()}-${(data.grade || 'STD').slice(0, 3).toUpperCase()}`,
      name: data.itemName,
      brand: data.supplierName,
      grade: data.grade,
      desc: `${data.itemName} ^ ${data.grade} (${grnDocData.materialForm})`,
      availFactory: netInwardKg,
      looseStockKg: looseStockKg,
      rate: Number(data.rate || 112),
      reorderLevel: 1000
    });
  }

  await logStockMovement({
    type: 'Receipt',
    typeBadge: 'inv-badge-receipt',
    icon: '📦',
    ref: data.grnNo || `GRN-INWARD`,
    item: `${data.itemName} ^ ${data.grade} (${grnDocData.materialForm})`,
    batch: grnDocData.batchNumber,
    inward: `+${netInwardKg} KG`,
    outward: '0 KG',
    location: 'Factory Main Silo',
    remarks: `Inward from ${data.supplierName} (${bagCount} bags, ${looseStockKg} KG loose)`
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

  // Record Audit Trail
  logAuditEvent({
    category: 'INVENTORY',
    action: 'FACTORY_MATERIAL_ISSUE',
    summary: `Factory Issue ${data.slipNo || 'SLIP'} recorded: ${netWght} KG of ${data.itemName || 'RM'} to plant extrusion by ${data.issuedBy || 'Supervisor'}`,
    targetId: data.slipNo || 'FACTORY_ISSUE',
    details: {
      slipNo: data.slipNo,
      itemName: data.itemName,
      netWeight: netWght,
      issuedBy: data.issuedBy,
      remarks: data.remarks
    }
  });

  return issueRef.id;
}

export const DEFAULT_SAMPLE_BAGS = [];

/**
 * Subscribe to real-time individual Bag Serials inventory
 */
export function subscribeInventoryBags(callback, limitCount = 300) {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'inventory_bags'), orderBy('bagNumber', 'asc'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback([]);
    } else {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(list);
    }
  }, (error) => {
    console.error('Error fetching inventory bags:', error);
    callback([]);
  });
}

/**
 * Add a batch of individual bags into inventory_bags collection
 */
export async function addInventoryBagsBatch(bagsArray) {
  if (!db) throw new Error('Firestore not initialized');
  const addedIds = [];
  for (const bag of bagsArray) {
    const docRef = await addDoc(collection(db, 'inventory_bags'), {
      ...bag,
      bagNumber: Number(bag.bagNumber || 1),
      standardWeightKg: Number(bag.standardWeightKg || 50),
      actualWeightKg: Number(bag.actualWeightKg || 0),
      coilCount: Number(bag.coilCount || 0),
      status: bag.status || 'AVAILABLE',
      createdAt: serverTimestamp()
    });
    addedIds.push(docRef.id);
  }

  logAuditEvent({
    category: 'INVENTORY',
    action: 'BAG_BATCH_PACKAGED',
    summary: `Packaged and barcoded batch of ${addedIds.length} bags in inventory (${bagsArray[0]?.skuCode || 'SKU'})`,
    targetId: `BATCH-${addedIds.length}-BAGS`,
    details: { count: addedIds.length, sample: bagsArray[0] }
  });

  return addedIds;
}

/**
 * Update an individual bag status or location
 */
export async function updateInventoryBag(id, updates) {
  if (!db) throw new Error('Firestore not initialized');
  const bagRef = doc(db, 'inventory_bags', id);
  await updateDoc(bagRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });

  logAuditEvent({
    category: 'INVENTORY',
    action: 'BAG_STATUS_UPDATED',
    summary: `Updated inventory bag ${id}: status changed to ${updates.status || 'Updated'}`,
    targetId: id,
    details: updates
  });
}

/**
 * Delete an inventory bag
 */
export async function deleteInventoryBag(id) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'inventory_bags', id));

  logAuditEvent({
    category: 'INVENTORY',
    action: 'BAG_DELETED',
    summary: `Deleted inventory bag record ${id}`,
    targetId: id
  });
}

/**
 * Allocate and mark bags as DISPATCHED in inventory_bags collection
 */
export async function dispatchInventoryBags({ bagIds = [], requiredCoils = 0, dispatchDetails = {} }) {
  if (!db) return [];
  try {
    let targetsToUpdate = [];

    if (bagIds && bagIds.length > 0) {
      // 1. Explicitly selected bags
      targetsToUpdate = [...bagIds];
    } else if (requiredCoils > 0) {
      // 2. FIFO automatic allocation
      const q = query(
        collection(db, 'inventory_bags'),
        where('status', '==', 'AVAILABLE'),
        orderBy('bagNumber', 'asc'),
        limit(100)
      );
      const snap = await getDocs(q);
      let allocatedCoils = 0;
      for (const d of snap.docs) {
        if (allocatedCoils >= requiredCoils) break;
        const bData = d.data();
        allocatedCoils += (Number(bData.coilCount) || 12);
        targetsToUpdate.push(d.id);
      }
    }

    if (targetsToUpdate.length > 0) {
      const batch = writeBatch(db);
      for (const id of targetsToUpdate) {
        const bRef = doc(db, 'inventory_bags', id);
        batch.update(bRef, {
          status: 'DISPATCHED',
          dispatchChallanNo: dispatchDetails.challanNo || '',
          dispatchNo: dispatchDetails.dispatchNo || '',
          customer: dispatchDetails.customer || '',
          dispatchedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
    }
    return targetsToUpdate;
  } catch (err) {
    console.error('Error dispatching inventory bags:', err);
    return [];
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * MATERIAL LOOSE STOCK & PACKING ENGINE
 * Plastic loose stock is tracked strictly by weight (KG) per material spec.
 * Discrete serialized bags are only created when packing loose stock into bags.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Helper to build sanitized material key
 */
export function getMaterialStockKey(quality = 'VIP', form = 'Hank', size = 'Standard') {
  return `${quality || 'VIP'}_${form || 'Hank'}_${size || 'Standard'}`
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Subscribe to real-time Material Loose Stock balances
 */
export function subscribeMaterialLooseStock(callback) {
  if (!db) {
    callback([]);
    return () => {};
  }
  const q = collection(db, 'material_loose_stock');
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback([]);
    } else {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(list);
    }
  }, (error) => {
    console.error('Error fetching material loose stock:', error);
    callback([]);
  });
}

/**
 * Update material loose stock balance by delta (in KG)
 */
export async function updateMaterialLooseStock(materialData, deltaKg = 0, user = null) {
  if (!db || !deltaKg) return;
  const quality = materialData.quality || 'VIP';
  const form = materialData.form || 'Hank';
  const size = materialData.size || 'Standard';
  const color = materialData.color || 'Natural';
  const location = materialData.location || 'KPI Godown';

  const docKey = materialData.id || getMaterialStockKey(quality, form, size);
  const stockRef = doc(db, 'material_loose_stock', docKey);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(stockRef);
    const existing = snap.exists() ? snap.data() : {
      materialKey: docKey,
      quality,
      form,
      size,
      color,
      location,
      looseWeightKg: 0
    };

    const currentWeight = Number(existing.looseWeightKg || 0);
    const newWeight = Math.max(0, parseFloat((currentWeight + deltaKg).toFixed(2)));

    transaction.set(stockRef, {
      ...existing,
      materialKey: docKey,
      quality: existing.quality || quality,
      form: existing.form || form,
      size: existing.size || size,
      color: existing.color || color,
      location: location || existing.location || 'KPI Godown',
      looseWeightKg: newWeight,
      updatedAt: serverTimestamp(),
      updatedBy: user?.name || user?.email || 'System'
    }, { merge: true });
  });

  logAuditEvent({
    category: 'INVENTORY',
    action: deltaKg > 0 ? 'LOOSE_STOCK_CREDITED' : 'LOOSE_STOCK_DEBITED',
    summary: `${deltaKg > 0 ? 'Credited' : 'Debited'} ${Math.abs(deltaKg).toFixed(1)} KG loose stock for ${quality} ${form} ${size}`,
    targetId: docKey,
    details: { quality, form, size, deltaKg, location }
  });
}

/**
 * Pack Loose Stock into discrete Standard Bags
 * Creates sequential serialized bags in inventory_bags and deducts weight from loose stock.
 */
export async function packLooseStockIntoBags({
  materialKey,
  quality = 'VIP',
  form = 'Hank',
  size = 'Standard',
  color = 'Natural',
  targetBagWeightKg = 50.0,
  bagCount = 1,
  coilsPerBag = 12,
  location = 'KPI Godown',
  lotNo = '',
  user = null
}) {
  if (!db) throw new Error('Firestore not initialized');
  const count = parseInt(bagCount, 10);
  const bagWeight = parseFloat(targetBagWeightKg) || 50.0;
  if (!count || count <= 0) throw new Error('Bag count must be at least 1');
  if (bagWeight <= 0) throw new Error('Target bag weight must be greater than 0');

  const totalDeductedKg = parseFloat((count * bagWeight).toFixed(2));
  const docKey = materialKey || getMaterialStockKey(quality, form, size);
  const stockRef = doc(db, 'material_loose_stock', docKey);

  // 1. Verify available loose stock
  const stockSnap = await getDoc(stockRef);
  const existingStock = stockSnap.exists() ? (Number(stockSnap.data().looseWeightKg) || 0) : 0;
  if (existingStock < totalDeductedKg) {
    throw new Error(`Insufficient loose stock: available ${existingStock.toFixed(1)} KG, requested ${totalDeductedKg.toFixed(1)} KG for ${count} bags`);
  }

  // 2. Find highest existing bag number in inventory_bags
  const bagQuery = query(collection(db, 'inventory_bags'), orderBy('bagNumber', 'desc'), limit(1));
  const maxSnap = await getDocs(bagQuery);
  let highestBagNumber = 0;
  if (!maxSnap.empty) {
    highestBagNumber = Number(maxSnap.docs[0].data().bagNumber) || 0;
  }

  const generatedBags = [];
  const currentDate = new Date().toISOString().slice(0, 10);
  const packLot = lotNo || `PACK-${currentDate.replace(/-/g, '')}-${quality.toUpperCase().slice(0, 3)}`;

  // 3. Create bags in batch
  const batch = writeBatch(db);
  for (let i = 1; i <= count; i++) {
    const nextBagNum = highestBagNumber + i;
    const bagRef = doc(collection(db, 'inventory_bags'));
    const bagData = {
      id: bagRef.id,
      bagNumber: nextBagNum,
      inwardSlipNo: packLot,
      jobWorkNo: '',
      productName: `${quality} ${form} ${size}`,
      quality,
      form,
      size,
      color,
      standardWeightKg: bagWeight,
      actualWeightKg: bagWeight,
      coilCount: Number(coilsPerBag) || 12,
      stockType: 'FIXED',
      location,
      status: 'AVAILABLE',
      lotGroup: packLot,
      lotTitle: `${count} Bags Packed from Loose Stock (${quality} ${form} ${size})`,
      packedFromLoose: true,
      packedAt: serverTimestamp(),
      receivedAt: currentDate,
      packedBy: user?.name || user?.email || 'Storekeeper',
      createdAt: serverTimestamp()
    };
    batch.set(bagRef, bagData);
    generatedBags.push(bagData);
  }

  // 4. Deduct weight from material_loose_stock
  const remainingWeight = Math.max(0, parseFloat((existingStock - totalDeductedKg).toFixed(2)));
  batch.update(stockRef, {
    looseWeightKg: remainingWeight,
    updatedAt: serverTimestamp(),
    updatedBy: user?.name || user?.email || 'Storekeeper'
  });

  await batch.commit();

  // 5. Log audit event
  logAuditEvent({
    category: 'INVENTORY',
    action: 'LOOSE_STOCK_PACKED_INTO_BAGS',
    summary: `Packed ${totalDeductedKg} KG of loose ${quality} ${form} ${size} into ${count} standard bags (#${highestBagNumber + 1} to #${highestBagNumber + count})`,
    targetId: packLot,
    details: {
      quality,
      form,
      size,
      bagCount: count,
      targetBagWeightKg: bagWeight,
      totalWeightKg: totalDeductedKg,
      startBagNumber: highestBagNumber + 1,
      endBagNumber: highestBagNumber + count,
      remainingLooseKg: remainingWeight
    }
  });

  return generatedBags;
}

/**
 * Consolidate Legacy Loose Bags from inventory_bags into Material Loose Stock
 * Converts any legacy 'LOOSE' bag records (e.g. Bag 68-75) into loose material weight in KG,
 * and removes them from the discrete bag register so bags are only standard fixed bags.
 */
export async function consolidateLegacyLooseBags(user = null) {
  if (!db) throw new Error('Firestore not initialized');

  // Fetch all bags with stockType === 'LOOSE'
  const snap = await getDocs(collection(db, 'inventory_bags'));
  const looseBagDocs = snap.docs.filter(d => {
    const data = d.data();
    return String(data.stockType || '').toUpperCase() === 'LOOSE';
  });

  if (looseBagDocs.length === 0) {
    return { consolidatedCount: 0, totalWeightKg: 0, materials: [] };
  }

  // Group by material specification
  const groups = new Map();
  let totalConsolidatedKg = 0;

  for (const docSnap of looseBagDocs) {
    const data = docSnap.data();
    const quality = data.quality || 'VIP';
    const form = data.form || 'Hank';
    const size = data.size || 'Standard';
    const color = data.color || 'Natural';
    const location = data.location || 'KPI Godown';
    const weight = Number(data.actualWeightKg) || Number(data.standardWeightKg) || 0;

    const key = getMaterialStockKey(quality, form, size);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        quality,
        form,
        size,
        color,
        location,
        totalWeightKg: 0,
        bagIds: []
      });
    }

    const grp = groups.get(key);
    grp.totalWeightKg = parseFloat((grp.totalWeightKg + weight).toFixed(2));
    grp.bagIds.push(docSnap.id);
    totalConsolidatedKg = parseFloat((totalConsolidatedKg + weight).toFixed(2));
  }

  // Execute updates & deletes in batched writes
  const materialsSummary = [];
  const batch = writeBatch(db);

  for (const [key, grp] of groups.entries()) {
    const stockRef = doc(db, 'material_loose_stock', key);
    const existingSnap = await getDoc(stockRef);
    const existingWeight = existingSnap.exists() ? (Number(existingSnap.data().looseWeightKg) || 0) : 0;
    const newWeight = parseFloat((existingWeight + grp.totalWeightKg).toFixed(2));

    batch.set(stockRef, {
      materialKey: key,
      quality: grp.quality,
      form: grp.form,
      size: grp.size,
      color: grp.color,
      location: grp.location,
      looseWeightKg: newWeight,
      updatedAt: serverTimestamp(),
      updatedBy: user?.name || user?.email || 'Admin Consolidation'
    }, { merge: true });

    // Delete legacy loose bags from inventory_bags
    for (const bagId of grp.bagIds) {
      batch.delete(doc(db, 'inventory_bags', bagId));
    }

    materialsSummary.push({
      material: `${grp.quality} ${grp.form} ${grp.size}`,
      weightKg: grp.totalWeightKg,
      bagsRemoved: grp.bagIds.length
    });
  }

  await batch.commit();

  logAuditEvent({
    category: 'INVENTORY',
    action: 'LEGACY_LOOSE_BAGS_CONSOLIDATED',
    summary: `Consolidated ${looseBagDocs.length} legacy loose bags (${totalConsolidatedKg.toFixed(1)} KG) into material loose stock`,
    targetId: 'MIGRATION-LOOSE-STOCK',
    details: {
      bagsRemoved: looseBagDocs.length,
      totalWeightKg: totalConsolidatedKg,
      materials: materialsSummary
    }
  });

  return {
    consolidatedCount: looseBagDocs.length,
    totalWeightKg: totalConsolidatedKg,
    materials: materialsSummary
  };
}


