import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  setDoc,
  getDoc,
  serverTimestamp,
  query,
  limit
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Subscribe to real-time vendors collection with optional limit
 */
export function subscribeVendors(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'vendors'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching vendors:', error);
    callback([]);
  });
}

/**
 * Subscribe to real-time buyers collection with optional limit
 */
export function subscribeBuyers(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'buyers'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching buyers:', error);
    callback([]);
  });
}

/**
 * Add a new vendor document
 */
export async function addVendor(vendorData) {
  if (!db) throw new Error('Firestore not initialized');
  const ref = await addDoc(collection(db, 'vendors'), {
    ...vendorData,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Update vendor document
 */
export async function updateVendor(id, vendorData) {
  if (!db) throw new Error('Firestore not initialized');
  const vendorRef = doc(db, 'vendors', id);
  await updateDoc(vendorRef, {
    ...vendorData,
    updatedAt: serverTimestamp()
  });
}

/**
 * Add a new buyer document
 */
export async function addBuyer(buyerData) {
  if (!db) throw new Error('Firestore not initialized');
  const ref = await addDoc(collection(db, 'buyers'), {
    ...buyerData,
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Update buyer document
 */
export async function updateBuyer(id, buyerData) {
  if (!db) throw new Error('Firestore not initialized');
  const buyerRef = doc(db, 'buyers', id);
  await updateDoc(buyerRef, {
    ...buyerData,
    updatedAt: serverTimestamp()
  });
}

/**
 * Subscribe to real-time Job Work Rate Master collection
 */
export function subscribeJobWorkRates(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'jobWorkRates'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching job work rates:', error);
    callback([]);
  });
}

/**
 * Add a new Job Work Rate record (Party + Process + Item -> Rate)
 */
export async function addJobWorkRate(rateData) {
  if (!db) throw new Error('Firestore not initialized');
  const ref = await addDoc(collection(db, 'jobWorkRates'), {
    ...rateData,
    rate: Number(rateData.rate || 0),
    uom: rateData.uom || 'Kgs',
    date: rateData.date || new Date().toISOString().split('T')[0],
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Update Job Work Rate record
 */
export async function updateJobWorkRate(id, rateData) {
  if (!db) throw new Error('Firestore not initialized');
  const rateRef = doc(db, 'jobWorkRates', id);
  await updateDoc(rateRef, {
    ...rateData,
    rate: Number(rateData.rate || 0),
    updatedAt: serverTimestamp()
  });
}

/**
 * Subscribe to real-time JW Value Master collection
 */
export function subscribeJwValueMasters(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'jwValueMasters'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));
    callback(list);
  }, (error) => {
    console.error('Error fetching JW Value Masters:', error);
    callback([]);
  });
}

/**
 * Add a new JW Value Master entry
 */
export async function addJwValueMaster(valueData) {
  if (!db) throw new Error('Firestore not initialized');
  const ref = await addDoc(collection(db, 'jwValueMasters'), {
    ...valueData,
    value: Number(valueData.value || 0),
    date: valueData.date || new Date().toISOString().split('T')[0],
    createdAt: serverTimestamp()
  });
  return ref.id;
}

/**
 * Delete a JW Value Master entry
 */
export async function deleteJwValueMaster(id) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'jwValueMasters', id));
}

// ─── PACKAGING TARE STANDARDS PERSISTENCE ───
export const DEFAULT_TARE_STANDARDS = {
  bora: 0.200,
  plasticCone: 0.025,
  khaliBag: 0.120,
  theli: 0.015
};

export function subscribeTareStandards(callback) {
  if (!db) return () => {};
  const tareDocRef = doc(db, 'systemSettings', 'tareStandards');
  return onSnapshot(tareDocRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ ...DEFAULT_TARE_STANDARDS, ...docSnap.data() });
    } else {
      callback(DEFAULT_TARE_STANDARDS);
    }
  }, (err) => {
    console.error('Error fetching tare standards:', err);
    callback(DEFAULT_TARE_STANDARDS);
  });
}

export async function updateTareStandards(tareData) {
  if (!db) throw new Error('Firestore not initialized');
  const tareDocRef = doc(db, 'systemSettings', 'tareStandards');
  await setDoc(tareDocRef, {
    bora: Number(tareData.bora !== undefined ? tareData.bora : 0.200),
    plasticCone: Number(tareData.plasticCone !== undefined ? tareData.plasticCone : 0.025),
    khaliBag: Number(tareData.khaliBag !== undefined ? tareData.khaliBag : 0.120),
    theli: Number(tareData.theli !== undefined ? tareData.theli : 0.015),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// ─── AUTHORIZED PERSONNEL & SUPERVISORS PERSISTENCE ───
export const DEFAULT_PERSONNEL = [
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

export function subscribePersonnel(callback) {
  if (!db) return () => {};
  const personnelDocRef = doc(db, 'systemSettings', 'personnel');
  return onSnapshot(personnelDocRef, (docSnap) => {
    if (docSnap.exists() && Array.isArray(docSnap.data().list) && docSnap.data().list.length > 0) {
      callback(docSnap.data().list);
    } else {
      callback(DEFAULT_PERSONNEL);
    }
  }, (err) => {
    console.error('Error fetching personnel:', err);
    callback(DEFAULT_PERSONNEL);
  });
}

export async function addPersonnel(name) {
  if (!db) throw new Error('Firestore not initialized');
  const trimmed = name.trim().toUpperCase();
  if (!trimmed) return;
  const personnelDocRef = doc(db, 'systemSettings', 'personnel');
  const snap = await getDoc(personnelDocRef);
  const currentList = snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length > 0
    ? snap.data().list
    : [...DEFAULT_PERSONNEL];
  if (!currentList.includes(trimmed)) {
    const updated = [...currentList, trimmed];
    await setDoc(personnelDocRef, { list: updated, updatedAt: serverTimestamp() });
  }
}

export async function deletePersonnel(name) {
  if (!db) throw new Error('Firestore not initialized');
  const personnelDocRef = doc(db, 'systemSettings', 'personnel');
  const snap = await getDoc(personnelDocRef);
  const currentList = snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length > 0
    ? snap.data().list
    : [...DEFAULT_PERSONNEL];
  const updated = currentList.filter(p => p !== name);
  await setDoc(personnelDocRef, { list: updated, updatedAt: serverTimestamp() });
}

// ─── COMPANY & PLANT PROFILE / ERP SETTINGS PERSISTENCE ───
export const DEFAULT_COMPANY_PROFILE = {
  legalName: 'Kamani Plastic Industries',
  gstin: '24AAACK1234F1Z8',
  phone: '+91 2824 220011 / +91 98250 12345',
  address: 'Plot No. 12 & 14, GIDC Phase-II, Dhoraji, Dist. Rajkot, Gujarat - 360410',
  jwPrefix: 'JW-2026-',
  wastageAllowance: '2.5'
};

export function subscribeCompanyProfile(callback) {
  if (!db) return () => {};
  const profileDocRef = doc(db, 'systemSettings', 'companyProfile');
  return onSnapshot(profileDocRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ ...DEFAULT_COMPANY_PROFILE, ...docSnap.data() });
    } else {
      callback(DEFAULT_COMPANY_PROFILE);
    }
  }, (err) => {
    console.error('Error fetching company profile:', err);
    callback(DEFAULT_COMPANY_PROFILE);
  });
}

export async function updateCompanyProfile(profileData) {
  if (!db) throw new Error('Firestore not initialized');
  const profileDocRef = doc(db, 'systemSettings', 'companyProfile');
  await setDoc(profileDocRef, {
    ...profileData,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

