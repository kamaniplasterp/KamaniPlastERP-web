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
import { addLocation } from './locations.api';
import { logAuditEvent } from './audit.api';

/**
 * Helper to safely extract string value from potential object/event wrapper
 */
function sanitizeFieldString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') {
    return val.target?.value ?? val.value ?? val.label ?? fallback;
  }
  return String(val);
}

/**
 * Subscribe to real-time vendors collection with optional limit
 */
export function subscribeVendors(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'vendors'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => {
      const data = docSnap.data() || {};
      return {
        id: docSnap.id,
        ...data,
        name: sanitizeFieldString(data.name, 'Vendor'),
        processBadge: sanitizeFieldString(data.processBadge, 'Job Work Processor'),
        phone: sanitizeFieldString(data.phone, '-'),
        location: sanitizeFieldString(data.location, '-'),
        gst: sanitizeFieldString(data.gst, ''),
        rate: typeof data.rate === 'object' && data.rate !== null ? Number(data.rate.target?.value || 17.5) : (Number(data.rate) || 17.5)
      };
    });
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
 * Add a new vendor document and automatically create corresponding Godown location (Change 2)
 */
export async function addVendor(vendorData) {
  if (!db) throw new Error('Firestore not initialized');
  const cleanData = {
    ...vendorData,
    name: sanitizeFieldString(vendorData.name, 'Vendor').trim(),
    processBadge: sanitizeFieldString(vendorData.processBadge, 'Job Work Processor').trim(),
    phone: sanitizeFieldString(vendorData.phone, '').trim(),
    location: sanitizeFieldString(vendorData.location, '').trim(),
    gst: sanitizeFieldString(vendorData.gst, '').trim(),
    rate: typeof vendorData.rate === 'object' && vendorData.rate !== null ? Number(vendorData.rate.target?.value || 17.5) : (Number(vendorData.rate) || 17.5),
    createdAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, 'vendors'), cleanData);

  // Auto-create Godown location for this Job Worker / Vendor
  let createdLocationId = null;
  try {
    const cleanName = cleanData.name || 'Job Worker';
    const slug = cleanName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
    createdLocationId = await addLocation({
      locationCode: `LOC-${slug || Math.floor(100 + Math.random() * 900)}`,
      name: `${cleanName} (Job Worker)`,
      type: 'JOB_WORKER',
      address: cleanData.location || cleanData.address || 'Outside Job Worker Unit',
      contactPerson: cleanData.contactPerson || cleanData.phone || '',
      phone: cleanData.phone || '',
      vendorId: ref.id,
      vendorName: cleanName,
      capacityKg: 50000,
      isDefault: false
    });
  } catch (locErr) {
    console.warn('Auto-create godown for vendor notice:', locErr);
  }

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'VENDOR_CREATED',
    summary: `Registered vendor "${cleanData.name}" (${cleanData.location || 'Rajkot'}) with rate ₹${cleanData.rate}/KG`,
    targetId: cleanData.name || ref.id,
    details: cleanData
  });

  return { id: ref.id, locationId: createdLocationId };
}

/**
 * Update vendor document
 */
export async function updateVendor(id, vendorData) {
  if (!db) throw new Error('Firestore not initialized');
  const cleanData = {
    ...vendorData,
    name: sanitizeFieldString(vendorData.name, 'Vendor').trim(),
    processBadge: sanitizeFieldString(vendorData.processBadge, 'Job Work Processor').trim(),
    phone: sanitizeFieldString(vendorData.phone, '').trim(),
    location: sanitizeFieldString(vendorData.location, '').trim(),
    gst: sanitizeFieldString(vendorData.gst, '').trim(),
    rate: typeof vendorData.rate === 'object' && vendorData.rate !== null ? Number(vendorData.rate.target?.value || 17.5) : (Number(vendorData.rate) || 17.5),
    updatedAt: serverTimestamp()
  };

  const vendorRef = doc(db, 'vendors', id);
  await updateDoc(vendorRef, cleanData);

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'VENDOR_UPDATED',
    summary: `Updated vendor "${cleanData.name || id}" details`,
    targetId: cleanData.name || id,
    details: cleanData
  });
}

/**
 * Delete vendor document
 */
export async function deleteVendor(id, name = '') {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'vendors', id));

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'VENDOR_DELETED',
    summary: `Deleted vendor / job worker "${name || id}"`,
    targetId: id
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

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'CUSTOMER_CREATED',
    summary: `Registered customer "${buyerData.name}" (${buyerData.category || 'Buyer'})`,
    targetId: buyerData.name || ref.id,
    details: buyerData
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

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'CUSTOMER_UPDATED',
    summary: `Updated customer "${buyerData.name || id}" details`,
    targetId: buyerData.name || id,
    details: buyerData
  });
}

/**
 * Delete buyer document
 */
