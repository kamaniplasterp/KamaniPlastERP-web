import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  query
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Subscribe to real-time vendors collection
 */
export function subscribeVendors(callback) {
  if (!db) return () => {};
  const q = query(collection(db, 'vendors'));
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
 * Subscribe to real-time buyers collection
 */
export function subscribeBuyers(callback) {
  if (!db) return () => {};
  const q = query(collection(db, 'buyers'));
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
