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
  where,
  getDocs,
  arrayUnion,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { logAuditEvent } from './audit.api';

export const NOTIFICATION_CATEGORIES = {
  WEIGHT: { id: 'WEIGHT', label: 'Weight & Tare', icon: '⚠️', color: '#ea580c' },
  QC: { id: 'QC', label: 'Quality Control', icon: '⏱️', color: '#dc2626' },
  STOCK: { id: 'STOCK', label: 'Inventory Stock', icon: '📦', color: '#0284c7' },
  JOB_WORK: { id: 'JOB_WORK', label: 'Job Work', icon: '🚚', color: '#d97706' },
  SALES: { id: 'SALES', label: 'Sales & Dispatch', icon: '🚀', color: '#16a34a' },
  SECURITY: { id: 'SECURITY', label: 'Security & Access', icon: '🔒', color: '#7c3aed' },
  SYSTEM: { id: 'SYSTEM', label: 'System', icon: '🔔', color: '#475569' }
};

/**
 * Subscribe to real-time notifications for the current authenticated user.
 * Filters out notifications that the user has dismissed.
 * Respects role-based targeting (targetRoles) and direct user targeting (targetUserIds).
 */
export function subscribeUserNotifications(currentUser, callback, limitCount = 60) {
  if (!db) {
    callback([]);
    return () => {};
  }

  const userUid = currentUser?.uid || '';
  const userRole = currentUser?.role || (currentUser?.email?.toLowerCase().includes('admin') ? 'admin' : 'employee');

  const q = query(
    collection(db, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const dismissedBy = Array.isArray(data.dismissedBy) ? data.dismissedBy : [];
      
      // If user explicitly dismissed this notification, do not show it
      if (userUid && dismissedBy.includes(userUid)) {
        return;
      }

      // Check role/user targeting
      const targetRoles = Array.isArray(data.targetRoles) ? data.targetRoles : ['*'];
      const targetUserIds = Array.isArray(data.targetUserIds) ? data.targetUserIds : [];

      // QC Overdue alerts are strictly restricted to Admin accounts only
      const isQcAlert = 
        data.category === 'QC' || 
        String(data.category || '').toUpperCase() === 'QC' ||
        data.type === 'QC_OVERDUE' ||
        (data.sourceKey && String(data.sourceKey).startsWith('QC_')) ||
        (data.title && /quality check|qc overdue/i.test(data.title));

      if (isQcAlert && userRole !== 'admin') {
        return;
      }

      const roleMatch = targetRoles.includes('*') || targetRoles.includes(userRole);
      const userMatch = targetUserIds.length === 0 || (userUid && targetUserIds.includes(userUid));

      if (roleMatch || userMatch) {
        const readBy = Array.isArray(data.readBy) ? data.readBy : [];
        const isRead = Boolean(userUid && readBy.includes(userUid));

        list.push({
          id: docSnap.id,
          ...data,
          isRead,
          createdAtDate: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date())
        });
      }
    });

    callback(list);
  }, (err) => {
    console.error('Error subscribing to notifications:', err);
    callback([]);
  });
}

/**
 * Create a new notification document with automatic deduplication by sourceKey.
 * If a notification with the same sourceKey already exists and has not expired, it will not duplicate.
 */
