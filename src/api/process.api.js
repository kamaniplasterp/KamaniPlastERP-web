import { 
  collection, 
  onSnapshot, 
  addDoc, 
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
 * Subscribe to real-time processes collection with fallback to defaults
 */
export function subscribeProcesses(callback, limitCount = 100) {
  if (!db) {
    callback(DEFAULT_PROCESS_LIST);
    return () => {};
  }
  const q = query(collection(db, 'processes'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(DEFAULT_PROCESS_LIST);
    } else {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(list);
    }
  }, (error) => {
    console.error('Error fetching processes:', error);
    callback(DEFAULT_PROCESS_LIST);
  });
}

/**
 * Add a new Process Master record
 */
export async function addProcess(data) {
  if (!db) throw new Error('Firestore not initialized');
  const ref = await addDoc(collection(db, 'processes'), {
    ...data,
    processCode: data.processCode || `PROC-${Math.floor(100 + Math.random() * 900)}`,
    defaultRatePerKg: Number(data.defaultRatePerKg || 0),
    isFixedWeight: Boolean(data.isFixedWeight),
    standardBagWeightKg: Number(data.standardBagWeightKg || 0),
    toleranceKg: Number(data.toleranceKg || 1.0),
    expectedScrapPct: Number(data.expectedScrapPct || 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Update an existing Process Master record
 */
export async function updateProcess(id, data) {
  if (!db) throw new Error('Firestore not initialized');
  const procRef = doc(db, 'processes', id);
  await updateDoc(procRef, {
    ...data,
    defaultRatePerKg: Number(data.defaultRatePerKg || 0),
    isFixedWeight: Boolean(data.isFixedWeight),
    standardBagWeightKg: Number(data.standardBagWeightKg || 0),
    toleranceKg: Number(data.toleranceKg || 1.0),
    expectedScrapPct: Number(data.expectedScrapPct || 0),
    updatedAt: serverTimestamp()
  });
}

/**
 * Delete a Process Master record
 */
export async function deleteProcess(id) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'processes', id));
}

/**
 * Seed default processes if collection is empty
 */
export async function seedDefaultProcesses() {
  if (!db) return;
  const snap = await getDocs(collection(db, 'processes'));
  if (snap.empty) {
    for (const proc of DEFAULT_PROCESS_LIST) {
      await addDoc(collection(db, 'processes'), {
        ...proc,
        createdAt: serverTimestamp()
      });
    }
  }
}
