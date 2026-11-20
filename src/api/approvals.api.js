import {
  collection,
  addDoc,
  doc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { logAuditEvent } from './audit.api';
import { 
  addVendor, 
  updateVendor, 
  deleteVendor, 
  addBuyer, 
  updateBuyer, 
  deleteBuyer, 
  addJobWorkRate, 
  updateJobWorkRate, 
  deleteJobWorkRate, 
  addJwValueMaster, 
  updateJwValueMaster, 
  deleteJwValueMaster, 
  updateTareStandards, 
  addPersonnel, 
  deletePersonnel 
} from './directory.api';
import { addProcess, updateProcess, deleteProcess } from './process.api';
import { addLocation, updateLocation, deleteLocation } from './locations.api';

/**
 * Commit a master data change directly against the underlying collection.
 */
export async function executeMasterChange({
  masterType,
  action,
  recordId,
  proposedData,
  recordTitle
}) {
  switch (masterType) {
    case 'vendors':
      if (action === 'CREATE') await addVendor(proposedData);
      else if (action === 'UPDATE') await updateVendor(recordId, proposedData);
      else if (action === 'DELETE') await deleteVendor(recordId, recordTitle);
      break;

    case 'customers':
      if (action === 'CREATE') await addBuyer(proposedData);
      else if (action === 'UPDATE') await updateBuyer(recordId, proposedData);
      else if (action === 'DELETE') await deleteBuyer(recordId, recordTitle);
      break;

    case 'jobWorkRates':
      if (action === 'CREATE') await addJobWorkRate(proposedData);
      else if (action === 'UPDATE') await updateJobWorkRate(recordId, proposedData);
      else if (action === 'DELETE') await deleteJobWorkRate(recordId, recordTitle);
      break;

    case 'valueMasters':
      if (action === 'CREATE') await addJwValueMaster(proposedData);
      else if (action === 'UPDATE') await updateJwValueMaster(recordId, proposedData);
      else if (action === 'DELETE') await deleteJwValueMaster(recordId);
      break;

    case 'processes':
      if (action === 'CREATE') await addProcess(proposedData);
      else if (action === 'UPDATE') await updateProcess(recordId, proposedData);
      else if (action === 'DELETE') await deleteProcess(recordId, recordTitle);
      break;

    case 'locations':
      if (action === 'CREATE') await addLocation(proposedData);
      else if (action === 'UPDATE') await updateLocation(recordId, proposedData);
      else if (action === 'DELETE') await deleteLocation(recordId, recordTitle);
      break;

    case 'tareStandards':
      if (action === 'UPDATE') await updateTareStandards(proposedData);
      break;

    case 'signatories':
      if (action === 'CREATE') await addPersonnel(proposedData?.name || recordTitle);
      else if (action === 'DELETE') await deletePersonnel(recordTitle);
      break;

    default:
      console.warn('Unknown master type for direct commit:', masterType);
      break;
  }
}

/**
 * Submit a Master Data Change Request for Administrator approval.
 * Non-admin roles (accountant, employee, staff) create pending requests.
 * Users with the 'admin' role bypass approval and commit changes immediately!
 */
export async function submitMasterChangeRequest({
  masterType,
  masterLabel,
  action, // 'CREATE' | 'UPDATE' | 'DELETE'
  recordId = null,
  recordTitle = '',
  proposedData = {},
  previousData = null,
  submittedBy = {}
}) {
  if (!db) throw new Error('Database not initialized');

  const cleanRequest = {
    masterType: masterType || 'general',
    masterLabel: masterLabel || masterType || 'Master Record',
    action: action || 'CREATE',
    recordId: recordId || null,
    recordTitle: recordTitle || 'Record',
    proposedData: proposedData || {},
    previousData: previousData || null,
    submittedBy: {
      uid: submittedBy.uid || 'anonymous',
      email: submittedBy.email || '',
      displayName: submittedBy.displayName || submittedBy.username || 'Staff User',
      role: submittedBy.role || 'employee'
    },
    status: 'PENDING', // 'PENDING' | 'APPROVED' | 'REJECTED'
    reviewNotes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  // Admin role does NOT need approval - commit change immediately!
  const isUserAdmin = Boolean(
    submittedBy?.isAdmin === true ||
    submittedBy?.role === 'admin' ||
    submittedBy?.userRole === 'admin'
  );

  if (isUserAdmin) {
    await executeMasterChange({
      masterType,
      action,
      recordId,
      proposedData,
      recordTitle
    });

    await logAuditEvent({
      category: 'MASTER_DATA',
      action: `MASTER_${action}_DIRECT`,
      summary: `Administrator (${submittedBy.displayName || submittedBy.email || 'Admin'}) directly executed ${action} for ${cleanRequest.masterLabel}: "${cleanRequest.recordTitle}"`,
      targetId: cleanRequest.recordTitle || recordId || 'direct',
      details: cleanRequest
    });

    return { appliedDirectly: true, status: 'DIRECT_COMMITTED', ...cleanRequest };
  }

  const docRef = await addDoc(collection(db, 'masterChangeRequests'), cleanRequest);

  await logAuditEvent({
    category: 'MASTER_DATA',
    action: `MASTER_${action}_REQUESTED`,
    summary: `${submittedBy.displayName || submittedBy.email || 'Staff'} submitted ${action} request for ${cleanRequest.masterLabel}: "${cleanRequest.recordTitle}"`,
    targetId: cleanRequest.recordTitle || docRef.id,
    details: cleanRequest
  });

  return { id: docRef.id, ...cleanRequest };
}

const parseFirestoreDate = (val) => {
  if (!val) return null;
  if (typeof val?.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    return new Date(val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0));
  }
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

/**
 * Real-time listener for pending change requests
 */
export function subscribePendingApprovals(callback) {
  if (!db) {
    callback([]);
    return () => {};
  }

  // Query by status without orderBy to avoid requiring a composite Firestore index
  const q = query(
    collection(db, 'masterChangeRequests'),
    where('status', '==', 'PENDING')
  );

  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: parseFirestoreDate(data.createdAt) || new Date(),
        reviewedAt: parseFirestoreDate(data.reviewedAt),
        updatedAt: parseFirestoreDate(data.updatedAt)
      };
    }).sort((a, b) => {
      const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
      const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
      return timeB - timeA;
    });
    callback(list);
  }, (err) => {
    console.warn('Pending approvals listener warning:', err);
    callback([]);
  });
}