export async function createNotification(notifData) {
  if (!db) return null;

  try {
    const sourceKey = notifData.sourceKey || null;

    // Deduplication check
    if (sourceKey) {
      const existingQuery = query(
        collection(db, 'notifications'),
        where('sourceKey', '==', sourceKey),
        limit(1)
      );
      const snap = await getDocs(existingQuery);
      if (!snap.empty) {
        // Notification for this source already exists
        return snap.docs[0].id;
      }
    }

    const payload = {
      sourceKey: sourceKey || `GEN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      title: notifData.title || 'System Notification',
      message: notifData.message || '',
      category: notifData.category || 'SYSTEM',
      severity: notifData.severity || 'medium', // 'low' | 'medium' | 'high' | 'critical'
      targetRoles: Array.isArray(notifData.targetRoles) ? notifData.targetRoles : ['*'],
      targetUserIds: Array.isArray(notifData.targetUserIds) ? notifData.targetUserIds : [],
      readBy: [],
      dismissedBy: [],
      actionPath: notifData.actionPath || '/dashboard',
      actionState: notifData.actionState || {},
      meta: notifData.meta || '',
      timeTag: notifData.timeTag || 'Alert',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'notifications'), payload);

    if (payload.severity === 'high' || payload.severity === 'critical') {
      logAuditEvent({
        category: payload.category === 'WEIGHT' ? 'INVENTORY' : (payload.category === 'QC' ? 'QUALITY_CONTROL' : 'SYSTEM'),
        action: 'SYSTEM_ALERT_DISPATCHED',
        summary: `[${payload.severity.toUpperCase()}] ${payload.title}`,
        targetId: payload.sourceKey,
        details: payload
      });
    }

    return docRef.id;
  } catch (err) {
    console.error('Error creating notification:', err);
    return null;
  }
}

/**
 * Mark a notification as read by the current user.
 */
export async function markNotificationAsRead(id, userUid) {
  if (!db || !id || !userUid) return;
  try {
    const notifRef = doc(db, 'notifications', id);
    await updateDoc(notifRef, {
      readBy: arrayUnion(userUid),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Error marking notification as read:', err);
  }
}

/**
 * Dismiss a notification for the current user.
 * Persists the user's UID in dismissedBy so it never re-appears for this user.
 */
export async function dismissNotification(id, userUid) {
  if (!db || !id || !userUid) return;
  try {
    const notifRef = doc(db, 'notifications', id);
    await updateDoc(notifRef, {
      dismissedBy: arrayUnion(userUid),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    console.error('Error dismissing notification:', err);
  }
}

/**
 * Dismiss all active notifications in batch for the current user.
 */
export async function dismissAllNotifications(ids = [], userUid) {
  if (!db || !Array.isArray(ids) || ids.length === 0 || !userUid) return;
  try {
    const batch = writeBatch(db);
    for (const id of ids) {
      const notifRef = doc(db, 'notifications', id);
      batch.update(notifRef, {
        dismissedBy: arrayUnion(userUid),
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
  } catch (err) {
    console.error('Error dismissing all notifications:', err);
  }
}

/**
 * Delete a notification document permanently (Admin operation)
 */
export async function deleteNotification(id) {
  if (!db || !id) return;
  try {
    await deleteDoc(doc(db, 'notifications', id));
  } catch (err) {
    console.error('Error deleting notification:', err);
  }
}

/**
 * System Watchdog Sync Engine:
 * Synchronizes operational alerts (Tare variance, Weight discrepancies, Overdue QC SLAs)
 * into persistent Firestore notifications without spamming duplicates.
 */
export async function syncSystemWatchdogAlerts({
  rmInwards = [],
  qcChecks = [],
  tareStandards = { varianceAllowanceKg: 50 },
  rawMaterials = [],
  finishedGoods = []
}) {
  if (!db) return;

  const tareLimitKg = Number(tareStandards?.varianceAllowanceKg !== undefined ? tareStandards.varianceAllowanceKg : 50);

  // 1. Tare Variance Exceeded Alerts
  for (const inw of rmInwards) {
    const tare = Number(
      inw.articleWeight !== undefined
        ? inw.articleWeight
        : (inw.varianceKg !== undefined
            ? inw.varianceKg
            : (inw.grossWeight && inw.netWeight ? inw.grossWeight - inw.netWeight : 0))
    );

    if (inw.isTareVarianceExceeded || (tare > 0 && tare > tareLimitKg)) {
      const gross = Number(inw.grossWeight || 0);
      const tarePct = gross > 0 ? ((tare / gross) * 100).toFixed(1) : 0;
      const diff = (tare - tareLimitKg).toFixed(1);
      const grnKey = inw.grnNo || inw.id;

      await createNotification({
        sourceKey: `TARE_EXCEEDED_${grnKey}`,
        title: `Tare Variance Exceeded: ${grnKey}`,
        message: `Tare deduction of ${tare.toLocaleString()} KG (${tarePct}%) exceeds threshold (${tareLimitKg} KG) by ${diff} KG. Bag count: ${inw.bagCount || inw.noOfArticles || '—'}.`,
        category: 'WEIGHT',
        severity: 'high',
        targetRoles: ['admin'],
        actionPath: '/inventory',
        actionState: { tab: 'rm', subView: 'inward', search: inw.batchNumber || grnKey },
        meta: `${inw.supplierName || 'Supplier'} • ${inw.itemName || 'Material'} • Inward: ${inw.date || '—'}`,
        timeTag: 'Tare Exceeded'
      });
    }

    // Weight Discrepancy (Billed > Gross)
    const billed = Number(inw.challanWeight || 0);
    const grossW = Number(inw.grossWeight || 0);
    if (billed > 0 && billed > grossW) {
      const diff = (billed - grossW).toFixed(1);
      const grnKey = inw.grnNo || inw.id;

      await createNotification({
        sourceKey: `WEIGHT_DISCREPANCY_${grnKey}`,
        title: `Weight Discrepancy: ${grnKey}`,
        message: `Billed weight (${billed.toLocaleString()} KG) exceeds Gross (${grossW.toLocaleString()} KG) by ${diff} KG. Batch: ${inw.batchNumber || '—'}.`,
        category: 'WEIGHT',
        severity: 'high',
        targetRoles: ['admin', 'accountant'],
        actionPath: '/inventory',
        actionState: { tab: 'rm', subView: 'inward', search: inw.batchNumber || grnKey },
        meta: `${inw.supplierName || 'Supplier'} • Challan #${inw.challanNo || '—'}`,
        timeTag: inw.date || 'Recent'
      });
    }
  }

  // 2. Overdue QC Inspection SLAs
  for (const inw of rmInwards) {
    const matchQc = qcChecks.find(q => (q.grnId && q.grnId === inw.id) || (q.grnNo && q.grnNo === inw.grnNo));
    const isAccepted = inw.qcStatus === 'ACCEPTED' || matchQc?.result === 'PASS' || matchQc?.status === 'APPROVED';
    if (isAccepted) continue;

    const deadline = matchQc?.deadlineDate || (matchQc?.deadlineAt?.toDate ? matchQc.deadlineAt.toDate() : null);
    let isOverdue = Boolean(matchQc?.isOverdue);
    if (!isOverdue) {
      if (deadline && deadline.getTime() < Date.now()) {
        isOverdue = true;
      } else if (inw.date) {
        const inwDate = new Date(inw.date);
        if (!isNaN(inwDate.getTime()) && (Date.now() - inwDate.getTime() > 24 * 60 * 60 * 1000)) {
          isOverdue = true;
        }
      }
    }

    if (isOverdue) {
      const grnKey = inw.grnNo || inw.id;
      await createNotification({
        sourceKey: `QC_SLA_OVERDUE_${grnKey}`,
        title: `Quality Check Overdue: ${grnKey}`,
        message: `24-hour inspection SLA exceeded for ${inw.itemName} (${inw.batchNumber || 'No Batch'}). Physical inspection required.`,
        category: 'QC',
        severity: 'high',
        targetRoles: ['admin'], // Restrict QC Overdue alerts to Admin only
        actionPath: '/inventory',
        actionState: { tab: 'rm', subView: 'inward', search: inw.batchNumber || grnKey },
        meta: `${inw.supplierName || 'Supplier'} • Inward: ${inw.date || '—'}`,
        timeTag: 'SLA Overdue'
      });
    }
  }

  // 3. Low Stock Alerts
  for (const rm of rawMaterials) {
    const total = (Number(rm.availFactory) || 0) + (Number(rm.atJobWork) || 0);
    const reorder = Number(rm.reorderLevel) || 1000;
    if (total > 0 && total < reorder) {
      const rmKey = rm.code || rm.id;
      await createNotification({
        sourceKey: `LOW_STOCK_RM_${rmKey}`,
        title: `Low Stock: ${rm.name || rmKey}`,
        message: `Current stock (${total.toLocaleString()} KG) is below reorder level (${reorder.toLocaleString()} KG).`,
        category: 'STOCK',
        severity: 'medium',
        targetRoles: ['admin', 'accountant'],
        actionPath: '/inventory',
        actionState: { tab: 'rm', subView: 'ledger', search: rm.name || rmKey },
        meta: `Factory: ${Number(rm.availFactory || 0).toLocaleString()} KG • Grade: ${rm.grade || '—'}`,
        timeTag: 'Low RM'
      });
    }
  }

  for (const fg of finishedGoods) {
    const total = Number(fg.stockQty || 0);
    const reorder = Number(fg.reorderLevel) || 50;
    if (total > 0 && total < reorder) {
      const fgKey = fg.code || fg.id;
      await createNotification({
        sourceKey: `LOW_STOCK_FG_${fgKey}`,
        title: `Low FG Stock: ${fg.name || fgKey}`,
        message: `Finished stock (${total.toLocaleString()} Coils) is below minimum reserve (${reorder.toLocaleString()}).`,
        category: 'STOCK',
        severity: 'medium',
        targetRoles: ['admin', 'accountant'],
        actionPath: '/inventory',
        actionState: { tab: 'fg', search: fg.name || fgKey },
        meta: `${fg.category || 'Finished Goods'}`,
        timeTag: 'Low FG'
      });
    }
  }
}

