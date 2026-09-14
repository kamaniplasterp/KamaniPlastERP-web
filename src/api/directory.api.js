import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
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