export async function deleteBuyer(id, name = '') {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'buyers', id));

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'CUSTOMER_DELETED',
    summary: `Deleted customer / buyer "${name || id}"`,
    targetId: id
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

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'JW_RATE_CONTRACT_CREATED',
    summary: `Configured Job Work Rate for ${rateData.party || 'Vendor'}: ₹${rateData.rate}/${rateData.uom || 'Kg'} (${rateData.process || 'Process'})`,
    targetId: rateData.party || ref.id,
    details: rateData
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

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'JW_RATE_CONTRACT_UPDATED',
    summary: `Updated Job Work Rate for ${rateData.party || id}: ₹${rateData.rate}/${rateData.uom || 'Kg'}`,
    targetId: rateData.party || id,
    details: rateData
  });
}

/**
 * Delete Job Work Rate record
 */
export async function deleteJobWorkRate(id, details = {}) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'jobWorkRates', id));

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'JW_RATE_CONTRACT_DELETED',
    summary: `Deleted Job Work Rate contract ${details.party ? `for ${details.party} (${details.process || ''})` : id}`,
    targetId: id,
    details
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

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'JW_VALUE_MASTER_CREATED',
    summary: `Configured valuation standard for ${valueData.itemDescription || valueData.code}: ₹${valueData.value}/Kg`,
    targetId: valueData.code || valueData.itemDescription || ref.id,
    details: valueData
  });

  return ref.id;
}

/**
 * Update a JW Value Master entry
 */
export async function updateJwValueMaster(id, valueData) {
  if (!db) throw new Error('Firestore not initialized');
  const valueRef = doc(db, 'jwValueMasters', id);
  await updateDoc(valueRef, {
    ...valueData,
    value: Number(valueData.value || 0),
    updatedAt: serverTimestamp()
  });

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'JW_VALUE_MASTER_UPDATED',
    summary: `Updated valuation standard for ${valueData.itemDescription || valueData.code}: ₹${valueData.value}/Kg`,
    targetId: valueData.code || valueData.itemDescription || id,
    details: valueData
  });
}

/**
 * Delete a JW Value Master entry
 */
export async function deleteJwValueMaster(id) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'jwValueMasters', id));

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'JW_VALUE_MASTER_DELETED',
    summary: `Deleted JW Value Master entry ${id}`,
    targetId: id
  });
}

/**
 * Find party-specific rate for a given process from rate records (Change 1)
 */
export function getPartyRateByProcess(partyNameOrId, processNameOrCode, ratesList = []) {
  if (!partyNameOrId || !processNameOrCode || !Array.isArray(ratesList)) return null;
  const pNorm = String(partyNameOrId).toLowerCase().trim();
  const prNorm = String(processNameOrCode).toLowerCase().trim();

  const match = ratesList.find(r => {
    const partyMatch = String(r.party || r.vendorName || r.vendorId || '').toLowerCase().trim() === pNorm;
    const procMatch = String(r.process || r.processName || r.processCode || '').toLowerCase().trim() === prNorm;
    return partyMatch && procMatch;
  });

  return match ? Number(match.rate) : null;
}

// ─── PACKAGING TARE STANDARDS PERSISTENCE (Change 4) ───
export const DEFAULT_TARE_STANDARDS = {
  bora: 0.200,
  plasticCone: 0.025,
  khaliBag: 0.120,
  theli: 0.015,
  varianceAllowanceKg: 50, // Max allowable tare variance in KG before warning alert
  varianceAllowancePct: 2.0 // Max allowable tare variance in % before warning alert
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
    varianceAllowanceKg: Number(tareData.varianceAllowanceKg !== undefined ? tareData.varianceAllowanceKg : 50),
    varianceAllowancePct: Number(tareData.varianceAllowancePct !== undefined ? tareData.varianceAllowancePct : 2.0),
    updatedAt: serverTimestamp()
  }, { merge: true });

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'TARE_STANDARDS_UPDATED',
    summary: `Updated packaging tare standards across bag types`,
    targetId: 'TARE_STANDARDS',
    details: tareData
  });
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

    logAuditEvent({
      category: 'MASTER_DATA',
      action: 'SIGNATORY_PERSONNEL_ADDED',
      summary: `Added authorized supervisor / signatory: ${trimmed}`,
      targetId: trimmed
    });
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

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'SIGNATORY_PERSONNEL_REMOVED',
    summary: `Removed authorized supervisor / signatory: ${name}`,
    targetId: name
  });
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

  logAuditEvent({
    category: 'MASTER_DATA',
    action: 'COMPANY_PROFILE_UPDATED',
    summary: `Updated plant company profile: ${profileData.legalName || profileData.name || 'Company Profile'}`,
    targetId: profileData.legalName || profileData.name || 'COMPANY_PROFILE',
    details: profileData
  });
}

