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

export const DEFAULT_LOCATIONS_LIST = [
  {
    locationCode: 'LOC-KPI',
    name: 'KPI Godown',
    type: 'INTERNAL',
    address: 'Main Factory Plant Silo Bay A-1, Rajkot',
    contactPerson: 'Suresh Bhai',
    isDefault: true,
    capacityKg: 100000
  },
  {
    locationCode: 'LOC-MARVEL',
    name: 'Marvel Godown',
    type: 'INTERNAL',
    address: 'Secondary Plant Silo Bay B-2, Rajkot',
    contactPerson: 'Dipak Bhai',
    isDefault: false,
    capacityKg: 80000
  },
  {
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
 * Subscribe to real-time locations collection with fallback to defaults
 */
export function subscribeLocations(callback, limitCount = 100) {
  if (!db) {
    callback(DEFAULT_LOCATIONS_LIST);
    return () => {};
  }
  const q = query(collection(db, 'locations'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(DEFAULT_LOCATIONS_LIST);
    } else {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      callback(list);
    }
  }, (error) => {
    console.error('Error fetching locations:', error);
    callback(DEFAULT_LOCATIONS_LIST);
  });
}

/**
 * Add a new Location / Godown record
 */
export async function addLocation(data) {
  if (!db) throw new Error('Firestore not initialized');
  const ref = await addDoc(collection(db, 'locations'), {
    ...data,
    locationCode: data.locationCode || `LOC-${Math.floor(100 + Math.random() * 900)}`,
    type: data.type || 'INTERNAL',
    capacityKg: Number(data.capacityKg || 0),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Update an existing Location
 */
export async function updateLocation(id, data) {
  if (!db) throw new Error('Firestore not initialized');
  const locRef = doc(db, 'locations', id);
  await updateDoc(locRef, {
    ...data,
    capacityKg: Number(data.capacityKg || 0),
    updatedAt: serverTimestamp()
  });
}

/**
 * Delete a Location
 */
export async function deleteLocation(id) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'locations', id));
}

/**
 * Seed default locations if collection is empty
 */
export async function seedDefaultLocations() {
  if (!db) return;
  const snap = await getDocs(collection(db, 'locations'));
  if (snap.empty) {
    for (const loc of DEFAULT_LOCATIONS_LIST) {
      await addDoc(collection(db, 'locations'), {
        ...loc,
        createdAt: serverTimestamp()
      });
    }
  }
}