/**
 * Real-time listener for all change requests (history & pending)
 */
export function subscribeAllApprovals(callback) {
  if (!db) {
    callback([]);
    return () => {};
  }

  const q = query(
    collection(db, 'masterChangeRequests'),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, (snap) => {
    const list = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        createdAt: parseFirestoreDate(data.createdAt) || new Date(),
        reviewedAt: parseFirestoreDate(data.reviewedAt),
        updatedAt: parseFirestoreDate(data.updatedAt)
      };
    });
    callback(list);
  }, (err) => {
    console.warn('All approvals listener warning:', err);
    callback([]);
  });
}

/**
 * Admin approves a master change request.
 * Commits the change to the underlying master collection and updates request status.
 */
export async function approveMasterChange(request, adminUser = {}) {
  if (!db) throw new Error('Database not initialized');
  if (!request?.id) throw new Error('Invalid request object');

  const { masterType, action, recordId, proposedData, recordTitle, masterLabel } = request;

  // 1. Commit the actual change to the target master collection
  await executeMasterChange({
    masterType,
    action,
    recordId,
    proposedData,
    recordTitle
  });

  // 2. Mark the request as APPROVED
  const reqRef = doc(db, 'masterChangeRequests', request.id);
  await updateDoc(reqRef, {
    status: 'APPROVED',
    reviewedBy: {
      uid: adminUser.uid || 'admin',
      displayName: adminUser.displayName || adminUser.email || 'Administrator',
      email: adminUser.email || ''
    },
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 3. Log audit event
  await logAuditEvent({
    category: 'MASTER_DATA',
    action: 'MASTER_CHANGE_APPROVED',
    summary: `Administrator approved ${action} for ${masterLabel || masterType}: "${recordTitle}" (Submitted by ${request.submittedBy?.displayName || request.submittedBy?.email})`,
    targetId: recordTitle || recordId || request.id,
    details: {
      requestId: request.id,
      masterType,
      action,
      reviewedBy: adminUser.email || 'admin'
    }
  });

  return { success: true };
}

/**
 * Admin rejects a master change request.
 */
export async function rejectMasterChange(requestId, reason = '', adminUser = {}) {
  if (!db) throw new Error('Database not initialized');
  if (!requestId) throw new Error('Missing requestId');

  const reqRef = doc(db, 'masterChangeRequests', requestId);
  await updateDoc(reqRef, {
    status: 'REJECTED',
    reviewNotes: reason || 'Rejected by Administrator',
    reviewedBy: {
      uid: adminUser.uid || 'admin',
      displayName: adminUser.displayName || adminUser.email || 'Administrator',
      email: adminUser.email || ''
    },
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  await logAuditEvent({
    category: 'MASTER_DATA',
    action: 'MASTER_CHANGE_REJECTED',
    summary: `Administrator rejected master change request ${requestId}. Reason: ${reason || 'Not specified'}`,
    targetId: requestId,
    details: { requestId, reason, reviewedBy: adminUser.email || 'admin' }
  });

  return { success: true };
}
