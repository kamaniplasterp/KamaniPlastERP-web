import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search, Phone, MapPin, Building, RotateCcw, Save, CheckCircle2, FileText, Plus, Download,
  Layers, Package, Users, DollarSign, Tag, Calculator, ShieldCheck, MessageSquare,
  Shield, Check, X, Lock, Unlock, UserCheck, ShieldAlert, Activity, Eye, Copy, Filter, Clock,
  Edit2, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  subscribeUsers, 
  updateUserAccess, 
  ERP_MODULES, 
  ROLE_DEFAULT_MODULES, 
  ROLE_LABELS, 
  ROLE_COLORS 
} from '../api/rbac.api';
import { 
  subscribeAuditLogs, 
  logAuditEvent, 
  resolveAuditUser,
  AUDIT_CATEGORIES 
} from '../api/audit.api';
import { 
  subscribeVendors, 
  subscribeBuyers, 
  addVendor, 
  updateVendor,
  deleteVendor,
  addBuyer, 
  updateBuyer,
  deleteBuyer,
  subscribeJobWorkRates, 
  addJobWorkRate,
  updateJobWorkRate,
  deleteJobWorkRate,
  subscribeJwValueMasters,
  addJwValueMaster,
  updateJwValueMaster,
  deleteJwValueMaster,
  subscribeTareStandards,
  updateTareStandards,
  subscribePersonnel,
  addPersonnel,
  deletePersonnel,
  subscribeCompanyProfile,
  updateCompanyProfile,
  DEFAULT_TARE_STANDARDS,
  DEFAULT_PERSONNEL,
  DEFAULT_COMPANY_PROFILE
} from '../api/directory.api';
import { subscribeJobWorks } from '../api/jobwork.api';
import { subscribeProcesses } from '../api/process.api';
import { subscribeSalesOrders } from '../api/sales.api';
import { useWorkflow } from '../context/WorkflowContext';
import { exportToCsv } from '../utils/exportCsv';
import AddVendorModal from '../modals/AddVendorModal';
import AddCustomerModal from '../modals/AddCustomerModal';
import JwValueMasterModal from '../modals/JwValueMasterModal';
import HeaderInfoTooltip from '../components/HeaderInfoTooltip';
import { showAlert, showConfirm } from '../context/CustomAlertContext';
import '../styles/DirectorySettings.css';

