import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { logAuditEvent } from './audit.api';

export const DEFAULT_PROCESS_MATERIALS_SEED = [
  { id: 'PMAT-IN-01', code: 'PM-IN-01', name: 'PP/HDPE Granules', type: 'INPUT', category: 'Polymer Granule' },
  { id: 'PMAT-IN-02', code: 'PM-IN-02', name: 'HDPE Granules', type: 'INPUT', category: 'Polymer Granule' },
  { id: 'PMAT-IN-03', code: 'PM-IN-03', name: 'PP Granules', type: 'INPUT', category: 'Polymer Granule' },
  { id: 'PMAT-IN-04', code: 'PM-IN-04', name: 'Fishing Yarn', type: 'BOTH', category: 'Monofilament Yarn' },
  { id: 'PMAT-IN-05', code: 'PM-IN-05', name: 'VIP Yarn', type: 'BOTH', category: 'Raffia / Tape Yarn' },
  { id: 'PMAT-IN-06', code: 'PM-IN-06', name: 'Twine / Strands', type: 'INPUT', category: 'Twine' },
  { id: 'PMAT-IN-07', code: 'PM-IN-07', name: 'Color Masterbatch', type: 'INPUT', category: 'Additive / Color' },
  { id: 'PMAT-IN-08', code: 'PM-IN-08', name: 'Regrind / Grinder', type: 'INPUT', category: 'Recycled Polymer' },
  { id: 'PMAT-IN-09', code: 'PM-IN-09', name: 'Mamri', type: 'INPUT', category: 'Raw Polymer' },
  { id: 'PMAT-IN-10', code: 'PM-IN-10', name: 'Powder', type: 'INPUT', category: 'Polymer Powder' },
  { id: 'PMAT-OUT-01', code: 'PM-OUT-01', name: 'Fishing Twine 3x3', type: 'OUTPUT', category: 'Twine Hank' },
  { id: 'PMAT-OUT-02', code: 'PM-OUT-02', name: 'Fishing Twine 4x3', type: 'OUTPUT', category: 'Twine Hank' },
  { id: 'PMAT-OUT-03', code: 'PM-OUT-03', name: 'VIP Twine Hank', type: 'OUTPUT', category: 'Twine Hank' },
  { id: 'PMAT-OUT-04', code: 'PM-OUT-04', name: 'VIP Twine Cone', type: 'OUTPUT', category: 'Precision Spool' },
  { id: 'PMAT-OUT-05', code: 'PM-OUT-05', name: 'Monofilament Yarn', type: 'OUTPUT', category: 'Continuous Yarn' },
  { id: 'PMAT-OUT-06', code: 'PM-OUT-06', name: 'Finished Rope Coils', type: 'OUTPUT', category: 'Finished Rope' },
  { id: 'PMAT-OUT-07', code: 'PM-OUT-07', name: 'Danline Rope', type: 'OUTPUT', category: '3-Strand Rope' },
  { id: 'PMAT-OUT-08', code: 'PM-OUT-08', name: 'Baling Twine', type: 'OUTPUT', category: 'Agricultural Twine' },
  { id: 'PMAT-OUT-09', code: 'PM-OUT-09', name: 'Danline Rope 6mm', type: 'OUTPUT', category: 'Finished Rope' },
  { id: 'PMAT-OUT-10', code: 'PM-OUT-10', name: 'HDPE Monofilament Rope 12mm', type: 'OUTPUT', category: 'Finished Rope' }
];

export const DEFAULT_INPUT_MATERIALS = DEFAULT_PROCESS_MATERIALS_SEED
  .filter(m => m.type === 'INPUT' || m.type === 'BOTH')
  .map(m => m.name);

export const DEFAULT_OUTPUT_PRODUCTS = DEFAULT_PROCESS_MATERIALS_SEED
  .filter(m => m.type === 'OUTPUT' || m.type === 'BOTH')
  .map(m => m.name);

/**
 * Subscribe to real-time Process Material Master collection from Firestore
 */
export function subscribeProcessMaterials(callback) {
  if (!db) {
    callback(DEFAULT_PROCESS_MATERIALS_SEED);
    return () => {};
  }

  const q = query(collection(db, 'processMaterials'), orderBy('name', 'asc'));

  return onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(list);
    } else {
      callback(DEFAULT_PROCESS_MATERIALS_SEED);
    }
  }, (err) => {
    console.error('Error subscribing to process materials:', err);
    callback(DEFAULT_PROCESS_MATERIALS_SEED);
  });
}

/**
 * Add a new Process Material to Master in Firestore
 */
export async function addProcessMaterial(materialData) {
  if (!db) throw new Error('Firestore not initialized');
  const code = materialData.code || `PM-${Math.floor(100 + Math.random() * 900)}`;
  const ref = await addDoc(collection(db, 'processMaterials'), {
    code,
    name: materialData.name.trim(),
    type: materialData.type || 'BOTH', // 'INPUT' | 'OUTPUT' | 'BOTH'
    category: materialData.category || 'General',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'PROCESS_MATERIAL_CREATED',
    summary: `Registered process material: ${materialData.name} (${code}) [${materialData.type || 'BOTH'}]`,
    targetId: code,
    details: materialData
  });

  return ref.id;
}

/**
 * Update an existing Process Material in Firestore
 */
export async function updateProcessMaterial(id, materialData) {
  if (!db) throw new Error('Firestore not initialized');
  const ref = doc(db, 'processMaterials', id);
  await updateDoc(ref, {
    ...materialData,
    updatedAt: serverTimestamp()
  });

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'PROCESS_MATERIAL_UPDATED',
    summary: `Updated process material: ${materialData.name || id}`,
    targetId: id,
    details: materialData
  });
}

/**
 * Delete a Process Material from Master in Firestore
 */
export async function deleteProcessMaterial(id) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'processMaterials', id));

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'PROCESS_MATERIAL_DELETED',
    summary: `Deleted process material ${id}`,
    targetId: id
  });
}

/**
 * Helper to get distinct Input Material types
 */
export function getInputMaterialNames(materialsList = []) {
  const list = materialsList && materialsList.length > 0 ? materialsList : DEFAULT_PROCESS_MATERIALS_SEED;
  const filtered = list.filter(m => m.type === 'INPUT' || m.type === 'BOTH').map(m => m.name || m);
  return Array.from(new Set([...filtered, ...DEFAULT_INPUT_MATERIALS]));
}

/**
 * Helper to get distinct Output Product types
 */
export function getOutputProductNames(materialsList = []) {
  const list = materialsList && materialsList.length > 0 ? materialsList : DEFAULT_PROCESS_MATERIALS_SEED;
  const filtered = list.filter(m => m.type === 'OUTPUT' || m.type === 'BOTH').map(m => m.name || m);
  return Array.from(new Set([...filtered, ...DEFAULT_OUTPUT_PRODUCTS]));
}

