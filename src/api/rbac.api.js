import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { logAuditEvent } from './audit.api';

/**
 * Platform Core Modules List
 */
export const ERP_MODULES = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Operations Overview, plant pipeline KPIs & metrics',
    route: '/dashboard'
  },
  {
    id: 'jobwork',
    label: 'Job Work Hub',
    description: 'Outward challans, inward slips, contractor ledger & scrap tracking',
    route: '/job-work'
  },
  {
    id: 'inventory',
    label: 'Inventory & Stock',
    description: 'Raw Material GRN inward register, bag dual stock & traceability',
    route: '/inventory'
  },
  {
    id: 'sales',
    label: 'Sales & Dispatch',
    description: 'Sales orders, stock reservation & Rule 55 dispatch delivery slips',
    route: '/sales'
  },
  {
    id: 'processMasters',
    label: 'Process & Plant Masters',
    description: 'Machine processes, godowns/locations & batch formula matrix',
    route: '/process-masters'
  },
  {
    id: 'directory',
    label: 'Directory & Settings',
    description: 'Vendors, customers, JW rates, tare standards & RBAC user management',
    route: '/directory'
  }
];

/**
 * Default module access per role
 */
export const ROLE_DEFAULT_MODULES = {
  admin: ['dashboard', 'jobwork', 'inventory', 'sales', 'processMasters', 'directory'],
  accountant: ['dashboard', 'jobwork', 'inventory', 'sales', 'directory'],
  employee: ['jobwork', 'inventory', 'sales']
};

export const ROLE_LABELS = {
  admin: 'Administrator',
  accountant: 'Accountant',
  employee: 'Employee'
};

export const ROLE_COLORS = {
  admin: { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
  accountant: { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
  employee: { bg: '#f1f5f9', text: '#334155', border: '#cbd5e1' }
};

/**
 * Real-time listener for all user profiles in Firestore
 */
export function subscribeUsers(callback) {
  if (!db) return () => {};
  const q = query(collection(db, 'users'));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const role = data.role || (data.email?.toLowerCase().includes('admin') ? 'admin' : 'employee');
      const assignedModules = Array.isArray(data.assignedModules) 
        ? data.assignedModules 
        : (ROLE_DEFAULT_MODULES[role] || ROLE_DEFAULT_MODULES.employee);

      return {
        id: docSnap.id,
        uid: data.uid || docSnap.id,
        email: data.email || '',
        displayName: data.displayName || data.username || 'ERP User',
        username: data.username || '',
        role: role,
        assignedModules: assignedModules,
        status: data.status || 'ACTIVE',
        updatedAt: data.updatedAt
      };
    });
    callback(list);
  }, (err) => {
    console.error('Error listening to users collection:', err);
    callback([]);
  });
}

/**
 * Admin updates a user's role and assigned modules
 */
export async function updateUserAccess(uid, { role, assignedModules, status }) {
  if (!db || !uid) throw new Error('Firestore not initialized or missing UID');
  const userRef = doc(db, 'users', uid);

  const updates = {
    role: role || 'employee',
    assignedModules: Array.isArray(assignedModules) ? assignedModules : (ROLE_DEFAULT_MODULES[role] || []),
    status: status || 'ACTIVE',
    updatedAt: serverTimestamp()
  };

  await setDoc(userRef, updates, { merge: true });

  await logAuditEvent({
    category: 'SECURITY',
    action: 'RBAC_USER_PERMISSIONS_UPDATED',
    summary: `Admin updated user ${uid} permissions (Role: ${updates.role}, Modules: ${(updates.assignedModules || []).join(', ')})`,
    targetId: uid,
    details: updates
  });

  return updates;
}

