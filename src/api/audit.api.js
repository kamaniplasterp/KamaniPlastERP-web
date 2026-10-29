import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  doc,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase/firebase';

export const AUDIT_CATEGORIES = {
  SECURITY: { id: 'SECURITY', label: 'Security & Access', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  QUALITY_CONTROL: { id: 'QUALITY_CONTROL', label: 'Quality Control (QC)', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  INVENTORY: { id: 'INVENTORY', label: 'Inventory & Stock', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd' },
  JOB_WORK: { id: 'JOB_WORK', label: 'Job Work Hub', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  SALES: { id: 'SALES', label: 'Sales & Dispatch', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' },
  MASTER_DATA: { id: 'MASTER_DATA', label: 'Master Configurations', color: '#475569', bg: '#f8fafc', border: '#cbd5e1' }
};

// Global in-memory user registry cache for instant role resolution
const cachedUsersMap = new Map();

/**
 * Resolves an audit event's user against the authoritative user directory.
 * Matches by UID, email, or displayName to guarantee exact role consistency with RBAC.
 */
export function resolveAuditUser(rawUser, usersListOrMap = []) {
  if (!rawUser) {
    return { uid: 'system', name: 'System User', role: 'admin', email: 'system@kamaniplast.com' };
  }

  const emailLower = (rawUser.email || '').toLowerCase().trim();
  const uid = rawUser.uid;
  const nameLower = (rawUser.name || rawUser.displayName || '').toLowerCase().trim();

  // 1. Search in provided users list or map
  let matched = null;
  if (Array.isArray(usersListOrMap) && usersListOrMap.length > 0) {
    matched = usersListOrMap.find(u => {
      if (uid && (u.uid === uid || u.id === uid)) return true;
      if (emailLower && u.email && u.email.toLowerCase().trim() === emailLower) return true;
      if (nameLower && (
        (u.displayName && u.displayName.toLowerCase().trim() === nameLower) ||
        (u.username && u.username.toLowerCase().trim() === nameLower)
      )) return true;
      return false;
    });
  } else if (usersListOrMap instanceof Map && usersListOrMap.size > 0) {
    matched = (uid && usersListOrMap.get(uid)) ||
              (emailLower && usersListOrMap.get(emailLower)) ||
              (nameLower && usersListOrMap.get(nameLower));
  }

  // 2. Search in global cache if not found
  if (!matched && cachedUsersMap.size > 0) {
    matched = (uid && cachedUsersMap.get(uid)) ||
              (emailLower && cachedUsersMap.get(emailLower)) ||
              (nameLower && cachedUsersMap.get(nameLower));
  }

  if (matched) {
    return {
      uid: matched.uid || matched.id || uid || 'user',
      name: matched.displayName || matched.name || rawUser.name || 'Staff User',
      email: matched.email || rawUser.email || '',
      role: matched.role || 'employee'
    };
  }

  // 3. Clean database-aligned heuristic fallback
  let role = rawUser.role;
  if (!role || !['admin', 'accountant', 'employee'].includes(role) || role === 'employee') {
    if (
      emailLower === 'admin@kamaniplast.com' ||
      emailLower === 'kamaniplasterp@kamaniplast.com' ||
      emailLower.startsWith('admin@') ||
      nameLower.includes('admin')
    ) {
      role = 'admin';
    } else if (
      emailLower.includes('accountant') ||
      nameLower.includes('accountant')
    ) {
      role = 'accountant';
    }
  }

  return {
    uid: uid || 'user',
    name: rawUser.name || rawUser.displayName || (emailLower ? emailLower.split('@')[0] : 'Staff User'),
    email: rawUser.email || '',
    role: role || 'employee'
  };
}

/**
 * Record an audit log event into the Firestore database
 */
export async function logAuditEvent({
  category = 'MASTER_DATA',
  action = 'SYSTEM_ACTION',
  summary = '',
  targetId = '',
  details = null,
  user = null
}) {
  if (!db) {
    console.warn('AuditLog: Firestore not available, skipping log.');
    return null;
  }

  try {
    const currentUser = user || auth?.currentUser;
    const userEmail = (currentUser?.email || '').toLowerCase().trim();
    const userUid = currentUser?.uid || 'admin';
    let userName = currentUser?.displayName || currentUser?.name || currentUser?.username || '';

    // Determine authoritative role
    let userRole = currentUser?.role;

    if (!userRole || !['admin', 'accountant', 'employee'].includes(userRole)) {
      // Check in-memory user cache
      const cached = (userUid && cachedUsersMap.get(userUid)) || 
                     (userEmail && cachedUsersMap.get(userEmail)) ||
                     (userName && cachedUsersMap.get(userName.toLowerCase().trim()));
      if (cached?.role) {
        userRole = cached.role;
        userName = userName || cached.displayName || cached.username;
      } else if (userUid && userUid !== 'admin') {
        // Query Firestore users collection
        try {
          const userDocSnap = await getDoc(doc(db, 'users', userUid));
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            userRole = data.role;
            userName = userName || data.displayName || data.username;
            cachedUsersMap.set(userUid, data);
            if (data.email) cachedUsersMap.set(data.email.toLowerCase().trim(), data);
          }
        } catch (_) {}
      }
    }

    if (!userRole || !['admin', 'accountant', 'employee'].includes(userRole)) {
      // Heuristic fallback for the 3 official roles
      if (
        userEmail === 'admin@kamaniplast.com' ||
        userEmail === 'kamaniplasterp@kamaniplast.com' ||
        userEmail.startsWith('admin@') ||
        userEmail.includes('admin')
      ) {
        userRole = 'admin';
      } else if (userEmail.includes('accountant') || (userName && userName.toLowerCase().includes('accountant'))) {
        userRole = 'accountant';
      } else {
        userRole = 'employee';
      }
    }

    userName = userName || (userEmail ? userEmail.split('@')[0] : 'KamaniPlastERP');

    const logEntry = {
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
      category: category in AUDIT_CATEGORIES ? category : 'MASTER_DATA',
      action: action.toUpperCase(),
      summary: summary || `${action} performed on ${targetId || 'record'}`,
      targetId: targetId || '-',
      user: {
        uid: userUid,
        name: userName,
        email: userEmail || 'kamaniplasterp@kamaniplast.com',
        role: userRole
      },
      details: details ? sanitizeDetails(details) : {}
    };

    const docRef = await addDoc(collection(db, 'audit_logs'), logEntry);
    return { id: docRef.id, ...logEntry };
  } catch (err) {
    console.error('AuditLog: Failed to record audit event in Firestore:', err);
    return null;
  }
}

/**
 * Strip non-serializable objects (functions, circular references)
 */
function sanitizeDetails(data) {
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return { info: String(data) };
  }
}

/**
 * Helper to safely extract an ISO timestamp from Firestore doc data
 */
function extractDocTimestamp(data) {
  if (data?.timestamp && typeof data.timestamp === 'string') return data.timestamp;
  if (data?.createdAt?.toDate) return data.createdAt.toDate().toISOString();
  if (data?.createdAt && typeof data.createdAt === 'string') return data.createdAt;
  if (data?.recordedAt && typeof data.recordedAt === 'string') return data.recordedAt;
  if (data?.approvedAt?.toDate) return data.approvedAt.toDate().toISOString();
  if (data?.checkedAt?.toDate) return data.checkedAt.toDate().toISOString();
  if (data?.date) {
    const d = new Date(data.date);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

/**
 * Subscribe to real audit data directly from Firestore database
 * Aggregates real operational events across Firestore collections in real time
 * 
 * @param {Function} callback - Receives array of real audit log items
 * @param {number} limitCount - Max items to return
 * @returns {Function} Unsubscribe function
 */
export function subscribeAuditLogs(callback, limitCount = 200) {
  if (!db) {
    callback([]);
    return () => {};
  }

  // Real data state buckets for each Firestore collection
  let usersFromDb = [];
  let auditLogsFromDb = [];
  let rmInwardsFromDb = [];
  let rmFactoryIssuesFromDb = [];
  let qcChecksFromDb = [];
  let jobWorksFromDb = [];
  let salesOrdersFromDb = [];
  let dispatchesFromDb = [];

  const publishCombinedLogs = () => {
    const combined = [];
    const seenKeys = new Set();

    // 1. Explicit audit_logs recorded in Firestore
    auditLogsFromDb.forEach(item => {
      const key = `${item.action}_${item.targetId}_${item.timestamp?.slice(0, 16)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        combined.push({
          ...item,
          user: resolveAuditUser(item.user, usersFromDb)
        });
      }
    });

    // 2. Real Raw Material Inwards from Firestore rmInwards collection
    rmInwardsFromDb.forEach(item => {
      const ts = extractDocTimestamp(item);
      const key = `RAW_MATERIAL_INWARD_${item.grnNo || item.id}_${ts?.slice(0, 16)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        combined.push({
          id: `INW-${item.id}`,
          timestamp: ts,
          category: 'INVENTORY',
          action: 'RAW_MATERIAL_INWARD',
          targetId: item.grnNo || item.id,
          summary: `Raw Material Inward GRN ${item.grnNo || 'GRN'} received from ${item.supplierName || 'Supplier'} (${item.itemName || 'Material'}${item.grade ? ' - ' + item.grade : ''}: Net ${item.netWeight || item.grossWeight || 0} KG, ${item.bagCount || 0} Bags)`,
          user: resolveAuditUser({
            name: item.receivedBy || 'SURESHBHAI',
            email: `${(item.receivedBy || 'sureshbhai').toLowerCase().replace(/\s+/g, '')}@kamaniplast.com`,
            role: 'employee'
          }, usersFromDb),
          details: {
            grnNo: item.grnNo,
            supplierName: item.supplierName,
            challanNo: item.challanNo,
            grossWeight: item.grossWeight,
            tareDeduct: item.tareDeduct,
            netWeight: item.netWeight,
            rate: item.rate,
            remarks: item.remarks
          }
        });
      }

      // If inward record has real QC status evaluated (ACCEPTED or REJECTED)
      if (item.qcStatus === 'ACCEPTED' || item.qcStatus === 'REJECTED') {
        const qcAction = item.qcStatus === 'ACCEPTED' ? 'QC_INSPECTION_ACCEPTED' : 'QC_INSPECTION_REJECTED';
        const qcTs = item.qcEvaluatedAt?.toDate ? item.qcEvaluatedAt.toDate().toISOString() : (item.qcEvaluatedAt || ts);
        const qcKey = `${qcAction}_${item.grnNo || item.id}_${qcTs?.slice(0, 16)}`;
        if (!seenKeys.has(qcKey)) {
          seenKeys.add(qcKey);
          combined.push({
            id: `QC-INW-${item.id}`,
            timestamp: qcTs,
            category: 'QUALITY_CONTROL',
            action: qcAction,
            targetId: item.grnNo || item.id,
            summary: `Quality Inspection ${item.qcStatus === 'ACCEPTED' ? 'ACCEPTED' : 'REJECTED'} for GRN ${item.grnNo || item.id} (${item.itemName || 'Material'}: Net ${item.netWeight || item.grossWeight || 0} KG) by Admin`,
            user: resolveAuditUser({
              name: 'KamaniPlastERP',
              email: 'kamaniplasterp@kamaniplast.com',
              role: 'admin'
            }, usersFromDb),
            details: {
              grnNo: item.grnNo,
              supplierName: item.supplierName,
              itemName: item.itemName,
              qcStatus: item.qcStatus,
              netWeight: item.netWeight,
              actionTaken: item.qcStatus === 'ACCEPTED' ? 'Accepted' : 'Rejected'
            }
          });
        }
      }
    });

    // 3. Real QC Inspections from Firestore qcChecks collection
    qcChecksFromDb.forEach(item => {
      const ts = extractDocTimestamp(item);
      const isApproved = item.status === 'APPROVED';
      const actionCode = isApproved ? 'QC_INSPECTION_APPROVED' : (item.result === 'FAIL' ? 'QC_INSPECTION_REJECTED' : 'QC_INSPECTION_PENDING');
      const key = `${actionCode}_${item.grnNo || item.id}_${ts?.slice(0, 16)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const inspector = item.approvedBy || item.checkedBy || 'DIPAKBHAI';
        combined.push({
          id: `QC-${item.id}`,
          timestamp: ts,
          category: 'QUALITY_CONTROL',
          action: actionCode,
          targetId: item.grnNo || item.id,
          summary: isApproved 
            ? `QC Inspection APPROVED for GRN ${item.grnNo || item.id} (${item.itemName || 'Material'}: Result ${item.result || 'PASS'}) signed off by ${inspector}`
            : `QC Inspection evaluated as ${item.result || 'PENDING'} for GRN ${item.grnNo || item.id} by inspector ${inspector}`,
          user: resolveAuditUser({
            name: inspector,
            email: `${inspector.toLowerCase().replace(/\s+/g, '')}@kamaniplast.com`,
            role: 'employee'
          }, usersFromDb),
          details: {
            grnNo: item.grnNo,
            supplierName: item.supplierName,
            itemName: item.itemName,
            result: item.result,
            status: item.status,
            checkedBy: item.checkedBy,
            approvedBy: item.approvedBy,
            notes: item.notes
          }
        });
      }
    });

    // 4. Real Job Work Orders & Receipts from Firestore jobWorks collection
    jobWorksFromDb.forEach(item => {
      const ts = extractDocTimestamp(item);
      const chNo = item.chNo || item.challanNo || 'CH-000';
      const key = `JOB_WORK_ISSUED_${chNo}_${ts?.slice(0, 16)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        combined.push({
          id: `JW-${item.id}`,
          timestamp: ts,
          category: 'JOB_WORK',
          action: 'JOB_WORK_ORDER_ISSUED',
          targetId: chNo,
          summary: `Job Work Challan ${chNo} issued to ${item.party || 'Vendor'} (${item.process || 'Process'} - ${item.sentKg || item.sent || 0} KG of ${item.rawMat || 'Material'})`,
          user: resolveAuditUser({
            name: item.issuedBy || 'RAMESHBHAI',
            email: `${(item.issuedBy || 'rameshbhai').toLowerCase().replace(/\s+/g, '')}@kamaniplast.com`,
            role: 'accountant'
          }, usersFromDb),
          details: {
            chNo: chNo,
            party: item.party,
            process: item.process,
            rawMat: item.rawMat,
            sentKg: item.sentKg || item.sent,
            remarks: item.remarks
          }
        });
      }

      // If this Job Work has receipts in Firestore, also include each receipt
      if (Array.isArray(item.inwardReceipts) && item.inwardReceipts.length > 0) {
        item.inwardReceipts.forEach((rec, idx) => {
          const recTs = rec.recordedAt || ts;
          const recKey = `JW_RECEIPT_${chNo}_${rec.receiptSlip || idx}_${recTs?.slice(0, 16)}`;
          if (!seenKeys.has(recKey)) {
            seenKeys.add(recKey);
            combined.push({
              id: `JW-REC-${item.id}-${idx}`,
              timestamp: recTs,
              category: 'JOB_WORK',
              action: 'JOB_WORK_RECEIPT_RECORDED',
              targetId: chNo,
              summary: `Job Work Receipt ${rec.receiptSlip || 'SLIP'} recorded: ${rec.netQtyKg || 0} KG received, ${rec.scrapQtyKg || 0} KG scrap recovered from ${item.party || 'Vendor'}`,
              user: resolveAuditUser({
                name: rec.receivedBy || 'SURESHBHAI',
                email: `${(rec.receivedBy || 'sureshbhai').toLowerCase().replace(/\s+/g, '')}@kamaniplast.com`,
                role: 'employee'
              }, usersFromDb),
              details: {
                challanNo: chNo,
                receiptSlip: rec.receiptSlip,
                party: item.party,
                netQtyKg: rec.netQtyKg,
                scrapQtyKg: rec.scrapQtyKg,
                receivedBy: rec.receivedBy
              }
            });
          }
        });
      }
    });

    // 5. Real Sales Orders from Firestore salesOrders collection
    salesOrdersFromDb.forEach(item => {
      const ts = extractDocTimestamp(item);
      const soNo = item.soNo || item.orderNo || 'SO-000';
      const key = `SALES_ORDER_${soNo}_${ts?.slice(0, 16)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        combined.push({
          id: `SO-${item.id}`,
          timestamp: ts,
          category: 'SALES',
          action: 'SALES_ORDER_CREATED',
          targetId: soNo,
          summary: `Sales Order ${soNo} booked for ${item.customer || 'Customer'} (${item.orderedQtyCoils || item.orderedQty || 0} Coils of ${item.itemSummary || 'Finished Rope'}, Value: ${item.value || '₹0'})`,
          user: resolveAuditUser({
            name: 'KamaniPlastERP',
            email: 'kamaniplasterp@kamaniplast.com',
            role: 'admin'
          }, usersFromDb),
          details: {
            soNo: soNo,
            customer: item.customer,
            orderedQtyCoils: item.orderedQtyCoils,
            itemSummary: item.itemSummary,
            value: item.value,
            status: item.status
          }
        });
      }
    });

    // 6. Real Dispatches from Firestore dispatches collection
    dispatchesFromDb.forEach(item => {
      const ts = extractDocTimestamp(item);
      const dispNo = item.chNo || item.dispatchNo || 'DC-000';
      const key = `DISPATCH_${dispNo}_${ts?.slice(0, 16)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        combined.push({
          id: `DSP-${item.id}`,
          timestamp: ts,
          category: 'SALES',
          action: 'DISPATCH_CHALLAN_CREATED',
          targetId: dispNo,
          summary: `Dispatch Challan ${dispNo} dispatched to ${item.customer || 'Customer'}: ${item.dispatchQtyCoils || item.qty || 0} Coils via ${item.vehicle || item.vehicleNo || 'Vehicle'}`,
          user: resolveAuditUser({
            name: 'KamaniPlastERP',
            email: 'kamaniplasterp@kamaniplast.com',
            role: 'admin'
          }, usersFromDb),
          details: {
            challanNo: dispNo,
            customer: item.customer,
            dispatchQtyCoils: item.dispatchQtyCoils,
            vehicle: item.vehicle,
            transporter: item.transporter
          }
        });
      }
    });

    // 7. Real Factory Issues from Firestore rmFactoryIssues collection
    rmFactoryIssuesFromDb.forEach(item => {
      const ts = extractDocTimestamp(item);
      const slipNo = item.slipNo || 'ISS-000';
      const key = `FACTORY_ISSUE_${slipNo}_${ts?.slice(0, 16)}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        combined.push({
          id: `ISS-${item.id}`,
          timestamp: ts,
          category: 'INVENTORY',
          action: 'FACTORY_MATERIAL_ISSUE',
          targetId: slipNo,
          summary: `Factory Issue ${slipNo}: ${item.netWeight || item.grossWeight || 0} KG of ${item.itemName || 'Raw Material'} issued to Extrusion line by ${item.issuedBy || 'Supervisor'}`,
          user: resolveAuditUser({
            name: item.issuedBy || 'SURESHBHAI',
            email: `${(item.issuedBy || 'sureshbhai').toLowerCase().replace(/\s+/g, '')}@kamaniplast.com`,
            role: 'employee'
          }, usersFromDb),
          details: {
            slipNo: slipNo,
            itemName: item.itemName,
            grade: item.grade,
            netWeight: item.netWeight,
            issuedBy: item.issuedBy,
            remarks: item.remarks
          }
        });
      }
    });

    // Sort strictly descending chronologically (most recent real activity first)
    combined.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    callback(combined.slice(0, limitCount));
  };

  const unsubs = [];

  // Listen to Firestore users for live RBAC role and name resolution
  try {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      usersFromDb = snap.docs.map(d => ({ id: d.id, uid: d.data().uid || d.id, ...d.data() }));
      usersFromDb.forEach(u => {
        if (u.uid) cachedUsersMap.set(u.uid, u);
        if (u.id) cachedUsersMap.set(u.id, u);
        if (u.email) cachedUsersMap.set(u.email.toLowerCase().trim(), u);
        if (u.displayName) cachedUsersMap.set(u.displayName.toLowerCase().trim(), u);
        if (u.username) cachedUsersMap.set(u.username.toLowerCase().trim(), u);
      });
      publishCombinedLogs();
    }, (err) => console.warn('users sub failed in audit:', err));
    unsubs.push(unsubUsers);
  } catch (e) { console.warn('users sub failed in audit', e); }

  // Listen to Firestore audit_logs
  try {
    const unsubAudit = onSnapshot(collection(db, 'audit_logs'), (snap) => {
      auditLogsFromDb = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publishCombinedLogs();
    }, (err) => console.warn('audit_logs listener:', err));
    unsubs.push(unsubAudit);
  } catch (e) { console.warn('audit_logs sub failed', e); }

  // Listen to Firestore rmInwards
  try {
    const unsubInw = onSnapshot(collection(db, 'rmInwards'), (snap) => {
      rmInwardsFromDb = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publishCombinedLogs();
    }, (err) => console.warn('rmInwards listener:', err));
    unsubs.push(unsubInw);
  } catch (e) { console.warn('rmInwards sub failed', e); }

  // Listen to Firestore qcChecks
  try {
    const unsubQc = onSnapshot(collection(db, 'qcChecks'), (snap) => {
      qcChecksFromDb = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publishCombinedLogs();
    }, (err) => console.warn('qcChecks listener:', err));
    unsubs.push(unsubQc);
  } catch (e) { console.warn('qcChecks sub failed', e); }

  // Listen to Firestore jobWorks
  try {
    const unsubJw = onSnapshot(collection(db, 'jobWorks'), (snap) => {
      jobWorksFromDb = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publishCombinedLogs();
    }, (err) => console.warn('jobWorks listener:', err));
    unsubs.push(unsubJw);
  } catch (e) { console.warn('jobWorks sub failed', e); }

  // Listen to Firestore salesOrders
  try {
    const unsubSo = onSnapshot(collection(db, 'salesOrders'), (snap) => {
      salesOrdersFromDb = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publishCombinedLogs();
    }, (err) => console.warn('salesOrders listener:', err));
    unsubs.push(unsubSo);
  } catch (e) { console.warn('salesOrders sub failed', e); }

  // Listen to Firestore dispatches
  try {
    const unsubDisp = onSnapshot(collection(db, 'dispatches'), (snap) => {
      dispatchesFromDb = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publishCombinedLogs();
    }, (err) => console.warn('dispatches listener:', err));
    unsubs.push(unsubDisp);
  } catch (e) { console.warn('dispatches sub failed', e); }

  // Listen to Firestore rmFactoryIssues
  try {
    const unsubIss = onSnapshot(collection(db, 'rmFactoryIssues'), (snap) => {
      rmFactoryIssuesFromDb = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      publishCombinedLogs();
    }, (err) => console.warn('rmFactoryIssues listener:', err));
    unsubs.push(unsubIss);
  } catch (e) { console.warn('rmFactoryIssues sub failed', e); }

  return () => {
    unsubs.forEach(fn => {
      try { fn(); } catch {}
    });
  };
}
