import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Real-time listener for QC Checks (Change 5)
 */
export function subscribeQcChecks(callback, limitCount = 100) {
  if (!db) return () => {};
  const q = query(collection(db, 'qcChecks'), orderBy('createdAt', 'desc'), limit(limitCount));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const createdDate = data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date());
      const deadlineDate = data.deadlineAt?.toDate ? data.deadlineAt.toDate() : new Date(createdDate.getTime() + 24 * 60 * 60 * 1000);
      const isOverdue = data.status !== 'APPROVED' && Date.now() > deadlineDate.getTime();
      return {
        id: docSnap.id,
        ...data,
        isOverdue,
        deadlineDate
      };
    });
    callback(list);
  }, (err) => {
    console.error('Error fetching QC checks:', err);
    callback([]);
  });
}

/**
 * Auto-create a QC Check record when a GRN is created
 */
export async function createQcCheck(grnId, grnData) {
  if (!db) return null;
  try {
    const now = new Date();
    const deadline = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const docRef = await addDoc(collection(db, 'qcChecks'), {
      grnId: grnId || '',
      grnNo: grnData.grnNo || '',
      challanNo: grnData.challanNo || '',
      supplierName: grnData.supplierName || '',
      itemName: grnData.itemName || '',
      grade: grnData.grade || '',
      materialForm: grnData.materialForm || 'Granule',
      materialColor: grnData.materialColor || 'Natural',
      packaging: grnData.packaging || 'Woven Bag',
      batchNumber: grnData.batchNumber || '',
      grossWeight: Number(grnData.grossWeight || 0),
      netWeight: Number(grnData.netWeight || 0),
      status: 'PENDING', // 'PENDING' | 'SENT_FOR_APPROVAL' | 'APPROVED'
      result: null, // 'PASS' | 'FAIL' | null
      notes: '',
      checkedBy: '',
      checkedAt: null,
      approvedBy: null,
      approvedAt: null,
      deadlineAt: Timestamp.fromDate(deadline),
      createdAt: serverTimestamp()
    });

    return docRef.id;
  } catch (err) {
    console.error('Error auto-creating QC check:', err);
    return null;
  }
}

/**
 * Inspector submits QC evaluation (PASS / FAIL) -> moves to SENT_FOR_APPROVAL
 */
export async function submitQcEvaluation(id, { result, notes, checkedBy, mfiReading, uniformity, trialReport }) {
  if (!db) throw new Error('Firestore not initialized');
  const qcRef = doc(db, 'qcChecks', id);
  await updateDoc(qcRef, {
    result: result || 'PASS',
    notes: notes || '',
    checkedBy: checkedBy || 'QC Inspector',
    mfiReading: mfiReading !== undefined && mfiReading !== '' ? Number(mfiReading) : null,
    uniformity: uniformity || 'Even (સરખો)',
    trialReport: trialReport || '',
    checkedAt: serverTimestamp(),
    status: 'SENT_FOR_APPROVAL'
  });
}

/**
 * Manager approves QC evaluation -> moves to APPROVED
 */
export async function approveQcCheck(id, { approvedBy } = {}) {
  if (!db) throw new Error('Firestore not initialized');
  const qcRef = doc(db, 'qcChecks', id);
  await updateDoc(qcRef, {
    approvedBy: approvedBy || 'Manager / Plant Head',
    approvedAt: serverTimestamp(),
    status: 'APPROVED'
  });
}

/**
 * Delete a QC check record
 */
export async function deleteQcCheck(id) {
  if (!db) throw new Error('Firestore not initialized');
  await deleteDoc(doc(db, 'qcChecks', id));
}
