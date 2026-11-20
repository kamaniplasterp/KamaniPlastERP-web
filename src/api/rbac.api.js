import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  where,
  updateDoc,
  setDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { db, isFirebaseConfigured, firebaseConfig } from '../firebase/firebase';
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
 * Platform Granular Sub-Modules
 */
export const ERP_SUBMODULES = [
  // 1. Job Work Hub
  { id: 'jobwork_outward', moduleId: 'jobwork', moduleLabel: 'Job Work Hub', label: 'Outward Challans', description: 'Create and dispatch material to job workers (JW-1)' },
  { id: 'jobwork_inward', moduleId: 'jobwork', moduleLabel: 'Job Work Hub', label: 'Inward Slips', description: 'Receive processed goods & record wastage (JW-2)' },
  { id: 'jobwork_trace', moduleId: 'jobwork', moduleLabel: 'Job Work Hub', label: 'Challan Trace', description: 'Reconcile outstanding materials outside plant' },
  { id: 'jobwork_contractor', moduleId: 'jobwork', moduleLabel: 'Job Work Hub', label: 'Contractor Ledger', description: 'Processor billing, statements & rate audits' },
  { id: 'jobwork_scrap', moduleId: 'jobwork', moduleLabel: 'Job Work Hub', label: 'Scrap & Burning Loss', description: 'Burning loss & processing scrap settlements' },

  // 2. Inventory & Stock
  { id: 'inventory_rm', moduleId: 'inventory', moduleLabel: 'Inventory & Stock', label: 'Raw Material GRN', description: 'GRN inward register, gross-tare weighment' },
  { id: 'inventory_fg', moduleId: 'inventory', moduleLabel: 'Inventory & Stock', label: 'Finished Goods', description: 'Finished yarn inventory & stock balance' },
  { id: 'inventory_bags', moduleId: 'inventory', moduleLabel: 'Inventory & Stock', label: 'Bags & Dual Stock', description: 'Bag-level barcode scanning & physical audit' },
  { id: 'inventory_movements', moduleId: 'inventory', moduleLabel: 'Inventory & Stock', label: 'Stock Movements', description: 'Internal godown transfers and adjustments' },

  // 3. Sales & Dispatch
  { id: 'sales_orders', moduleId: 'sales', moduleLabel: 'Sales & Dispatch', label: 'Sales Orders', description: 'Customer orders and stock reservations' },
  { id: 'sales_challans', moduleId: 'sales', moduleLabel: 'Sales & Dispatch', label: 'Dispatch Challans', description: 'Rule 55 delivery slips and transport gates' },

  // 4. Process & Plant Masters
  { id: 'masters_operations', moduleId: 'processMasters', moduleLabel: 'Process & Plant Masters', label: 'Operations & Wastage', description: 'Machine processes and tolerance benchmarks' },
  { id: 'masters_godowns', moduleId: 'processMasters', moduleLabel: 'Process & Plant Masters', label: 'Godowns & Locations', description: 'Storage locations, godowns and vendor units' },
  { id: 'masters_products', moduleId: 'processMasters', moduleLabel: 'Process & Plant Masters', label: 'Product Matrix & SKUs', description: 'Color, form, size & product SKU generator' },

  // 5. Directory & Admin
  { id: 'directory_business', moduleId: 'directory', moduleLabel: 'Directory & Admin', label: 'Business Directory', description: 'Vendor, contractor and customer profiles' },
  { id: 'directory_rates', moduleId: 'directory', moduleLabel: 'Directory & Admin', label: 'JW Rates & Valuation', description: 'Processing rate contracts and Rule 55 valuation' },
  { id: 'directory_settings', moduleId: 'directory', label: 'Plant Settings', moduleLabel: 'Directory & Admin', description: 'Tare standards, FY setup and signatories' },
  { id: 'directory_rbac', moduleId: 'directory', label: 'User Roles & RBAC', moduleLabel: 'Directory & Admin', description: 'Staff credentials and access permissions' },
  { id: 'directory_audit', moduleId: 'directory', label: 'Security Audit Logs', moduleLabel: 'Directory & Admin', description: 'Security audit trail and operational history' }
];

/**
 * Default granular permissions per role: { [subModuleId]: { read, create, update } }
 */
export const ROLE_DEFAULT_PERMISSIONS = {
  admin: ERP_SUBMODULES.reduce((acc, sub) => {
    acc[sub.id] = { read: true, create: true, update: true };
    return acc;
  }, {}),
  accountant: ERP_SUBMODULES.reduce((acc, sub) => {
    const isMasterOrAdmin = sub.moduleId === 'processMasters' || sub.id === 'directory_rbac' || sub.id === 'directory_settings';
    acc[sub.id] = {
      read: true,
      create: !isMasterOrAdmin,
      update: !isMasterOrAdmin
    };
    return acc;
  }, {}),
  employee: ERP_SUBMODULES.reduce((acc, sub) => {
    const isFloorOp = sub.moduleId === 'jobwork' || sub.moduleId === 'inventory' || sub.moduleId === 'sales';
    acc[sub.id] = {
      read: isFloorOp,
      create: isFloorOp,
      update: false
    };
    return acc;
  }, {})
};

/**
 * Helper to check whether a user profile has permission for a specific sub-module action
 */