export default function DirectorySettingsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [directorySubView, setDirectorySubView] = useState('vendors'); // 'vendors' | 'customers'
  const [pricingSubView, setPricingSubView] = useState('rates'); // 'rates' | 'value'
  const [settingsSubView, setSettingsSubView] = useState('tare'); // 'tare' | 'erp'

  const resolveDirTab = (tabParam) => {
    if (!tabParam) return 'directory';
    if (tabParam === 'vendors') { setDirectorySubView('vendors'); return 'directory'; }
    if (tabParam === 'customers') { setDirectorySubView('customers'); return 'directory'; }
    if (tabParam === 'directory') return 'directory';

    if (tabParam === 'rateMaster') { setPricingSubView('rates'); return 'ratesValuation'; }
    if (tabParam === 'valueMaster') { setPricingSubView('value'); return 'ratesValuation'; }
    if (tabParam === 'ratesValuation') return 'ratesValuation';

    if (tabParam === 'miscMaster') { setSettingsSubView('tare'); return 'settings'; }
    if (tabParam === 'settings') { setSettingsSubView('erp'); return 'settings'; }

    if (tabParam === 'rbac') return 'rbac';
    if (tabParam === 'audit') return 'audit';

    return 'directory';
  };

  const [activeTab, setActiveTab] = useState(() => resolveDirTab(searchParams.get('tab')));
  const [vendorSearch, setVendorSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [rateSearch, setRateSearch] = useState('');
  const [ratePartyFilter, setRatePartyFilter] = useState('ALL');
  const [valueSearch, setValueSearch] = useState('');

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      setActiveTab(resolveDirTab(tabFromUrl));
    }
  }, [searchParams]);

  const [liveVendors, setLiveVendors] = useState([]);
  const [liveBuyers, setLiveBuyers] = useState([]);
  const [liveJobWorks, setLiveJobWorks] = useState([]);
  const [liveSalesOrders, setLiveSalesOrders] = useState([]);
  const [liveRates, setLiveRates] = useState([]);
  const [liveValueMasters, setLiveValueMasters] = useState([]);

  // RBAC User Permissions State
  const { isAdmin } = useAuth();
  const [liveUsers, setLiveUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserForRbac, setSelectedUserForRbac] = useState(null);
  const [editRole, setEditRole] = useState('employee');
  const [editAssignedModules, setEditAssignedModules] = useState([]);
  const [isSavingRbac, setIsSavingRbac] = useState(false);

  // Audit Trail State (Admin Only)
  const [liveAuditLogs, setLiveAuditLogs] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditCategoryFilter, setAuditCategoryFilter] = useState('ALL');
  const [showAuditFilterPanel, setShowAuditFilterPanel] = useState(false);
  const [selectedAuditDetail, setSelectedAuditDetail] = useState(null);
  const [copiedAuditJson, setCopiedAuditJson] = useState(false);

  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [selectedVendorToEdit, setSelectedVendorToEdit] = useState(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [selectedCustomerToEdit, setSelectedCustomerToEdit] = useState(null);
  const [showAddRateModal, setShowAddRateModal] = useState(false);
  const [selectedRateToEdit, setSelectedRateToEdit] = useState(null);
  const [showAddValueModal, setShowAddValueModal] = useState(false);
  const [selectedValueToEdit, setSelectedValueToEdit] = useState(null);

  const [newRateForm, setNewRateForm] = useState({
    party: 'GALAXY.ENTERPRISE',
    process: '',
    item: 'ANCHOR YARN ^ YARN HANK',
    uom: 'Kgs',
    rate: '17.50'
  });

  const [tareStandards, setTareStandards] = useState(DEFAULT_TARE_STANDARDS);
  const [personnelList, setPersonnelList] = useState(DEFAULT_PERSONNEL);
  const [newPersonName, setNewPersonName] = useState('');
  const [liveProcesses, setLiveProcesses] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(DEFAULT_COMPANY_PROFILE);

  useEffect(() => {
    const unsubV = subscribeVendors(setLiveVendors);
    const unsubB = subscribeBuyers(setLiveBuyers);
    const unsubJ = subscribeJobWorks(setLiveJobWorks);
    const unsubS = subscribeSalesOrders(setLiveSalesOrders);
    const unsubR = subscribeJobWorkRates(setLiveRates);
    const unsubVal = subscribeJwValueMasters(setLiveValueMasters);
    const unsubTare = subscribeTareStandards(setTareStandards);
    const unsubPers = subscribePersonnel(setPersonnelList);
    const unsubProf = subscribeCompanyProfile(setCompanyProfile);
    const unsubUsers = subscribeUsers(setLiveUsers);
    const unsubAudit = subscribeAuditLogs(setLiveAuditLogs);
    const unsubProc = subscribeProcesses((procs) => {
      setLiveProcesses(procs);
      if (procs?.length) setNewRateForm(f => f.process ? f : { ...f, process: procs[0].processName });
    });
    return () => {
      unsubV();
      unsubB();
      unsubJ();
      unsubS();
      unsubR();
      unsubVal();
      unsubTare();
      unsubPers();
      unsubProf();
      unsubProc();
      unsubUsers();
      unsubAudit();
    };
  }, []);

  const handleOpenRbacModal = (u) => {
    setSelectedUserForRbac(u);
    setEditRole(u.role || 'employee');
    setEditAssignedModules(
      Array.isArray(u.assignedModules)
        ? [...u.assignedModules]
        : [...(ROLE_DEFAULT_MODULES[u.role || 'employee'] || [])]
    );
  };

  const handleRoleChange = (newRole) => {
    setEditRole(newRole);
    if (newRole === 'admin') {
      setEditAssignedModules(ERP_MODULES.map(m => m.id));
    } else {
      setEditAssignedModules([...(ROLE_DEFAULT_MODULES[newRole] || [])]);
    }
  };

  const handleToggleModule = (modId) => {
    if (editRole === 'admin') return;
    setEditAssignedModules(prev =>
      prev.includes(modId) ? prev.filter(id => id !== modId) : [...prev, modId]
    );
  };

  const handleSaveRbac = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedUserForRbac) return;
    setIsSavingRbac(true);
    try {
      await updateUserAccess(selectedUserForRbac, {
        role: editRole,
        assignedModules: editRole === 'admin' ? ERP_MODULES.map(m => m.id) : editAssignedModules,
        status: selectedUserForRbac.status || 'ACTIVE'
      });

      logAuditEvent({
        category: 'SECURITY',
        action: 'RBAC_PERMISSIONS_UPDATED',
        summary: `Updated role to "${editRole.toUpperCase()}" with ${editAssignedModules.length} assigned modules for ${selectedUserForRbac.displayName || selectedUserForRbac.email}`,
        targetId: selectedUserForRbac.displayName || selectedUserForRbac.email,
        details: {
          userUid: selectedUserForRbac.uid || selectedUserForRbac.id,
          role: editRole,
          assignedModules: editAssignedModules
        }
      });

      alert(`Permissions updated successfully for ${selectedUserForRbac.displayName || selectedUserForRbac.email}!`);
      setSelectedUserForRbac(null);
    } catch (err) {
      console.error('Failed to update user RBAC:', err);
      alert('Failed to update permissions: ' + err.message);
    } finally {
      setIsSavingRbac(false);
    }
  };

  const handleSaveVendor = async (data, existingId) => {
    const targetId = existingId || selectedVendorToEdit?.id;
    try {
      if (targetId) {
        await updateVendor(targetId, {
          name: data.name,
          processBadge: data.processBadge,
          phone: data.phone,
          location: data.location,
          gst: data.gst,
          rate: Number(data.rate || 17.5)
        });
        await showAlert(`Vendor "${data.name}" updated successfully!`, { type: 'success', title: 'Vendor Updated' });
      } else {
        await addVendor({
          name: data.name,
          processBadge: data.processBadge,
          phone: data.phone,
          location: data.location,
          gst: data.gst,
          rate: Number(data.rate || 17.5),
          pendingKg: 0
        });
        await showAlert(`Vendor "${data.name}" added successfully!\n✓ Godown location auto-created for "${data.name}" for instant inventory tracking.`, { type: 'success', title: 'Vendor Registered' });
      }
      setSelectedVendorToEdit(null);
    } catch (err) {
      console.error('Error saving vendor:', err);
      await showAlert('Error saving vendor: ' + err.message, { type: 'error' });
    }
  };

  const handleDeleteVendor = async (v) => {
    if (!v.id) {
      await showAlert('Cannot delete vendor without document ID.', { type: 'error' });
      return;
    }
    if (v.pendingTotal > 0) {
      const confirmForce = await showConfirm(
        `Vendor "${v.name}" has ${v.pending} pending material outside at job work. Are you sure you want to delete this vendor record?`,
        {
          title: 'Warning: Active Outside Inventory',
          confirmText: 'Delete Vendor',
          isDestructive: true
        }
      );
      if (!confirmForce) return;
    } else {
      const confirmed = await showConfirm(`Are you sure you want to delete vendor "${v.name}" from ERP Directory?`, {
        title: 'Confirm Vendor Deletion',
        confirmText: 'Delete Vendor',
        isDestructive: true
      });
      if (!confirmed) return;
    }

    try {
      await deleteVendor(v.id, v.name);
      await showAlert(`Vendor "${v.name}" deleted successfully.`, { type: 'success', title: 'Vendor Deleted' });
    } catch (err) {
      console.error('Error deleting vendor:', err);
      await showAlert('Failed to delete vendor: ' + err.message, { type: 'error' });
    }
  };

  const handleSaveCustomer = async (data, existingId) => {
    const targetId = existingId || selectedCustomerToEdit?.id;
    try {
      const payload = {
        name: data.name,
        category: data.category,
        phone: data.phone,
        whatsapp: data.whatsapp || data.phone,
        isWhatsAppDifferent: !!data.isWhatsAppDifferent,
        isPhoneVerified: !!data.isPhoneVerified,
        phoneVerifiedAt: data.phoneVerifiedAt || null,
        isWhatsappVerified: !!data.isWhatsappVerified,
        whatsappVerifiedAt: data.whatsappVerifiedAt || null,
        contactPerson: data.contactPerson || '',
        location: data.location,
        gst: data.gst,
        paymentTerms: data.paymentTerms
      };

      if (targetId) {
        await updateBuyer(targetId, payload);
        await showAlert(`Customer "${data.name}" updated successfully!`, { type: 'success', title: 'Customer Updated' });
      } else {
        await addBuyer({
          ...payload,
          totalOrders: 0,
          outstandingAmount: '₹0.00L'
        });
        await showAlert(`Customer "${data.name}" registered successfully!`, { type: 'success', title: 'Customer Registered' });
      }
      setSelectedCustomerToEdit(null);
    } catch (err) {
      console.error('Error saving customer:', err);
      await showAlert('Error saving customer: ' + err.message, { type: 'error' });
    }
  };

  const handleDeleteCustomer = async (c) => {
    if (!c.id) {
      await showAlert('Cannot delete customer without document ID.', { type: 'error' });
      return;
    }
    if (c.totalOrdersCount > 0) {
      const confirmForce = await showConfirm(
        `Customer "${c.name}" has ${c.orders} (${c.booked}) recorded in Sales Orders. Are you sure you want to delete this customer?`,
        {
          title: 'Warning: Existing Sales Orders',
          confirmText: 'Delete Customer',
          isDestructive: true
        }
      );
      if (!confirmForce) return;
    } else {
      const confirmed = await showConfirm(`Are you sure you want to delete customer "${c.name}" from ERP Directory?`, {
        title: 'Confirm Customer Deletion',
        confirmText: 'Delete Customer',
        isDestructive: true
      });
      if (!confirmed) return;
    }

    try {
      await deleteBuyer(c.id, c.name);
      await showAlert(`Customer "${c.name}" deleted successfully.`, { type: 'success', title: 'Customer Deleted' });
    } catch (err) {
      console.error('Error deleting customer:', err);
      await showAlert('Failed to delete customer: ' + err.message, { type: 'error' });
    }
  };

  const handleSaveNewRate = async (e) => {
    e.preventDefault();
    try {
      if (selectedRateToEdit?.id) {
        await updateJobWorkRate(selectedRateToEdit.id, newRateForm);
        await showAlert(`Updated rate contract for ${newRateForm.party} (${newRateForm.process})!`, { type: 'success', title: 'Rate Contract Updated' });
      } else {
        await addJobWorkRate(newRateForm);
        await showAlert(`Configured Job Work Rate for ${newRateForm.party}!`, { type: 'success', title: 'Rate Contract Created' });
      }
      setShowAddRateModal(false);
      setSelectedRateToEdit(null);
    } catch (err) {
      console.error('Error saving rate:', err);
      await showAlert('Failed to save rate contract: ' + err.message, { type: 'error' });
    }
  };

  const handleDeleteRate = async (r) => {
    if (!r.id) return;
    const confirmed = await showConfirm(`Are you sure you want to delete rate contract for "${r.party}" (${r.process} - ₹${r.rate}/${r.uom || 'Kg'})?`, {
      title: 'Confirm Rate Deletion',
      confirmText: 'Delete Rate',
      isDestructive: true
    });
    if (confirmed) {
      try {
        await deleteJobWorkRate(r.id, r);
        await showAlert('Rate contract deleted successfully!', { type: 'success' });
      } catch (err) {
        console.error('Error deleting rate:', err);
        await showAlert('Failed to delete rate: ' + err.message, { type: 'error' });
      }
    }
  };

  const handleDeleteValueMaster = async (v) => {
    if (!v.id) return;
    const confirmed = await showConfirm(`Are you sure you want to delete valuation entry "${v.code}" (${v.itemDescription} - ₹${v.value}/Kg)?`, {
      title: 'Confirm Valuation Deletion',
      confirmText: 'Delete Entry',
      isDestructive: true
    });
    if (confirmed) {
      try {
        await deleteJwValueMaster(v.id);
        await showAlert(`Valuation entry "${v.code}" deleted successfully!`, { type: 'success' });
      } catch (err) {
        console.error('Error deleting valuation entry:', err);
        await showAlert('Failed to delete valuation entry: ' + err.message, { type: 'error' });
      }
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateCompanyProfile(companyProfile);

      logAuditEvent({
        category: 'MASTER_DATA',
        action: 'COMPANY_SETTINGS_UPDATED',
        summary: `Updated Company & Plant Master Profile: ${companyProfile.name}`,
        targetId: companyProfile.name,
        details: companyProfile
      });

      alert('Factory company profile configuration saved to database successfully!');
    } catch (err) {
      console.error('Error saving company profile:', err);
      alert('Failed to save company profile.');
    }
  };



  // Deduplicate and enrich liveVendors
  const uniqueVendorsMap = new Map();
  (liveVendors || []).forEach(v => {
    const key = (v.name || '').trim().toLowerCase();
    if (key && !uniqueVendorsMap.has(key)) {
      uniqueVendorsMap.set(key, v);
    }
  });

  const displayVendors = Array.from(uniqueVendorsMap.values()).map(v => {
    const matchingJw = liveJobWorks.filter(j => 
      j.vendorId === v.id || 
      j.vendor === v.name || 
      (j.vendor && v.name && j.vendor.toLowerCase().includes(v.name.toLowerCase()))
    );
    const pendingTotal = matchingJw.reduce((sum, j) => {
      const p = j.balQtyKg !== undefined ? Number(j.balQtyKg) : (j.balQty ? parseFloat(String(j.balQty).replace(/[^0-9.]/g, '')) : 0);
      return sum + (p || 0);
    }, 0);

    return {
      ...v,
      id: v.id,
      avatar: (v.name || 'VE').slice(0, 2).toUpperCase(),
      name: v.name || 'Vendor',
      processBadge: v.processBadge || 'Job Work Processor',
      phone: v.phone || '-',
      location: v.location || '-',
      gst: v.gst ? `GST: ${v.gst}` : 'GST: Not Provided',
      rate: typeof v.rate === 'number' ? `₹${v.rate}/KG` : v.rate || '-',
      pending: `${pendingTotal.toLocaleString('en-IN')} KG`,
      pendingTotal,
      pendingOrange: pendingTotal > 0
    };
  });

  // Deduplicate and enrich liveBuyers
  const uniqueBuyersMap = new Map();
  (liveBuyers || []).forEach(b => {
    const key = (b.name || '').trim().toLowerCase();
    if (key && !uniqueBuyersMap.has(key)) {
      uniqueBuyersMap.set(key, b);
    }
  });

  const displayBuyers = Array.from(uniqueBuyersMap.values()).map(b => {
    const matchingOrders = liveSalesOrders.filter(so => 
      so.customerId === b.id || 
      so.customer === b.name || 
      (so.customer && b.name && so.customer.toLowerCase().includes(b.name.toLowerCase())) ||
      (b.name && so.customer && b.name.toLowerCase().includes(so.customer.toLowerCase()))
    );

    const totalOrdersCount = matchingOrders.length;
    const totalBookedValue = matchingOrders.reduce((sum, so) => {
      const val = typeof so.grandTotal === 'number' && so.grandTotal > 0
        ? so.grandTotal
        : (typeof so.totalValue === 'number' && so.totalValue > 0
            ? so.totalValue
            : (typeof so.orderValue === 'string'
                ? parseFloat(so.orderValue.replace(/[^0-9.]/g, '')) || 0
                : (typeof so.orderValue === 'number' ? so.orderValue : 0)));
      return sum + (val || 0);
    }, 0);

    const bookedLakhs = (totalBookedValue / 100000).toFixed(2);

    return {
      ...b,
      id: b.id,
      avatar: (b.name || 'CU').slice(0, 2).toUpperCase(),
      name: b.name || 'Customer',
      termsBadge: b.category || b.paymentTerms || 'Wholesale Buyer',
      phone: b.phone || '',
      whatsapp: b.whatsapp || b.phone || '',
      isPhoneVerified: !!b.isPhoneVerified,
      isWhatsappVerified: !!(b.isWhatsappVerified || (b.isPhoneVerified && !b.isWhatsAppDifferent)),
      contactPerson: b.contactPerson || '',
      location: b.location || '-',
      gst: b.gst ? `GST: ${b.gst}` : 'GST: Not Provided',
      orders: `${totalOrdersCount} Orders`,
      totalOrdersCount,
      booked: `₹${bookedLakhs}L`
    };
  });

  // JW Rate Master loaded 100% dynamically from Firestore DB
  const allRates = liveRates;

  const filteredVendors = displayVendors.filter(v => 
    v.name.toLowerCase().includes(vendorSearch.toLowerCase()) ||
    v.location.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const filteredCustomers = displayBuyers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.location.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const filteredRates = allRates.filter(r => {
    const matchesParty = ratePartyFilter === 'ALL' || (r.party || '').toLowerCase() === ratePartyFilter.toLowerCase();
    const matchesSearch = (r.party || '').toLowerCase().includes(rateSearch.toLowerCase()) ||
      (r.process || '').toLowerCase().includes(rateSearch.toLowerCase()) ||
      (r.item || '').toLowerCase().includes(rateSearch.toLowerCase());
    return matchesParty && matchesSearch;
  });

  const filteredValueMasters = liveValueMasters.filter(v => 
    (v.code || '').toLowerCase().includes(valueSearch.toLowerCase()) ||
    (v.itemDescription || '').toLowerCase().includes(valueSearch.toLowerCase())
  );

  const filteredUsers = (liveUsers || []).filter(u => {
    const q = (userSearch || '').toLowerCase().trim();
    if (!q) return true;
    return (
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.role || '').toLowerCase().includes(q)
    );
  });

  const resolvedAuditLogs = useMemo(() => {
    return (liveAuditLogs || []).map(log => ({
      ...log,
      user: resolveAuditUser(log.user, liveUsers)
    }));
  }, [liveAuditLogs, liveUsers]);

  const filteredAuditLogs = resolvedAuditLogs.filter(log => {
    const q = (auditSearch || '').toLowerCase().trim();
    const matchesSearch = !q ||
      (log.summary || '').toLowerCase().includes(q) ||
      (log.action || '').toLowerCase().includes(q) ||
      (log.targetId || '').toLowerCase().includes(q) ||
      (log.user?.name || '').toLowerCase().includes(q) ||
      (log.user?.email || '').toLowerCase().includes(q) ||
      (log.user?.role || '').toLowerCase().includes(q);

    const matchesCategory = auditCategoryFilter === 'ALL' || log.category === auditCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="ds-container">
      {/* ── Page Header ── */}
      <div className="ds-page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h1 className="ds-page-title">Directory &amp; Master Configuration</h1>
          <HeaderInfoTooltip text="Maintain supplier and customer registries, job worker rates, tare standards, and plant profile." />
        </div>
      </div>

      {/* ── Streamlined Tabs Bar (5 Merged Modules, No Horizontal Scrolling) ── */}
      <div className="ds-tabs-bar">
        <button
          className={`ds-tab-btn ${activeTab === 'directory' ? 'active' : ''}`}
          onClick={() => { setActiveTab('directory'); setSearchParams({ tab: 'directory' }); }}
        >
          <Building size={14} />
          <span>Business Directory</span>
          <span className="ds-tab-count">{filteredVendors.length + filteredCustomers.length}</span>
        </button>

        <button
          className={`ds-tab-btn ${activeTab === 'ratesValuation' ? 'active' : ''}`}
          onClick={() => { setActiveTab('ratesValuation'); setSearchParams({ tab: 'ratesValuation' }); }}
        >
          <Tag size={14} />
          <span>Rates &amp; Valuation</span>
          <span className="ds-tab-count">{filteredRates.length + filteredValueMasters.length}</span>
        </button>

        <button
          className={`ds-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => { setActiveTab('settings'); setSearchParams({ tab: 'settings' }); }}
        >
          <ShieldCheck size={14} />
          <span>Plant &amp; System Settings</span>
        </button>

        {isAdmin && (
          <button
            className={`ds-tab-btn ${activeTab === 'rbac' ? 'active' : ''}`}
            onClick={() => { setActiveTab('rbac'); setSearchParams({ tab: 'rbac' }); }}
            style={{
              borderColor: activeTab === 'rbac' ? '#dc2626' : undefined,
              color: activeTab === 'rbac' ? '#dc2626' : undefined,
              fontWeight: 700
            }}
          >
            <Shield size={14} style={{ color: '#dc2626' }} />
            <span>User Roles &amp; RBAC</span>
            <span className="ds-tab-count" style={{ background: '#fee2e2', color: '#dc2626' }}>{liveUsers.length}</span>
          </button>
        )}

        {isAdmin && (
          <button
            className={`ds-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => { setActiveTab('audit'); setSearchParams({ tab: 'audit' }); }}
            style={{
              borderColor: activeTab === 'audit' ? '#0284c7' : undefined,
              color: activeTab === 'audit' ? '#0284c7' : undefined,
              fontWeight: 700
            }}
          >
            <Activity size={14} style={{ color: '#0284c7' }} />
            <span>Security Audit Trail</span>
            <span className="ds-tab-count" style={{ background: '#e0f2fe', color: '#0284c7' }}>{liveAuditLogs.length}</span>
          </button>
        )}
      </div>

      {/* ── Business Directory Switcher ── */}
      {activeTab === 'directory' && (
        <div className="erp-subnav-pills" style={{ marginBottom: 18 }}>
          <button
            className={`erp-subnav-pill ${directorySubView === 'vendors' ? 'active' : ''}`}
            onClick={() => setDirectorySubView('vendors')}
          >
            <Building size={13} />
            <span>Suppliers &amp; Job Workers ({filteredVendors.length})</span>
          </button>
          <button
            className={`erp-subnav-pill ${directorySubView === 'customers' ? 'active' : ''}`}
            onClick={() => setDirectorySubView('customers')}
          >
            <Users size={13} />
            <span>Customers &amp; Buyers ({filteredCustomers.length})</span>
          </button>
        </div>
      )}

      {/* ── Rates & Valuation Switcher ── */}
      {activeTab === 'ratesValuation' && (
        <div className="erp-subnav-pills" style={{ marginBottom: 18 }}>
          <button
            className={`erp-subnav-pill ${pricingSubView === 'rates' ? 'active' : ''}`}
            onClick={() => setPricingSubView('rates')}
          >
            <Tag size={13} />
            <span>JW Rate Master (₹/KG)</span>
          </button>
          <button
            className={`erp-subnav-pill ${pricingSubView === 'value' ? 'active' : ''}`}
            onClick={() => setPricingSubView('value')}
          >
            <DollarSign size={13} />
            <span>JW Value Master (CGST Rule 55)</span>
          </button>
        </div>
      )}

      {/* ── Plant & System Settings Switcher ── */}
      {activeTab === 'settings' && (
        <div className="erp-subnav-pills" style={{ marginBottom: 18 }}>
          <button
            className={`erp-subnav-pill ${settingsSubView === 'tare' ? 'active' : ''}`}
            onClick={() => setSettingsSubView('tare')}
          >
            <Package size={13} />
            <span>Tare Standards &amp; Signatories</span>
          </button>
          <button
            className={`erp-subnav-pill ${settingsSubView === 'erp' ? 'active' : ''}`}
            onClick={() => setSettingsSubView('erp')}
          >
            <ShieldCheck size={13} />
            <span>Financial Year &amp; System Setup</span>
          </button>
        </div>
      )}

      {/* ── TAB 1: Processing Vendors ── */}
      {(activeTab === 'vendors' || (activeTab === 'directory' && directorySubView === 'vendors')) && (
        <>
          <div className="ds-filter-row">
            <div className="ds-search-wrap">
              <Search size={14} className="ds-search-icon" />
              <input
                type="text"
                placeholder="Search vendors by name, contact, city..."
                className="ds-search-input"
                value={vendorSearch}
                onChange={e => setVendorSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="ds-records-count">{filteredVendors.length} records</span>
              <button className="ds-btn-ghost" onClick={() => exportToCsv('Vendors_Directory.csv', filteredVendors)}>
                <Download size={13} /> Export CSV
              </button>
              <button className="ds-btn-primary" onClick={() => { setSelectedVendorToEdit(null); setShowAddVendorModal(true); }}>
                <Plus size={13} /> Add Vendor
              </button>
            </div>
          </div>

          <div className="ds-cards-grid">
            {filteredVendors.map(v => (
              <div key={v.id || v.name} className="ds-card">
                <div className="ds-card-header">
                  <div className="ds-card-title-group">
                    <h3 className="ds-card-name">{v.name}</h3>
                    <span className="ds-process-badge">{v.processBadge}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      title="Edit Vendor"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedVendorToEdit(v);
                        setShowAddVendorModal(true);
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    {v.id && (
                      <button
                        title="Delete Vendor"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteVendor(v);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <span className="ds-avatar-badge">{v.avatar}</span>
                  </div>
                </div>

                <div className="ds-card-info-list">
                  <div className="ds-info-item">
                    <Phone size={13} className="ds-info-icon" />
                    <span>{v.phone}</span>
                  </div>
                  <div className="ds-info-item">
                    <MapPin size={13} className="ds-info-icon" />
                    <span>{v.location}</span>
                  </div>
                  <div className="ds-gst-text">{v.gst}</div>
                </div>

                <div className="ds-card-footer">
                  <div className="ds-stat-col">
                    <span className="ds-stat-label">STANDARD RATE</span>
                    <span className="ds-stat-val">{v.rate}</span>
                  </div>
                  <div className="ds-stat-col" style={{ textAlign: 'right' }}>
                    <span className="ds-stat-label">PENDING OUTSIDE</span>
                    <span className={`ds-stat-val ${v.pendingOrange ? 'ds-val-orange' : ''}`}>
                      {v.pending}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TAB 2: Job Work Rate Master (Matching Excel 'JW Rate Master') ── */}
      {(activeTab === 'rateMaster' || (activeTab === 'ratesValuation' && pricingSubView === 'rates')) && (
        <div className="jw-ledger-section">
          <div className="ds-filter-row" style={{ flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', whiteSpace: 'nowrap' }}>Party (Job Worker):</span>
              <select
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.82rem', fontWeight: 600, background: '#ffffff', color: '#0f172a' }}
                value={ratePartyFilter}
                onChange={e => setRatePartyFilter(e.target.value)}
              >
                <option value="ALL">All Parties ({displayVendors.length})</option>
                {displayVendors.map(v => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="ds-search-wrap" style={{ flex: 1, minWidth: '220px' }}>
              <Search size={14} className="ds-search-icon" />
              <input
                type="text"
                placeholder="Search by Process, Item..."
                className="ds-search-input"
                value={rateSearch}
                onChange={e => setRateSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="ds-records-count">{filteredRates.length} rates</span>
              <button className="ds-btn-ghost" onClick={() => exportToCsv('JW_Rate_Master.csv', filteredRates)}>
                <Download size={13} /> Export CSV
              </button>
              <button className="ds-btn-primary" onClick={() => {
                setSelectedRateToEdit(null);
                setNewRateForm({
                  party: displayVendors[0]?.name || 'GALAXY.ENTERPRISE',
                  process: liveProcesses[0]?.processName || '',
                  item: 'ANCHOR YARN ^ YARN HANK',
                  uom: 'Kgs',
                  rate: '17.50',
                  date: new Date().toISOString().split('T')[0]
                });
                setShowAddRateModal(true);
              }}>
                <Plus size={13} /> Add Rate Contract
              </button>
            </div>
          </div>

          <div className="jw-table-container" style={{ marginTop: '12px' }}>
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th>PARTY NAME</th>
                  <th>PROCESS</th>
                  <th>ITEM NAME</th>
                  <th>UOM</th>
                  <th>DATE</th>
                  <th>RATE</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredRates.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      No rate contracts found in database. Click <strong>"+ Add Rate Contract"</strong> above to create one.
                    </td>
                  </tr>
                ) : (
                  filteredRates.map((r, idx) => (
                    <tr key={r.id || idx}>
                      <td className="td-party" style={{ fontWeight: 'bold' }}>{r.party}</td>
                      <td className="td-material-col" style={{ color: '#ea580c', fontWeight: 'bold' }}>{r.process}</td>
                      <td className="td-material-col">{r.item}</td>
                      <td className="td-qty">{r.uom || 'Kgs'}</td>
                      <td className="td-date">{r.date}</td>
                      <td className="td-charges" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                        ₹{Number(r.rate).toFixed(2)} / {r.uom || 'Kg'}
                      </td>
                      <td className="td-status">
                        <span className="badge-green-sm">{r.status || 'Active Contract'}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            title="Edit Rate Contract"
                            style={{
                              background: 'transparent',
                              border: '1px solid #cbd5e1',
                              color: '#475569',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            onClick={() => {
                              setSelectedRateToEdit(r);
                              setNewRateForm({
                                party: r.party || '',
                                process: r.process || '',
                                item: r.item || '',
                                rate: String(r.rate !== undefined ? r.rate : '17.50'),
                                uom: r.uom || 'Kgs',
                                date: r.date || new Date().toISOString().split('T')[0]
                              });
                              setShowAddRateModal(true);
                            }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          {r.id && (
                            <button
                              title="Delete Rate Contract"
                              style={{
                                background: 'transparent',
                                border: '1px solid #fecaca',
                                color: '#dc2626',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '0.75rem',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                              onClick={() => handleDeleteRate(r)}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: Job Work Value Master (Sheet: JW Value Master) ── */}
      {(activeTab === 'valueMaster' || (activeTab === 'ratesValuation' && pricingSubView === 'value')) && (
        <div className="jw-ledger-section">
          <div className="ds-filter-row">
            <div className="ds-search-wrap">
              <Search size={14} className="ds-search-icon" />
              <input
                type="text"
                placeholder="Search by Code, Item Description..."
                className="ds-search-input"
                value={valueSearch}
                onChange={e => setValueSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="ds-records-count">{filteredValueMasters.length} valuation entries</span>
              <button className="ds-btn-ghost" onClick={() => exportToCsv('JW_Value_Master.csv', filteredValueMasters)}>
                <Download size={13} /> Export CSV
              </button>
              <button className="ds-btn-primary" onClick={() => { setSelectedValueToEdit(null); setShowAddValueModal(true); }}>
                <Plus size={13} /> Add Valuation Entry
              </button>
            </div>
          </div>

          <div className="jw-table-container" style={{ marginTop: '12px' }}>
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th>CODE</th>
                  <th>DATE</th>
                  <th>ITEM DESCRIPTION</th>
                  <th>VALUE</th>
                  <th style={{ textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredValueMasters.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      No JW Value Master records found. Click <strong>"+ Add Valuation Entry"</strong> above to register one.
                    </td>
                  </tr>
                ) : (
                  filteredValueMasters.map((v, idx) => (
                    <tr key={v.id || idx}>
                      <td className="td-party" style={{ fontWeight: 'bold', color: '#ea580c' }}>{v.code}</td>
                      <td className="td-date">{v.date}</td>
                      <td className="td-material-col" style={{ fontWeight: '600' }}>{v.itemDescription}</td>
                      <td className="td-charges" style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#059669' }}>
                        ₹{Number(v.value || 0).toFixed(2)} / Kg
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <button
                            title="Edit Valuation Entry"
                            style={{
                              background: 'transparent',
                              border: '1px solid #cbd5e1',
                              color: '#475569',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                            onClick={() => {
                              setSelectedValueToEdit(v);
                              setShowAddValueModal(true);
                            }}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            title="Delete Valuation Entry"
                            onClick={() => handleDeleteValueMaster(v)}
                            style={{
                              background: 'transparent',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Misc Master & Packaging Tare Standards ── */}
      {/* ── TAB 3: Misc Master & Packaging Tare Standards (Sheet: Misc Master) ── */}
      {(activeTab === 'miscMaster' || (activeTab === 'settings' && settingsSubView === 'tare')) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {/* Packaging Tare Standards Card */}
          <div className="ds-settings-card">
            <div className="ds-card-header-inner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} style={{ color: '#ea580c' }} />
                <h2 className="ds-card-title">Packaging Tare Weight Standards</h2>
              </div>
              <p className="ds-card-subtitle">Default tare deducted on gross scale weights (Sheet: Misc Master)</p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await updateTareStandards(tareStandards);
                  alert('Packaging Tare Standards updated and saved to database successfully!');
                } catch (err) {
                  console.error('Error saving tare standards:', err);
                  alert('Failed to save tare standards.');
                }
              }}
              style={{ marginTop: '12px' }}
            >
              <div style={{ display: 'grid', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: '800', color: '#0f172a', marginBottom: '2px' }}>
                      WOVEN BAG
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Polymer woven bags (Bora)</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={tareStandards.bora}
                      onChange={e => setTareStandards({ ...tareStandards, bora: parseFloat(e.target.value) || 0 })}
                      style={{ width: '85px', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold', textAlign: 'right', color: '#0f172a', background: '#ffffff' }}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>KG</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: '800', color: '#0f172a', marginBottom: '2px' }}>
                      PLASTIC CONE
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Yarn / monofilament winding cones</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={tareStandards.plasticCone}
                      onChange={e => setTareStandards({ ...tareStandards, plasticCone: parseFloat(e.target.value) || 0 })}
                      style={{ width: '85px', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold', textAlign: 'right', color: '#0f172a', background: '#ffffff' }}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>KG</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: '800', color: '#0f172a', marginBottom: '2px' }}>
                      PAPER BAG
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Secondary pack paper bags (Khali Bag)</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={tareStandards.khaliBag}
                      onChange={e => setTareStandards({ ...tareStandards, khaliBag: parseFloat(e.target.value) || 0 })}
                      style={{ width: '85px', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold', textAlign: 'right', color: '#0f172a', background: '#ffffff' }}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>KG</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: '800', color: '#0f172a', marginBottom: '2px' }}>
                      LD BAG
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>LDPE sleeves, liners &amp; bags (Theli)</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={tareStandards.theli}
                      onChange={e => setTareStandards({ ...tareStandards, theli: parseFloat(e.target.value) || 0 })}
                      style={{ width: '85px', padding: '5px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontWeight: 'bold', textAlign: 'right', color: '#0f172a', background: '#ffffff' }}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#64748b' }}>KG</span>
                  </div>
                </div>

                {/* Tare / Weight Variance Alert Threshold */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff7ed', padding: '10px 14px', borderRadius: '6px', border: '1px solid #fed7aa' }}>
                  <div>
                    <div style={{ fontSize: '0.86rem', fontWeight: '800', color: '#9a3412', marginBottom: '2px' }}>
                      GRN TARE VARIANCE ALERT THRESHOLD
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#c2410c' }}>Trigger alert banner in GRN if tare variance exceeds this limit</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={tareStandards.varianceAllowanceKg !== undefined ? tareStandards.varianceAllowanceKg : 50}
                      onChange={e => setTareStandards({ ...tareStandards, varianceAllowanceKg: parseFloat(e.target.value) || 0 })}
                      style={{ width: '85px', padding: '5px 8px', borderRadius: '4px', border: '1px solid #fdba74', fontWeight: 'bold', textAlign: 'right', color: '#9a3412', background: '#ffffff' }}
                    />
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#c2410c' }}>KG</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  marginTop: '12px',
                  background: '#0f172a',
                  color: '#ffffff',
                  border: 'none',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Save Tare Standards
              </button>
            </form>
          </div>

          {/* Authorized Personnel & Supervisors Card */}
          <div className="ds-settings-card">
            <div className="ds-card-header-inner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: '#2563eb' }} />
                <h2 className="ds-card-title">Authorized Personnel &amp; Supervisors</h2>
              </div>
              <p className="ds-card-subtitle">Dispatch issuers and inward QA signatories (Sheet: Misc Master)</p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {personnelList.map((p, idx) => (
                <span
                  key={idx}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    padding: '5px 10px',
                    borderRadius: '20px',
                    fontSize: '0.78rem',
                    fontWeight: 'bold',
                    color: '#1e293b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  👤 {p}
                  {personnelList.length > 1 && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await deletePersonnel(p);
                        } catch (err) {
                          console.error('Error deleting signatory:', err);
                        }
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 0,
                        marginLeft: '2px',
                        fontSize: '0.75rem',
                        lineHeight: 1
                      }}
                      title="Remove Signatory"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>

            {/* Add New Personnel Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const trimmed = newPersonName.trim().toUpperCase();
                if (!trimmed) return;
                if (personnelList.includes(trimmed)) {
                  alert('Person already registered in directory.');
                  return;
                }
                try {
                  await addPersonnel(trimmed);
                  setNewPersonName('');
                } catch (err) {
                  console.error('Error adding signatory:', err);
                  alert('Failed to add signatory to database.');
                }
              }}
              style={{ marginTop: '16px', display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                placeholder="Enter person name (e.g. RAJESHBHAI)..."
                value={newPersonName}
                onChange={e => setNewPersonName(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.8rem'
                }}
              />
              <button
                type="submit"
                style={{
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                + Add Signatory
              </button>
            </form>
          </div>


        </div>
      )}

      {/* ── TAB 4: Customers ── */}
      {(activeTab === 'customers' || (activeTab === 'directory' && directorySubView === 'customers')) && (
        <>
          <div className="ds-filter-row">
            <div className="ds-search-wrap">
              <Search size={14} className="ds-search-icon" />
              <input
                type="text"
                placeholder="Search customers by company, GSTIN..."
                className="ds-search-input"
                value={customerSearch}
                onChange={e => setCustomerSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="ds-records-count">{filteredCustomers.length} records</span>
              <button className="ds-btn-ghost" onClick={() => exportToCsv('Customers_Directory.csv', filteredCustomers)}>
                <Download size={13} /> Export CSV
              </button>
              <button className="ds-btn-primary" onClick={() => { setSelectedCustomerToEdit(null); setShowAddCustomerModal(true); }}>
                <Plus size={13} /> Add Customer
              </button>
            </div>
          </div>

          <div className="ds-cards-grid">
            {filteredCustomers.map(c => (
              <div key={c.id || c.name} className="ds-card">
                <div className="ds-card-header">
                  <div className="ds-card-title-group">
                    <h3 className="ds-card-name">{c.name}</h3>
                    <span className="ds-term-badge">{c.termsBadge}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      title="Edit Customer"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCustomerToEdit(c);
                        setShowAddCustomerModal(true);
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    {c.id && (
                      <button
                        title="Delete Customer"
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomer(c);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <span className="ds-avatar-badge">{c.avatar}</span>
                  </div>
                </div>

                <div className="ds-card-info-list">
                  <div className="ds-info-item" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Phone size={13} className="ds-info-icon" />
                      <span>{c.phone ? (c.phone.startsWith('+') ? c.phone : `+91 ${c.phone}`) : 'No phone'}</span>
                    </div>
                    {c.isPhoneVerified && (
                      <span 
                        title="SMS OTP Verified via MSG91"
                        style={{
                          fontSize: '0.68rem',
                          background: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                          padding: '1px 6px',
                          borderRadius: 9999,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3
                        }}
                      >
                        <CheckCircle2 size={10} /> Verified
                      </span>
                    )}
                  </div>

                  {c.whatsapp && (
                    <div className="ds-info-item">
                      <MessageSquare size={13} color="#16a34a" style={{ flexShrink: 0 }} />
                      <span>WA: +91 {c.whatsapp.replace(/\D/g, '').slice(-10)}</span>
                      {c.isWhatsappVerified && (
                        <span 
                          title="WhatsApp Number Verified"
                          style={{
                            fontSize: '0.65rem',
                            background: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                            padding: '1px 5px',
                            borderRadius: 9999,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            marginLeft: 4
                          }}
                        >
                          <CheckCircle2 size={9} /> Verified
                        </span>
                      )}
                      <a
                        href={`https://wa.me/91${c.whatsapp.replace(/\D/g, '').slice(-10)}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Chat with Customer on WhatsApp"
                        style={{
                          fontSize: '0.7rem',
                          color: '#16a34a',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          padding: '1px 7px',
                          borderRadius: 4,
                          marginLeft: 'auto',
                          textDecoration: 'none',
                          fontWeight: 500
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        Chat
                      </a>
                    </div>
                  )}

                  <div className="ds-info-item">
                    <MapPin size={13} className="ds-info-icon" />
                    <span>{c.location}</span>
                  </div>
                  <div className="ds-gst-text">{c.gst}</div>
                </div>

                <div className="ds-card-footer">
                  <div className="ds-stat-col">
                    <span className="ds-stat-label">TOTAL ORDERS</span>
                    <span className="ds-stat-val">{c.orders}</span>
                  </div>
                  <div className="ds-stat-col" style={{ textAlign: 'right' }}>
                    <span className="ds-stat-label">BOOKED BUSINESS</span>
                    <span className="ds-stat-val ds-val-blue">{c.booked}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── TAB 5: ERP Settings ── */}
      {(activeTab === 'settings' && settingsSubView === 'erp') && (
        <div className="ds-settings-grid">
          <div className="ds-settings-card">
            <div className="ds-card-header-inner">
              <h2 className="ds-card-title">Company &amp; Plant Profile</h2>
              <p className="ds-card-subtitle">
                Statutory details printed on Delivery Challans, Job Work Outward notes, and GST Tax Invoices.
              </p>
            </div>

            <form className="ds-form-grid" onSubmit={handleSaveProfile}>
              <div className="ds-form-field">
                <label className="ds-form-label">Company Legal Name</label>
                <input
                  type="text"
                  className="ds-form-input"
                  value={companyProfile.legalName}
                  onChange={e => setCompanyProfile({ ...companyProfile, legalName: e.target.value })}
                />
              </div>

              <div className="ds-form-row">
                <div className="ds-form-field">
                  <label className="ds-form-label">GSTIN Number</label>
                  <input
                    type="text"
                    className="ds-form-input"
                    value={companyProfile.gstin}
                    onChange={e => setCompanyProfile({ ...companyProfile, gstin: e.target.value })}
                  />
                </div>
                <div className="ds-form-field">
                  <label className="ds-form-label">Contact Phone</label>
                  <input
                    type="text"
                    className="ds-form-input"
                    value={companyProfile.phone}
                    onChange={e => setCompanyProfile({ ...companyProfile, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="ds-form-field">
                <label className="ds-form-label">Factory Location &amp; Address</label>
                <input
                  type="text"
                  className="ds-form-input"
                  value={companyProfile.address}
                  onChange={e => setCompanyProfile({ ...companyProfile, address: e.target.value })}
                />
              </div>

              <div className="ds-form-row">
                <div className="ds-form-field">
                  <label className="ds-form-label">Job Work Prefix</label>
                  <input
                    type="text"
                    className="ds-form-input"
                    value={companyProfile.jwPrefix}
                    onChange={e => setCompanyProfile({ ...companyProfile, jwPrefix: e.target.value })}
                  />
                </div>
                <div className="ds-form-field">
                  <label className="ds-form-label">Standard Wastage Allowance (%)</label>
                  <input
                    type="number"
                    className="ds-form-input"
                    value={companyProfile.wastageAllowance}
                    onChange={e => setCompanyProfile({ ...companyProfile, wastageAllowance: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="ds-btn-save">
                Save Configuration
              </button>
            </form>
          </div>


        </div>
      )}

      {/* ── TAB 8: Role-Based Access Control (RBAC) ── */}
      {activeTab === 'rbac' && isAdmin && (
        <>
          <div className="ds-filter-row">
            <div className="ds-search-wrap">
              <Search className="ds-search-icon" size={15} />
              <input
                type="text"
                placeholder="Search staff by name, email, or role..."
                className="ds-search-input"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
            <div className="ds-count-badge">
              {filteredUsers.length} Users Registered
            </div>
          </div>

          <div className="ds-table-card">
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th>User / Staff</th>
                    <th>Email Address</th>
                    <th>Assigned Role</th>
                    <th>Accessible Modules</th>
                    <th>Account Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                        No user accounts found matching &quot;{userSearch}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => {
                      const roleConfig = ROLE_COLORS[u.role || 'employee'] || ROLE_COLORS.employee;
                      const roleLabel = ROLE_LABELS[u.role || 'employee'] || 'Employee';
                      const userMods = u.role === 'admin' 
                        ? ERP_MODULES.map(m => m.id)
                        : (Array.isArray(u.assignedModules) ? u.assignedModules : (ROLE_DEFAULT_MODULES[u.role || 'employee'] || []));

                      return (
                        <tr key={u.uid || u.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '50%',
                                background: roleConfig.bg,
                                color: roleConfig.text,
                                border: `1px solid ${roleConfig.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.8rem'
                              }}>
                                {(u.displayName || u.email || 'U').slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.875rem' }}>
                                  {u.displayName || 'Unnamed User'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                  UID: {(u.uid || u.id || '').slice(0, 8)}...
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.8125rem', color: '#334155' }}>
                            {u.email || '-'}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: roleConfig.bg,
                              color: roleConfig.text,
                              border: `1px solid ${roleConfig.border}`
                            }}>
                              <Shield size={11} />
                              {roleLabel}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '380px' }}>
                              {ERP_MODULES.map(m => {
                                const isPermitted = userMods.includes(m.id);
                                return (
                                  <span
                                    key={m.id}
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 500,
                                      background: isPermitted ? '#ecfdf5' : '#f1f5f9',
                                      color: isPermitted ? '#047857' : '#94a3b8',
                                      border: isPermitted ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                                      opacity: isPermitted ? 1 : 0.65
                                    }}
                                  >
                                    {isPermitted ? '✓ ' : '✕ '} {m.name}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                          <td>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              background: u.status === 'DISABLED' ? '#fee2e2' : '#dcfce7',
                              color: u.status === 'DISABLED' ? '#b91c1c' : '#15803d'
                            }}>
                              {u.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenRbacModal(u)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '6px 12px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                color: '#1e293b',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              onMouseOver={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                              onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; }}
                            >
                              <Shield size={13} style={{ color: '#0284c7' }} />
                              Assign Modules
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── TAB 9: Audit Trail (Admin Only) ── */}
      {activeTab === 'audit' && isAdmin && (
        <>
          <div className="ds-filter-row" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            <div className="ds-search-wrap" style={{ flex: '1 1 280px' }}>
              <Search className="ds-search-icon" size={15} />
              <input
                type="text"
                placeholder="Search audit trail by user, action, target, or keywords..."
                className="ds-search-input"
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`ds-filter-toggle-btn ${showAuditFilterPanel || auditCategoryFilter !== 'ALL' ? 'active' : ''}`}
                onClick={() => setShowAuditFilterPanel(!showAuditFilterPanel)}
                title="Toggle Category Filters"
              >
                <Filter size={14} />
                <span>Filters</span>
                {auditCategoryFilter !== 'ALL' && <span className="ds-filter-count-badge">1</span>}
              </button>

              <button
                type="button"
                className="ds-btn-export"
                onClick={() => {
                  const exportRows = filteredAuditLogs.map(l => ({
                    'Date & Time': l.timestamp ? new Date(l.timestamp).toLocaleString('en-IN') : '-',
                    'User Name': l.user?.name || 'System',
                    'User Email': l.user?.email || '-',
                    'User Role': l.user?.role || '-',
                    'Category': l.category || '-',
                    'Action Code': l.action || '-',
                    'Target ID': l.targetId || '-',
                    'Summary': l.summary || '-'
                  }));
                  exportToCsv('Kamani_ERP_Audit_Trail.csv', exportRows);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer'
                }}
              >
                <Download size={14} />
                Export Audit Log
              </button>
            </div>
          </div>

          {/* Category Filter Panel - Only visible when Filter button is clicked */}
          {showAuditFilterPanel && (
            <div className="ds-expanded-filters-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Filter by Audit Category
                </span>
                {auditCategoryFilter !== 'ALL' && (
                  <button
                    type="button"
                    className="ds-btn-reset-filters"
                    onClick={() => setAuditCategoryFilter('ALL')}
                    style={{ height: '28px', padding: '2px 8px', fontSize: '0.72rem' }}
                  >
                    Reset Filter
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingBottom: '4px' }}>
            {['ALL', 'SECURITY', 'QUALITY_CONTROL', 'INVENTORY', 'JOB_WORK', 'SALES', 'MASTER_DATA'].map(cat => {
              const count = cat === 'ALL' 
                ? liveAuditLogs.length 
                : liveAuditLogs.filter(l => l.category === cat).length;
              const catCfg = cat === 'ALL' 
                ? { label: 'All Events', color: '#0f172a', bg: '#f1f5f9', border: '#cbd5e1' }
                : (AUDIT_CATEGORIES[cat] || { label: cat, color: '#475569', bg: '#f8fafc', border: '#e2e8f0' });
              const isActive = auditCategoryFilter === cat;

              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setAuditCategoryFilter(cat)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '9999px',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    border: isActive ? `2px solid ${catCfg.color}` : `1px solid ${catCfg.border}`,
                    background: isActive ? catCfg.bg : '#ffffff',
                    color: catCfg.color,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {catCfg.label}
                  <span style={{
                    background: isActive ? catCfg.color : '#e2e8f0',
                    color: isActive ? '#ffffff' : '#475569',
                    borderRadius: '9999px',
                    padding: '0 5px',
                    fontSize: '0.675rem'
                  }}>
                    {count}
                  </span>
                </button>
              );
            })}
              </div>
            </div>
          )}

          <div className="ds-table-card">
            <div className="ds-table-wrap">
              <table className="ds-table">
                <thead>
                  <tr>
                    <th style={{ width: '150px', minWidth: '140px' }}>Timestamp</th>
                    <th style={{ minWidth: '180px' }}>User / Operator</th>
                    <th style={{ minWidth: '150px' }}>Category</th>
                    <th style={{ minWidth: '160px' }}>Action</th>
                    <th style={{ minWidth: '130px' }}>Target Record</th>
                    <th style={{ minWidth: '340px' }}>Event Summary</th>
                    <th style={{ textAlign: 'right', width: '100px', minWidth: '100px' }}>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '50px 20px', color: '#64748b' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                          <Activity size={32} style={{ color: '#cbd5e1' }} />
                          <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#334155' }}>
                            No audit trail events found
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            {auditSearch ? `No events match "${auditSearch}"` : 'Audit trail is active and capturing all user actions automatically.'}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map(log => {
                      const catConfig = AUDIT_CATEGORIES[log.category] || AUDIT_CATEGORIES.MASTER_DATA;
                      const logDate = log.timestamp ? new Date(log.timestamp) : new Date();
                      const dateStr = logDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                      const timeStr = logDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                      const userInitial = (log.user?.name || log.user?.email || 'U').slice(0, 2).toUpperCase();

                      return (
                        <tr key={log.id}>
                          <td style={{ minWidth: '140px' }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
                              {dateStr}
                            </div>
                            <div style={{ fontSize: '0.725rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Clock size={11} /> {timeStr}
                            </div>
                          </td>
                          <td style={{ minWidth: '180px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{
                                width: '30px',
                                height: '30px',
                                borderRadius: '50%',
                                background: '#f1f5f9',
                                color: '#1e293b',
                                border: '1px solid #cbd5e1',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.75rem'
                              }}>
                                {userInitial}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.825rem' }}>
                                  {log.user?.name || 'System User'}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                  {log.user?.role ? log.user.role.toUpperCase() : 'USER'} • {log.user?.email || ''}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ minWidth: '150px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '0.725rem',
                              fontWeight: 600,
                              background: catConfig.bg,
                              color: catConfig.color,
                              border: `1px solid ${catConfig.border}`
                            }}>
                              {catConfig.label}
                            </span>
                          </td>
                          <td style={{ minWidth: '160px' }}>
                            <span style={{
                              fontFamily: 'monospace',
                              fontSize: '0.725rem',
                              fontWeight: 700,
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              color: '#334155'
                            }}>
                              {log.action || 'ACTION'}
                            </span>
                          </td>
                          <td style={{ minWidth: '130px' }}>
                            <span style={{
                              fontWeight: 600,
                              fontSize: '0.775rem',
                              color: '#0369a1',
                              background: '#f0f9ff',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              border: '1px solid #bae6fd',
                              display: 'inline-block'
                            }}>
                              {log.targetId || '-'}
                            </span>
                          </td>
                          <td style={{
                            fontSize: '0.8125rem',
                            color: '#1e293b',
                            minWidth: '340px',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            lineHeight: 1.45
                          }}>
                            {log.summary || '-'}
                          </td>
                          <td style={{ textAlign: 'right', width: '100px', minWidth: '100px', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedAuditDetail(log)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '5px 12px',
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: '#1e293b',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              onMouseOver={e => { e.currentTarget.style.background = '#e2e8f0'; }}
                              onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; }}
                              title="Inspect payload"
                            >
                              <Eye size={12} style={{ color: '#0284c7' }} />
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Audit Event Detail Drawer / Modal ── */}
      {selectedAuditDetail && (
        <div
          className="modal-overlay"
          onClick={e => e.target === e.currentTarget && setSelectedAuditDetail(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px'
          }}
        >
          <div
            className="modal-dialog"
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '640px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
              overflow: 'hidden'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#f8fafc'
            }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Audit Event Details
                </h2>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
                  Log ID: {selectedAuditDetail.id}
                </p>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedAuditDetail(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Timestamp</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {selectedAuditDetail.timestamp ? new Date(selectedAuditDetail.timestamp).toLocaleString('en-IN') : '-'}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Operator</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                    {selectedAuditDetail.user?.name || 'System'} ({selectedAuditDetail.user?.role || 'user'})
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{selectedAuditDetail.user?.email}</div>
                </div>

                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Action Code</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#2563eb', fontFamily: 'monospace', marginTop: '2px' }}>
                    {selectedAuditDetail.action}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Target ID</div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0369a1', marginTop: '2px' }}>
                    {selectedAuditDetail.targetId || '-'}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                  Summary
                </div>
                <div style={{ background: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', fontSize: '0.85rem', color: '#0f172a', fontWeight: 500 }}>
                  {selectedAuditDetail.summary}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                    Event Payload / Metadata
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedAuditDetail, null, 2));
                      setCopiedAuditJson(true);
                      setTimeout(() => setCopiedAuditJson(false), 2000);
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '2px 8px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '4px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    <Copy size={11} />
                    {copiedAuditJson ? 'Copied!' : 'Copy JSON'}
                  </button>
                </div>
                <pre style={{
                  background: '#0f172a',
                  color: '#e2e8f0',
                  padding: '12px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  overflowX: 'auto',
                  margin: 0,
                  fontFamily: 'monospace',
                  maxHeight: '220px'
                }}>
                  {JSON.stringify(selectedAuditDetail.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
              <button
                type="button"
                onClick={() => setSelectedAuditDetail(null)}
                style={{
                  padding: '6px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RBAC Module Assignment Modal ── */}
      {selectedUserForRbac && (
        <div 
          className="modal-overlay" 
          onClick={e => e.target === e.currentTarget && setSelectedUserForRbac(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            className="modal-dialog"
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden'
            }}
          >
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                background: '#f8fafc'
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Assign User Role &amp; Module Access
                </h2>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '2px 0 0' }}>
                  Configure role and module permissions for {selectedUserForRbac.displayName || selectedUserForRbac.email}
                </p>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setSelectedUserForRbac(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRbac} style={{ padding: '20px' }}>
              {/* User details snippet */}
              <div style={{
                background: '#f1f5f9',
                padding: '10px 14px',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.85rem' }}>
                    {selectedUserForRbac.displayName || 'No Name Set'}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                    {selectedUserForRbac.email}
                  </div>
                </div>
                <span style={{
                  padding: '3px 8px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '9999px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#475569'
                }}>
                  {selectedUserForRbac.uid?.slice(0, 10)}...
                </span>
              </div>

              {/* 1. Select Role */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                  1. Select Primary Role
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { id: 'admin', label: 'Admin', desc: 'Full System Access' },
                    { id: 'accountant', label: 'Accountant', desc: 'Finance & Operations' },
                    { id: 'employee', label: 'Employee', desc: 'Floor & Job Work' }
                  ].map(r => {
                    const isSelected = editRole === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleRoleChange(r.id)}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '10px',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left'
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isSelected ? '#1d4ed8' : '#1e293b' }}>
                          {r.label}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: isSelected ? '#3b82f6' : '#64748b', marginTop: '2px' }}>
                          {r.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {editRole === 'admin' && (
                  <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldAlert size={13} />
                    Admins automatically have access to all modules and configurations.
                  </p>
                )}
              </div>

              {/* 2. Assign Modules */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155', margin: 0 }}>
                    2. Permitted Modules ({editRole === 'admin' ? ERP_MODULES.length : editAssignedModules.length}/{ERP_MODULES.length})
                  </label>
                  {editRole !== 'admin' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => setEditAssignedModules(ERP_MODULES.map(m => m.id))}
                        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        Select All
                      </button>
                      <span style={{ color: '#cbd5e1' }}>|</span>
                      <button
                        type="button"
                        onClick={() => setEditAssignedModules([])}
                        style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                      >
                        Clear All
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {ERP_MODULES.map(m => {
                    const isChecked = editRole === 'admin' || editAssignedModules.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: isChecked ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                          background: isChecked ? '#f0f9ff' : '#f8fafc',
                          cursor: editRole === 'admin' ? 'not-allowed' : 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input
                            type="checkbox"
                            disabled={editRole === 'admin'}
                            checked={isChecked}
                            onChange={() => handleToggleModule(m.id)}
                            style={{ cursor: editRole === 'admin' ? 'not-allowed' : 'pointer' }}
                          />
                          <div>
                            <div style={{ fontSize: '0.825rem', fontWeight: 600, color: '#0f172a' }}>
                              {m.name}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                              {m.description}
                            </div>
                          </div>
                        </div>

                        <span style={{
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          background: isChecked ? '#dcfce7' : '#fee2e2',
                          color: isChecked ? '#166534' : '#991b1b'
                        }}>
                          {isChecked ? 'Visible' : 'Hidden'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  className="mfooter-btn cancel"
                  onClick={() => setSelectedUserForRbac(null)}
                  disabled={isSavingRbac}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.8125rem'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRbac}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.8125rem'
                  }}
                >
                  {isSavingRbac ? 'Saving Changes...' : 'Save Permissions'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Local Modals */}
      {showAddVendorModal && (
        <AddVendorModal
          initialData={selectedVendorToEdit}
          vendor={selectedVendorToEdit}
          onClose={() => {
            setShowAddVendorModal(false);
            setSelectedVendorToEdit(null);
          }}
          onSave={handleSaveVendor}
        />
      )}
      {showAddCustomerModal && (
        <AddCustomerModal
          initialData={selectedCustomerToEdit}
          customer={selectedCustomerToEdit}
          onClose={() => {
            setShowAddCustomerModal(false);
            setSelectedCustomerToEdit(null);
          }}
          onSave={handleSaveCustomer}
        />
      )}

      {/* Add / Edit Rate Modal */}
      {showAddRateModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && (setShowAddRateModal(false), setSelectedRateToEdit(null))}>
          <div className="modal-dialog modal-md">
            <div className="modal-header-dark">
              <div>
                <h2 className="modal-title">{selectedRateToEdit ? 'Edit Job Work Rate Contract' : 'Add Job Work Rate Contract'}</h2>
                <p className="modal-subtitle">
                  {selectedRateToEdit 
                    ? `Updating rate for ${newRateForm.party} (${newRateForm.process})` 
                    : 'Configure process processing rate per KG for vendor'}
                </p>
              </div>
              <button className="modal-close-btn" onClick={() => { setShowAddRateModal(false); setSelectedRateToEdit(null); }}>✕</button>
            </div>
            <form className="modal-body" onSubmit={handleSaveNewRate}>
              <div className="mform-field">
                <label className="mform-label">Party Name</label>
                <select className="mform-select" value={newRateForm.party} onChange={e => setNewRateForm({ ...newRateForm, party: e.target.value })}>
                  {displayVendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              <div className="mform-field">
                <label className="mform-label">Process</label>
                <select className="mform-select" value={newRateForm.process} onChange={e => setNewRateForm({ ...newRateForm, process: e.target.value })}>
                  {liveProcesses.map(proc => {
                    const pName = proc.processName || proc.name || proc;
                    return <option key={proc.id || pName} value={pName}>{pName}</option>;
                  })}
                </select>
              </div>
              <div className="mform-field">
                <label className="mform-label">Item Name</label>
                <input type="text" className="mform-input" value={newRateForm.item} onChange={e => setNewRateForm({ ...newRateForm, item: e.target.value })} required />
              </div>
              <div className="mform-row mform-col-3">
                <div className="mform-field">
                  <label className="mform-label">Rate</label>
                  <input type="number" step="0.01" className="mform-input" value={newRateForm.rate} onChange={e => setNewRateForm({ ...newRateForm, rate: e.target.value })} required />
                </div>
                <div className="mform-field">
                  <label className="mform-label">UOM</label>
                  <select className="mform-select" value={newRateForm.uom} onChange={e => setNewRateForm({ ...newRateForm, uom: e.target.value })}>
                    <option value="Kgs">Kgs</option>
                    <option value="Pieces">Pieces</option>
                    <option value="Coils">Coils</option>
                  </select>
                </div>
                <div className="mform-field">
                  <label className="mform-label">Date</label>
                  <input type="date" className="mform-input" value={newRateForm.date || new Date().toISOString().split('T')[0]} onChange={e => setNewRateForm({ ...newRateForm, date: e.target.value })} required />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '14px' }}>
                <button type="button" className="mfooter-btn cancel" onClick={() => { setShowAddRateModal(false); setSelectedRateToEdit(null); }}>Cancel</button>
                <button type="submit" className="mfooter-btn confirm">{selectedRateToEdit ? 'Update Rate Master' : 'Save Rate Master'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add / Edit JW Value Master Modal */}
      {showAddValueModal && (
        <JwValueMasterModal
          initialData={selectedValueToEdit}
          onClose={() => {
            setShowAddValueModal(false);
            setSelectedValueToEdit(null);
          }}
        />
      )}
    </div>
  );
}
