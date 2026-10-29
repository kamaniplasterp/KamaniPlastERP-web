import {
  collection,
  onSnapshot,
  doc,
  getDocs,
  where,
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

export const MODULE_ROUTES = {
  dashboard: '/dashboard',
  jobwork: '/job-work',
  inventory: '/inventory',
  sales: '/sales',
  processMasters: '/process-masters',
  directory: '/directory'
};

/**
 * Returns the default home/landing route for a given role or assigned modules list
 */
export function getDefaultRouteForRole(role = 'employee', assignedModules = []) {
  if (role === 'admin') return '/dashboard';

  const modules = Array.isArray(assignedModules) && assignedModules.length > 0
    ? assignedModules
    : (ROLE_DEFAULT_MODULES[role] || []);

  if (modules.includes('dashboard')) return '/dashboard';

  for (const modId of modules) {
    if (MODULE_ROUTES[modId]) return MODULE_ROUTES[modId];
  }

  return '/job-work';
}

/**
 * Real-time listener for all user profiles in Firestore
 */
export function subscribeUsers(callback) {
  if (!db) return () => {};
  const q = query(collection(db, 'users'));
  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map(docSnap => {
      const data = docSnap.data();
      const emailLower = (data.email || '').toLowerCase().trim();
      const isMasterAdmin = emailLower === 'admin@kamaniplast.com' ||
                            emailLower === 'kamaniplasterp@kamaniplast.com' ||
                            emailLower.startsWith('admin@');

      const validRoles = ['admin', 'accountant', 'employee'];
      const role = validRoles.includes(data.role) ? data.role : (isMasterAdmin ? 'admin' : 'employee');

      const assignedModules = role === 'admin' 
        ? ERP_MODULES.map(m => m.id)
        : (Array.isArray(data.assignedModules) 
            ? data.assignedModules 
            : (ROLE_DEFAULT_MODULES[role] || ROLE_DEFAULT_MODULES.employee));

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
 * Updates all matching documents (by document ID, UID, and Email) to guarantee consistency.
 */
export async function updateUserAccess(userTarget, { role, assignedModules, status }) {
  if (!db || !userTarget) throw new Error('Firestore not initialized or missing user target');
  
  const targetId = typeof userTarget === 'string' ? userTarget : (userTarget.id || userTarget.uid);
  const targetUid = typeof userTarget === 'object' ? userTarget.uid : null;
  const targetEmail = typeof userTarget === 'object' ? userTarget.email : null;

  const updates = {
    role: role || 'employee',
    assignedModules: role === 'admin' 
      ? ERP_MODULES.map(m => m.id) 
      : (Array.isArray(assignedModules) ? assignedModules : (ROLE_DEFAULT_MODULES[role] || [])),
    status: status || 'ACTIVE',
    updatedAt: serverTimestamp()
  };

  const docIdsToUpdate = new Set([targetId, targetUid].filter(Boolean));

  // If email is provided, also find and update any alternate document IDs for this user
  if (targetEmail) {
    try {
      const q = query(collection(db, 'users'), where('email', '==', targetEmail.toLowerCase().trim()));
      const snap = await getDocs(q);
      snap.forEach(d => docIdsToUpdate.add(d.id));
    } catch (_) {}
  }

  for (const docId of docIdsToUpdate) {
    const userRef = doc(db, 'users', docId);
    await setDoc(userRef, updates, { merge: true });
  }

  await logAuditEvent({
    category: 'SECURITY',
    action: 'RBAC_USER_PERMISSIONS_UPDATED',
    summary: `Admin updated permissions for ${targetEmail || targetId} (Role: ${updates.role}, Modules: ${updates.assignedModules.length})`,
    targetId: targetEmail || targetId,
    details: updates
  });

  return updates;
}