export function checkPermission(userProfile, subModuleId, action = 'read') {
  if (!userProfile) return false;
  if (userProfile.role === 'admin') return true;
  if (userProfile.permissions && userProfile.permissions[subModuleId]) {
    return Boolean(userProfile.permissions[subModuleId][action]);
  }
  const defaultRolePerms = ROLE_DEFAULT_PERMISSIONS[userProfile.role] || ROLE_DEFAULT_PERMISSIONS.employee;
  return Boolean(defaultRolePerms[subModuleId]?.[action]);
}

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

      const defaultRolePerms = ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.employee;
      const permissions = role === 'admin'
        ? ROLE_DEFAULT_PERMISSIONS.admin
        : (data.permissions && typeof data.permissions === 'object' ? data.permissions : defaultRolePerms);

      return {
        id: docSnap.id,
        uid: data.uid || docSnap.id,
        email: data.email || '',
        displayName: data.displayName || data.username || 'ERP User',
        username: data.username || '',
        role: role,
        assignedModules: assignedModules,
        permissions: permissions,
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
export async function updateUserAccess(userTarget, { role, assignedModules, permissions, status }) {
  if (!db || !userTarget) throw new Error('Firestore not initialized or missing user target');
  
  const targetId = typeof userTarget === 'string' ? userTarget : (userTarget.id || userTarget.uid);
  const targetUid = typeof userTarget === 'object' ? userTarget.uid : null;
  const targetEmail = typeof userTarget === 'object' ? userTarget.email : null;

  const finalRole = role || 'employee';
  const defaultRolePerms = ROLE_DEFAULT_PERMISSIONS[finalRole] || ROLE_DEFAULT_PERMISSIONS.employee;
  const updates = {
    role: finalRole,
    assignedModules: finalRole === 'admin' 
      ? ERP_MODULES.map(m => m.id) 
      : (Array.isArray(assignedModules) ? assignedModules : (ROLE_DEFAULT_MODULES[finalRole] || [])),
    permissions: finalRole === 'admin'
      ? ROLE_DEFAULT_PERMISSIONS.admin
      : (permissions && typeof permissions === 'object' ? permissions : defaultRolePerms),
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

/**
 * Admin creates a new employee / user account with login credentials & permissions.
 * Uses a temporary secondary Firebase App instance so the current Admin session is not signed out.
 */
export async function createEmployeeUser({
  username,
  email,
  password,
  displayName,
  role = 'employee',
  assignedModules = null,
  permissions = null,
  status = 'ACTIVE'
}) {
  const cleanUsername = (username || '').trim().toLowerCase().replace(/^@+/, '');
  const rawEmail = (email || '').trim().toLowerCase();
  const cleanEmail = rawEmail || (cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@kamaniplast.com`);
  const cleanDisplayName = (displayName || '').trim() || cleanUsername || 'Staff User';

  if (!cleanUsername) {
    throw new Error('Username is required.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long.');
  }

  // Check if username already exists in Firestore
  if (db) {
    try {
      const uDocRef = doc(db, 'usernames', cleanUsername);
      const uSnap = await getDoc(uDocRef);
      if (uSnap.exists()) {
        throw new Error(`Username "${cleanUsername}" is already taken. Please choose another username.`);
      }
    } catch (lookupErr) {
      if (lookupErr.message?.includes('already taken')) throw lookupErr;
      console.warn('Username uniqueness check warning:', lookupErr);
    }
  }

  let uid = null;

  if (isFirebaseConfigured && firebaseConfig?.apiKey) {
    const secondaryAppName = `SecondaryAuth-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, cleanEmail, password);
      uid = userCred.user.uid;
      if (cleanDisplayName) {
        await updateProfile(userCred.user, { displayName: cleanDisplayName }).catch(() => {});
      }
      await signOut(secondaryAuth).catch(() => {});
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') {
        throw new Error(`The email "${cleanEmail}" is already registered. Please provide another email or username.`);
      } else if (err.code === 'auth/weak-password') {
        throw new Error('Password should be at least 6 characters.');
      } else if (err.code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      }
      throw err;
    } finally {
      await deleteApp(secondaryApp).catch(() => {});
    }
  } else {
    // Local / Offline fallback UID
    uid = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }

  const validRoles = ['admin', 'accountant', 'employee'];
  const finalRole = validRoles.includes(role) ? role : 'employee';
  const defaultRolePerms = ROLE_DEFAULT_PERMISSIONS[finalRole] || ROLE_DEFAULT_PERMISSIONS.employee;
  const finalPermissions = finalRole === 'admin'
    ? ROLE_DEFAULT_PERMISSIONS.admin
    : (permissions && typeof permissions === 'object' ? permissions : defaultRolePerms);

  const finalModules = finalRole === 'admin'
    ? ERP_MODULES.map(m => m.id)
    : (Array.isArray(assignedModules) && assignedModules.length > 0
        ? assignedModules
        : (ROLE_DEFAULT_MODULES[finalRole] || ROLE_DEFAULT_MODULES.employee));

  if (db && uid) {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      uid: uid,
      email: cleanEmail,
      username: cleanUsername,
      displayName: cleanDisplayName,
      role: finalRole,
      assignedModules: finalModules,
      permissions: finalPermissions,
      status: status || 'ACTIVE',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    if (cleanUsername) {
      await setDoc(doc(db, 'usernames', cleanUsername), {
        email: cleanEmail,
        uid: uid,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }

  await logAuditEvent({
    category: 'SECURITY',
    action: 'USER_ACCOUNT_CREATED',
    summary: `Admin created new ${finalRole.toUpperCase()} account for "${cleanDisplayName}" (${cleanUsername})`,
    targetId: cleanEmail,
    details: {
      username: cleanUsername,
      email: cleanEmail,
      displayName: cleanDisplayName,
      role: finalRole,
      assignedModules: finalModules,
      uid
    }
  });

  return {
    uid,
    username: cleanUsername,
    email: cleanEmail,
    displayName: cleanDisplayName,
    role: finalRole,
    assignedModules: finalModules,
    permissions: finalPermissions
  };
}



