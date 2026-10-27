import { 
  collection, 
  onSnapshot, 
  addDoc, 
  setDoc,
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp,
  query,
  limit,
  getDocs
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

export const DEFAULT_PROCESS_LIST = [
  {
    id: 'PROC-001',
    processCode: 'PROC-001',
    processName: 'Granules to Fishing Yarn',
    inputItemType: 'PP/HDPE Granules',
    outputItemType: 'Fishing Yarn',
    defaultRatePerKg: 5.00,
    isFixedWeight: true,
    standardBagWeightKg: 50.0,
    toleranceKg: 1.0,
    expectedScrapPct: 1.0,
    description: 'Extrusion of raw granules into continuous fishing yarn spools'
  },
  {
    id: 'PROC-002',
    processCode: 'PROC-002',
    processName: 'Fishing Yarn to Twine (3x3)',
    inputItemType: 'Fishing Yarn',
    outputItemType: 'Fishing Twine 3x3',
    defaultRatePerKg: 5.00,
    isFixedWeight: true,
    standardBagWeightKg: 50.0,
    toleranceKg: 1.0,
    expectedScrapPct: 0.5,
    description: 'Twisting & bundling fishing yarn into 3x3 twine hanks'
  },
  {
    id: 'PROC-003',
    processCode: 'PROC-003',
    processName: 'Fishing Yarn to Twine (4x3)',
    inputItemType: 'Fishing Yarn',
    outputItemType: 'Fishing Twine 4x3',
    defaultRatePerKg: 5.00,
    isFixedWeight: true,
    standardBagWeightKg: 50.0,
    toleranceKg: 1.0,
    expectedScrapPct: 0.5,
    description: 'Twisting & bundling fishing yarn into 4x3 twine bags'
  },
  {
    id: 'PROC-004',
    processCode: 'PROC-004',
    processName: 'VIP Yarn to Twine Hank',
    inputItemType: 'VIP Yarn',
    outputItemType: 'VIP Twine Hank',
    defaultRatePerKg: 17.50,
    isFixedWeight: true,
    standardBagWeightKg: 50.0,
    toleranceKg: 1.0,
    expectedScrapPct: 0.8,
    description: 'Hank conversion of VIP grade twine'
  },
  {
    id: 'PROC-005',
    processCode: 'PROC-005',
    processName: 'VIP Yarn to Twine Cone',
    inputItemType: 'VIP Yarn',
    outputItemType: 'VIP Twine Cone',
    defaultRatePerKg: 18.00,
    isFixedWeight: false,
    standardBagWeightKg: 0,
    toleranceKg: 0,
    expectedScrapPct: 1.0,
    description: 'Precision cone winding on 25g/100g spools'
  },
  {
    id: 'PROC-006',
    processCode: 'PROC-006',
    processName: 'Monofilament Extrusion',
    inputItemType: 'HDPE Granules',
    outputItemType: 'Monofilament Yarn',
    defaultRatePerKg: 22.00,
    isFixedWeight: false,
    standardBagWeightKg: 0,
    toleranceKg: 0,
    expectedScrapPct: 1.5,
    description: 'High tensile monofilament drawing'
  },
  {
    id: 'PROC-007',
    processCode: 'PROC-007',
    processName: 'Rope Winding & Packing',
    inputItemType: 'Twine / Strands',
    outputItemType: 'Finished Rope Coils',
    defaultRatePerKg: 15.00,
    isFixedWeight: true,
    standardBagWeightKg: 50.0,
    toleranceKg: 1.0,
    expectedScrapPct: 0.5,
    description: '3-strand rope winding into standard 50kg coils'
  }
];

/**
 * Subscribe to real-time processes collection directly from Firestore database
 */
export function subscribeProcesses(callback, limitCount = 100) {
  if (!db) {
    callback(DEFAULT_PROCESS_LIST);
    return () => {};
  }

  const q = query(collection(db, 'processes'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    // Sort by processCode
    list.sort((a, b) => (a.processCode || '').localeCompare(b.processCode || ''));
    callback(list);
  }, (error) => {
    console.error('Error fetching processes:', error);
    callback([]);
  });
}

/**
 * Add a new Process Master record directly to Firestore
 */
export async function addProcess(data) {
  if (!db) throw new Error('Firestore not initialized');
  const code = data.processCode || `PROC-${Math.floor(100 + Math.random() * 900)}`;
  const procRef = doc(db, 'processes', code);
  await setDoc(procRef, {
    ...data,
    processCode: code,
    defaultRatePerKg: Number(data.defaultRatePerKg || 0),
    isFixedWeight: Boolean(data.isFixedWeight),
    standardBagWeightKg: Number(data.standardBagWeightKg || 0),
    toleranceKg: Number(data.toleranceKg || 1.0),
    expectedScrapPct: Number(data.expectedScrapPct || 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return code;
}

/**
 * Update an existing Process Master record directly in Firestore
 */
export async function updateProcess(id, data) {
  if (!db) throw new Error('Firestore not initialized');
  const docId = id || data.processCode;
  const procRef = doc(db, 'processes', docId);
  await setDoc(procRef, {
    ...data,
    processCode: data.processCode || docId,
    defaultRatePerKg: Number(data.defaultRatePerKg || 0),
    isFixedWeight: Boolean(data.isFixedWeight),
    standardBagWeightKg: Number(data.standardBagWeightKg || 0),
    toleranceKg: Number(data.toleranceKg || 1.0),
    expectedScrapPct: Number(data.expectedScrapPct || 0),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Delete a Process Master record directly from Firestore
 */
export async function deleteProcess(id) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'processes', id));
}
