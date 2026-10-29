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
import { logAuditEvent } from './audit.api';

export const DEFAULT_LOCATIONS_LIST = [
  {
    id: 'LOC-KPI',
    locationCode: 'LOC-KPI',
    name: 'KPI Godown',
    type: 'INTERNAL',
    address: 'Main Factory Plant Silo Bay A-1, Rajkot',
    contactPerson: 'Suresh Bhai',
    isDefault: true,
    capacityKg: 100000
  },
  {
    id: 'LOC-MARVEL',
    locationCode: 'LOC-MARVEL',
    name: 'Marvel Godown',
    type: 'INTERNAL',
    address: 'Secondary Plant Silo Bay B-2, Rajkot',
    contactPerson: 'Dipak Bhai',
    isDefault: false,
    capacityKg: 80000
  },
  {
    id: 'LOC-GALAXY',
    locationCode: 'LOC-GALAXY',
    name: 'Galaxy Enterprise (Job Worker)',
    type: 'JOB_WORKER',
    address: 'Morbi Industrial Zone, Gujarat',
    contactPerson: 'Galaxy Supervisor',
    vendorId: 'V1',
    isDefault: false,
    capacityKg: 50000
  },
  {
    id: 'LOC-RAMJI',
    locationCode: 'LOC-RAMJI',
    name: 'Ramjibhai Unit (Job Worker)',
    type: 'JOB_WORKER',
    address: 'Rajkot GIDC Phase 2, Gujarat',
    contactPerson: 'Ramji Bhai',
    vendorId: 'V2',
    isDefault: false,
    capacityKg: 40000
  },
  {
    id: 'LOC-HIMMAT',
    locationCode: 'LOC-HIMMAT',
    name: 'Himmatbhai Unit (Job Worker)',
    type: 'JOB_WORKER',
    address: 'Jamnagar Highway, Gujarat',
    contactPerson: 'Himmat Bhai',
    vendorId: 'V3',
    isDefault: false,
    capacityKg: 35000
  }
];

/**
 * Subscribe to real-time locations collection directly from Firestore database
 */
export function subscribeLocations(callback, limitCount = 100) {
  if (!db) {
    callback(DEFAULT_LOCATIONS_LIST);
    return () => {};
  }

  const q = query(collection(db, 'locations'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    list.sort((a, b) => (a.locationCode || '').localeCompare(b.locationCode || ''));
    callback(list);
  }, (error) => {
    console.error('Error fetching locations:', error);
    callback([]);
  });
}

/**
 * Add a new Location / Godown record directly to Firestore
 */
export async function addLocation(data) {
  if (!db) throw new Error('Firestore not initialized');
  const code = data.locationCode || `LOC-${Math.floor(100 + Math.random() * 900)}`;
  const locRef = doc(db, 'locations', code);
  await setDoc(locRef, {
    ...data,
    locationCode: code,
    type: data.type || 'INTERNAL',
    capacityKg: Number(data.capacityKg || 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  await logAuditEvent({
    category: 'MASTER_DATA',
    action: 'LOCATION_CREATED',
    summary: `Created Godown / Plant Location ${data.name || code} (${code}) - Type: ${data.type || 'INTERNAL'}`,
    targetId: code,
    details: { locationCode: code, name: data.name, type: data.type, capacityKg: data.capacityKg, address: data.address }
  });

  return code;
}

/**
 * Update an existing Location directly in Firestore
 */
export async function updateLocation(id, data) {
  if (!db) throw new Error('Firestore not initialized');
  const docId = id || data.locationCode;
  const locRef = doc(db, 'locations', docId);
  await setDoc(locRef, {
    ...data,
    locationCode: data.locationCode || docId,
    capacityKg: Number(data.capacityKg || 0),
    updatedAt: serverTimestamp()
  }, { merge: true });

  await logAuditEvent({
    category: 'MASTER_DATA',
    action: 'LOCATION_UPDATED',
    summary: `Updated Godown / Plant Location ${data.name || docId} (${docId})`,
    targetId: docId,
    details: { locationCode: docId, name: data.name, type: data.type, capacityKg: data.capacityKg }
  });
}

/**
 * Delete a Location directly from Firestore
 */
export async function deleteLocation(id) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'locations', id));

  await logAuditEvent({
    category: 'MASTER_DATA',
    action: 'LOCATION_DELETED',
    summary: `Deleted Godown / Plant Location ${id}`,
    targetId: id,
    details: { locationId: id }
  });
}
