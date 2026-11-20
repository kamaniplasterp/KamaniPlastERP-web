import { useState, useEffect, useMemo, Fragment } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, Phone, MapPin, Building, RotateCcw, Save, CheckCircle2, FileText, Plus, Download,
  Layers, Package, Users, DollarSign, Tag, Calculator, ShieldCheck, MessageSquare,
  Shield, Check, X, Lock, Unlock, UserCheck, ShieldAlert, Activity, Eye, Copy, Filter, Clock,
  Edit2, Trash2, UserPlus, XCircle, User, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { 
  subscribeUsers, 
  updateUserAccess, 
  ERP_MODULES, 
  ERP_SUBMODULES,
  ROLE_DEFAULT_MODULES, 
  ROLE_DEFAULT_PERMISSIONS,
  ROLE_LABELS, 
  ROLE_COLORS 
} from '../api/rbac.api';
import {
  subscribeAllApprovals,
  subscribePendingApprovals,
  approveMasterChange,
  rejectMasterChange,
  submitMasterChangeRequest
} from '../api/approvals.api';
import ApprovalCenterModal from '../modals/ApprovalCenterModal';
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
import CreateUserModal from '../modals/CreateUserModal';
import HeaderInfoTooltip from '../components/HeaderInfoTooltip';
import PageHeader, { HeaderButton } from '../components/PageHeader';
import { showAlert, showConfirm } from '../context/CustomAlertContext';
import '../styles/DirectorySettings.css';

const formatApprovalTimestamp = (val, fallback = '') => {
  if (!val) return fallback;
  try {
    let dateObj = null;
    if (typeof val?.toDate === 'function') {
      dateObj = val.toDate();
    } else if (val instanceof Date) {
      dateObj = val;
    } else if (typeof val === 'object' && typeof val.seconds === 'number') {
      dateObj = new Date(val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0));
    } else if (typeof val === 'number') {
      dateObj = new Date(val);
    } else if (typeof val === 'string') {
      const parsed = new Date(val);
      if (!isNaN(parsed.getTime())) dateObj = parsed;
    }

    if (dateObj && !isNaN(dateObj.getTime())) {
      return dateObj.toLocaleString();
    }
    return String(val);
  } catch (err) {
    return fallback || String(val);
  }
};

export default function DirectorySettingsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin, user, userProfile, userRole, can } = useAuth();
  const [directorySubView, setDirectorySubView] = useState('vendors'); // 'vendors' | 'customers'
  const [pricingSubView, setPricingSubView] = useState('rates'); // 'rates' | 'value'
  const [settingsSubView, setSettingsSubView] = useState('tare'); // 'tare' | 'erp'

  const canAccessTab = (tabName) => {
    if (isAdmin) return true;
    if (!can) return true;
    switch (tabName) {
      case 'directory':
      case 'vendors':
      case 'customers':
        return can('directory_business', 'read');
      case 'ratesValuation':
      case 'rateMaster':
      case 'valueMaster':
        return can('directory_rates', 'read');
      case 'settings':
      case 'miscMaster':
        return can('directory_settings', 'read');
      case 'approvals':
        return isAdmin || can('directory_approvals', 'read');
      case 'rbac':
        return isAdmin || can('directory_rbac', 'read');
      case 'audit':
        return isAdmin || can('directory_audit', 'read');
      default:
        return true;
    }
  };

  const getFirstPermittedTab = () => {
    if (canAccessTab('directory')) return 'directory';
    if (canAccessTab('ratesValuation')) return 'ratesValuation';
    if (canAccessTab('settings')) return 'settings';
    if (canAccessTab('approvals')) return 'approvals';
    if (canAccessTab('rbac')) return 'rbac';
    if (canAccessTab('audit')) return 'audit';
    return 'directory';
  };

  const resolveDirTab = (tabParam) => {
    let resolved = 'directory';
    if (!tabParam) resolved = 'directory';
    else if (tabParam === 'vendors') { setDirectorySubView('vendors'); resolved = 'directory'; }
    else if (tabParam === 'customers') { setDirectorySubView('customers'); resolved = 'directory'; }
    else if (tabParam === 'directory') resolved = 'directory';
    else if (tabParam === 'rateMaster') { setPricingSubView('rates'); resolved = 'ratesValuation'; }
    else if (tabParam === 'valueMaster') { setPricingSubView('value'); resolved = 'ratesValuation'; }
    else if (tabParam === 'ratesValuation') resolved = 'ratesValuation';
    else if (tabParam === 'miscMaster') { setSettingsSubView('tare'); resolved = 'settings'; }
    else if (tabParam === 'settings') { setSettingsSubView('erp'); resolved = 'settings'; }
    else if (tabParam === 'approvals') resolved = 'approvals';
    else if (tabParam === 'rbac') resolved = 'rbac';
    else if (tabParam === 'audit') resolved = 'audit';

    if (!canAccessTab(resolved)) {
      return getFirstPermittedTab();
    }
    return resolved;
  };

  const [activeTab, setActiveTab] = useState(() => resolveDirTab(searchParams.get('tab')));
  const [vendorSearch, setVendorSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [rateSearch, setRateSearch] = useState('');
  const [ratePartyFilter, setRatePartyFilter] = useState('ALL');
  const [valueSearch, setValueSearch] = useState('');

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const targetTab = resolveDirTab(tabFromUrl);
    if (!canAccessTab(activeTab)) {
      setActiveTab(targetTab);
    } else if (tabFromUrl && resolveDirTab(tabFromUrl) !== activeTab) {
      setActiveTab(resolveDirTab(tabFromUrl));
    }
  }, [searchParams, can]);

  const [liveVendors, setLiveVendors] = useState([]);
  const [liveBuyers, setLiveBuyers] = useState([]);
  const [liveJobWorks, setLiveJobWorks] = useState([]);
  const [liveSalesOrders, setLiveSalesOrders] = useState([]);
  const [liveRates, setLiveRates] = useState([]);
  const [liveValueMasters, setLiveValueMasters] = useState([]);

  // RBAC User Permissions State
  const [liveUsers, setLiveUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  // Master Changes Approval Workflow State (Approvals Tab)
  const [allApprovals, setAllApprovals] = useState([]);
  const [approvalSubView, setApprovalSubView] = useState('pending'); // 'pending' | 'history'
  const [approvalSearch, setApprovalSearch] = useState('');
  const [approvalTypeFilter, setApprovalTypeFilter] = useState('ALL');
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('ALL');
  const [processingApprovalId, setProcessingApprovalId] = useState(null);
  const [rejectReasonMap, setRejectReasonMap] = useState({});
  const [showRejectInputMap, setShowRejectInputMap] = useState({});
  const [expandedApprovalMap, setExpandedApprovalMap] = useState({});
  const [selectedApprovalDetail, setSelectedApprovalDetail] = useState(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  const toggleExpandApproval = (id) => {
    setExpandedApprovalMap(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  useEffect(() => {
    const unsub = subscribeAllApprovals(setAllApprovals);
    return () => unsub();
  }, []);

  const pendingApprovalsList = useMemo(() => {
    return allApprovals.filter(a => a.status === 'PENDING');
  }, [allApprovals]);

  const historyApprovalsList = useMemo(() => {
    return allApprovals.filter(a => a.status !== 'PENDING');
  }, [allApprovals]);

  const currentApprovalsList = approvalSubView === 'pending' ? pendingApprovalsList : historyApprovalsList;

  const filteredApprovals = useMemo(() => {
    const q = approvalSearch.trim().toLowerCase();
    return currentApprovalsList.filter(item => {
      if (approvalTypeFilter !== 'ALL' && item.masterType !== approvalTypeFilter) {
        return false;
      }
      if (approvalSubView === 'history' && approvalStatusFilter !== 'ALL' && item.status !== approvalStatusFilter) {
        return false;
      }
      if (!q) return true;
      const matchTitle = (item.recordTitle || '').toLowerCase().includes(q);
      const matchLabel = (item.masterLabel || '').toLowerCase().includes(q);
      const matchSubmitter = (item.submittedBy?.displayName || item.submittedBy?.email || '').toLowerCase().includes(q);
      const matchAction = (item.action || '').toLowerCase().includes(q);
      const matchNotes = (item.reviewNotes || '').toLowerCase().includes(q);
      return matchTitle || matchLabel || matchSubmitter || matchAction || matchNotes;
    });
  }, [currentApprovalsList, approvalSearch, approvalTypeFilter, approvalStatusFilter, approvalSubView]);

  const handleApproveRequest = async (request) => {
    try {
      setProcessingApprovalId(request.id);
      await approveMasterChange(request, {
        uid: user?.uid,
        email: user?.email,
        displayName: userProfile?.displayName || user?.displayName || user?.email
      });
      await showAlert(`Approved change for "${request.recordTitle}". Master record updated.`, {
        type: 'success',
        title: 'Request Approved'
      });
    } catch (err) {
      console.error('Error approving change:', err);
      await showAlert(`Approval failed: ${err.message}`, { type: 'error', title: 'Error' });
    } finally {
      setProcessingApprovalId(null);
    }
  };

  const handleRejectRequest = async (request) => {
    const reason = rejectReasonMap[request.id] || '';
    try {
      setProcessingApprovalId(request.id);
      await rejectMasterChange(request.id, reason, {
        uid: user?.uid,
        email: user?.email,
        displayName: userProfile?.displayName || user?.displayName || user?.email
      });
      await showAlert(`Request for "${request.recordTitle}" has been rejected.`, {
        type: 'info',
        title: 'Request Rejected'
      });
      setShowRejectInputMap(prev => ({ ...prev, [request.id]: false }));
    } catch (err) {
      console.error('Error rejecting change:', err);
      await showAlert(`Rejection failed: ${err.message}`, { type: 'error', title: 'Error' });
    } finally {
      setProcessingApprovalId(null);
    }
  };

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
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  const [newRateForm, setNewRateForm] = useState({
    party: 'GALAXY.ENTERPRISE',
    process: '',
    item: 'ANCHOR YARN ^ YARN HANK',
    uom: 'Kgs',
    rate: '17.50',
    notes: '',
    date: new Date().toISOString().split('T')[0]
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

  const handleSaveVendor = async (data, existingId) => {
    const targetId = existingId || selectedVendorToEdit?.id;
    try {
      const cleanName = typeof data.name === 'object' && data.name ? (data.name.target?.value || data.name.value || '') : String(data.name || '').trim();
      const cleanBadge = typeof data.processBadge === 'object' && data.processBadge ? (data.processBadge.target?.value || data.processBadge.value || data.processBadge.label || '') : String(data.processBadge || '').trim();
      const cleanPhone = typeof data.phone === 'object' && data.phone ? (data.phone.target?.value || data.phone.value || '') : String(data.phone || '').trim();
      const cleanLocation = typeof data.location === 'object' && data.location ? (data.location.target?.value || data.location.value || '') : String(data.location || '').trim();
      const cleanGst = typeof data.gst === 'object' && data.gst ? (data.gst.target?.value || data.gst.value || '') : String(data.gst || '').trim();
      const cleanRate = Number(typeof data.rate === 'object' && data.rate ? data.rate.target?.value : data.rate) || 17.5;

      const vendorPayload = {
        name: cleanName,
        processBadge: cleanBadge,
        phone: cleanPhone,
        location: cleanLocation,
        gst: cleanGst,
        rate: cleanRate
      };

      if (!isAdmin) {
        await submitMasterChangeRequest({
          masterType: 'vendors',
          masterLabel: 'Vendor / Supplier',
          action: targetId ? 'UPDATE' : 'CREATE',
          recordId: targetId,
          recordTitle: cleanName,
          proposedData: vendorPayload,
          previousData: selectedVendorToEdit,
          submittedBy: { ...(userProfile || {}), ...(user || {}), role: userRole || 'staff', isAdmin }
        });
        await showAlert(`Change submitted! Administrator approval required before vendor "${cleanName}" takes effect.`, {
          type: 'info',
          title: 'Submitted for Approval'
        });
        setSelectedVendorToEdit(null);
        setShowAddVendorModal(false);
        return;
      }

      if (targetId) {
        await updateVendor(targetId, vendorPayload);
        await showAlert(`Vendor "${cleanName}" updated successfully!`, { type: 'success', title: 'Vendor Updated' });
      } else {
        await addVendor({
          ...vendorPayload,
          pendingKg: 0
        });
        await showAlert(`Vendor "${cleanName}" added successfully!\n✓ Godown location auto-created for "${cleanName}" for instant inventory tracking.`, { type: 'success', title: 'Vendor Registered' });
      }
      setSelectedVendorToEdit(null);
      setShowAddVendorModal(false);
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
      if (isAdmin) {
        await deleteVendor(v.id, v.name);
        await showAlert(`Vendor "${v.name}" deleted successfully!`, { type: 'success', title: 'Vendor Deleted' });
        return;
      }
      await submitMasterChangeRequest({
        masterType: 'vendors',
        masterLabel: 'Vendor / Supplier',
        action: 'DELETE',
        recordId: v.id,
        recordTitle: v.name,
        previousData: v,
        submittedBy: { ...(userProfile || {}), ...(user || {}), role: userRole || 'staff', isAdmin }
      });
      await showAlert(`Deletion request submitted! Administrator approval required to remove vendor "${v.name}".`, {
        type: 'info',
        title: 'Submitted for Approval'
      });
    } catch (err) {
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

      if (!isAdmin) {
        await submitMasterChangeRequest({
          masterType: 'customers',
          masterLabel: 'Customer / Buyer',
          action: targetId ? 'UPDATE' : 'CREATE',
          recordId: targetId,
          recordTitle: data.name,
          proposedData: payload,
          previousData: selectedCustomerToEdit,
          submittedBy: { ...(userProfile || {}), ...(user || {}), role: userRole || 'staff', isAdmin }
        });
        await showAlert(`Change submitted! Administrator approval required before customer "${data.name}" takes effect.`, {
          type: 'info',
          title: 'Submitted for Approval'
        });
        setSelectedCustomerToEdit(null);
        setShowAddCustomerModal(false);
        return;
      }

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
      setShowAddCustomerModal(false);
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
      if (isAdmin) {
        await deleteBuyer(c.id, c.name);
        await showAlert(`Customer "${c.name}" deleted successfully!`, { type: 'success', title: 'Customer Deleted' });
        return;
      }
      await submitMasterChangeRequest({
        masterType: 'customers',
        masterLabel: 'Customer / Buyer',
        action: 'DELETE',
        recordId: c.id,
        recordTitle: c.name,
        previousData: c,
        submittedBy: { ...(userProfile || {}), ...(user || {}), role: userRole || 'staff', isAdmin }
      });
      await showAlert(`Deletion request submitted! Administrator approval required to remove customer "${c.name}".`, {
        type: 'info',
        title: 'Submitted for Approval'
      });
    } catch (err) {
      await showAlert('Failed to delete customer: ' + err.message, { type: 'error' });
    }
  };

  const handleSaveNewRate = async (e) => {
    e.preventDefault();
    try {
      if (!isAdmin) {
        await submitMasterChangeRequest({
          masterType: 'jobWorkRates',
          masterLabel: 'Job Work Rate Contract',
          action: selectedRateToEdit?.id ? 'UPDATE' : 'CREATE',
          recordId: selectedRateToEdit?.id,
          recordTitle: `${newRateForm.party} (${newRateForm.process})`,
          proposedData: newRateForm,
          previousData: selectedRateToEdit,
          submittedBy: { ...(userProfile || {}), ...(user || {}), role: userRole || 'staff', isAdmin }
        });
        await showAlert(`Rate contract submitted for Administrator approval!`, {
          type: 'info',
          title: 'Submitted for Approval'
        });
        setShowAddRateModal(false);
        setSelectedRateToEdit(null);
        return;
      }

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
        if (isAdmin) {
          await deleteJobWorkRate(r.id, `${r.party} (${r.process})`);
          await showAlert(`Rate contract for "${r.party}" deleted successfully!`, { type: 'success', title: 'Rate Contract Deleted' });
          return;
        }
        await submitMasterChangeRequest({
          masterType: 'jobWorkRates',
          masterLabel: 'Job Work Rate Contract',
          action: 'DELETE',
          recordId: r.id,
          recordTitle: `${r.party} (${r.process})`,
          previousData: r,
          submittedBy: { ...(userProfile || {}), ...(user || {}), role: userRole || 'staff', isAdmin }
        });
        await showAlert(`Deletion request submitted for Administrator approval.`, {
          type: 'info',
          title: 'Submitted for Approval'
        });
      } catch (err) {
        await showAlert('Failed to delete rate contract: ' + err.message, { type: 'error' });
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
        if (isAdmin) {
          await deleteJwValueMaster(v.id);
          await showAlert(`Valuation standard "${v.code}" deleted successfully!`, { type: 'success', title: 'Valuation Deleted' });
          return;
        }
        await submitMasterChangeRequest({
          masterType: 'valueMasters',
          masterLabel: 'JW Valuation Standard',
          action: 'DELETE',
          recordId: v.id,
          recordTitle: v.code,
          previousData: v,
          submittedBy: { ...(userProfile || {}), ...(user || {}), role: userRole || 'staff', isAdmin }
        });
        await showAlert(`Deletion request submitted for Administrator approval.`, {
          type: 'info',
          title: 'Submitted for Approval'
        });
      } catch (err) {
        await showAlert('Failed to delete valuation standard: ' + err.message, { type: 'error' });
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
    const safeName = typeof v.name === 'object' && v.name ? (v.name.target?.value || v.name.value || 'Vendor') : String(v.name || 'Vendor');
    const safeBadge = typeof v.processBadge === 'object' && v.processBadge ? (v.processBadge.target?.value || v.processBadge.value || v.processBadge.label || 'Job Work Processor') : String(v.processBadge || 'Job Work Processor');
    const safePhone = typeof v.phone === 'object' && v.phone ? (v.phone.target?.value || v.phone.value || '-') : String(v.phone || '-');
    const safeLoc = typeof v.location === 'object' && v.location ? (v.location.target?.value || v.location.value || '-') : String(v.location || '-');
    const safeGst = typeof v.gst === 'object' && v.gst ? (v.gst.target?.value || v.gst.value || '') : String(v.gst || '');

    const matchingJw = liveJobWorks.filter(j => 
      j.vendorId === v.id || 
      j.vendor === safeName || 
      (j.vendor && typeof j.vendor === 'string' && j.vendor.toLowerCase().includes(safeName.toLowerCase()))
    );
    const pendingTotal = matchingJw.reduce((sum, j) => {
      const p = j.balQtyKg !== undefined ? Number(j.balQtyKg) : (j.balQty ? parseFloat(String(j.balQty).replace(/[^0-9.]/g, '')) : 0);
      return sum + (p || 0);
    }, 0);

    return {
      ...v,
      id: v.id,
      avatar: (safeName || 'VE').slice(0, 2).toUpperCase(),
      name: safeName,
      processBadge: safeBadge,
      phone: safePhone,
      location: safeLoc,
      gst: safeGst ? `GST: ${safeGst}` : 'GST: Not Provided',
      rate: typeof v.rate === 'number' ? `₹${v.rate}/KG` : (typeof v.rate === 'object' && v.rate ? `₹${v.rate.target?.value || 17.5}/KG` : String(v.rate || '-')),
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
    const safeBuyerName = typeof b.name === 'object' && b.name ? (b.name.target?.value || b.name.value || 'Customer') : String(b.name || 'Customer');
    const safeBuyerLoc = typeof b.location === 'object' && b.location ? (b.location.target?.value || b.location.value || '-') : String(b.location || '-');
    const safeTerms = typeof b.category === 'object' && b.category ? (b.category.target?.value || b.category.value || 'Wholesale Buyer') : String(b.category || b.paymentTerms || 'Wholesale Buyer');
    const safeBuyerPhone = typeof b.phone === 'object' && b.phone ? (b.phone.target?.value || b.phone.value || '') : String(b.phone || '');
    const safeBuyerGst = typeof b.gst === 'object' && b.gst ? (b.gst.target?.value || b.gst.value || '') : String(b.gst || '');

    const matchingOrders = liveSalesOrders.filter(so => 
      so.customerId === b.id || 
      so.customer === safeBuyerName || 
      (so.customer && typeof so.customer === 'string' && so.customer.toLowerCase().includes(safeBuyerName.toLowerCase())) ||
      (typeof so.customer === 'string' && safeBuyerName.toLowerCase().includes(so.customer.toLowerCase()))
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
      avatar: (safeBuyerName || 'CU').slice(0, 2).toUpperCase(),
      name: safeBuyerName,
      termsBadge: safeTerms,
      phone: safeBuyerPhone,
      whatsapp: b.whatsapp || safeBuyerPhone || '',
      isPhoneVerified: !!b.isPhoneVerified,
      isWhatsappVerified: !!(b.isWhatsappVerified || (b.isPhoneVerified && !b.isWhatsAppDifferent)),
      contactPerson: b.contactPerson || '',
      location: safeBuyerLoc,
      gst: safeBuyerGst ? `GST: ${safeBuyerGst}` : 'GST: Not Provided',
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

  let dirTitle = 'Business Directory';
  let dirTooltip = 'Maintain verified suppliers, job work processors, wholesale customers, and contact directories.';
  let dirBadge = `${filteredVendors.length + filteredCustomers.length} Parties`;
  let dirCrumbs = [
    { label: 'Directory & Admin', route: '/directory' },
    { label: 'Business Directory' }
  ];

  if (activeTab === 'ratesValuation') {
    const subLabel = pricingSubView === 'value' ? 'Valuation Master' : 'Job Work Rates Master';
    dirTitle = subLabel;
    dirTooltip = 'Standardized unit processing rates per job worker and statutory customs valuation standards.';
    dirBadge = `${filteredRates.length + filteredValueMasters.length} Contracts`;
    dirCrumbs = [
      { label: 'Directory & Admin', route: '/directory' },
      { label: 'Rates & Valuation', route: '/directory?tab=ratesValuation' },
      { label: subLabel }
    ];
  } else if (activeTab === 'settings') {
    dirTitle = 'Plant & System Settings';
    dirTooltip = 'Configure factory company letterhead profile, GSTIN, default tare bag standards, and signatories.';
    dirBadge = null;
    dirCrumbs = [
      { label: 'Directory & Admin', route: '/directory' },
      { label: 'Plant & System Settings' }
    ];
  } else if (activeTab === 'rbac') {
    dirTitle = 'User Roles & RBAC Access';
    dirTooltip = 'Granular role-based access control, operator module permissions, and active credential status.';
    dirBadge = `${liveUsers.length} Users`;
    dirCrumbs = [
      { label: 'Directory & Admin', route: '/directory' },
      { label: 'User Roles & RBAC' }
    ];
  } else if (activeTab === 'approvals') {
    dirTitle = 'Master Data Approvals';
    dirTooltip = 'Review, approve, or reject master records, rates, and settings change requests submitted by staff members.';
    dirBadge = `${pendingApprovalsList.length} Pending`;
    dirCrumbs = [
      { label: 'Directory & Admin', route: '/directory' },
      { label: 'Approvals Queue' }
    ];
  } else if (activeTab === 'audit') {
    dirTitle = 'Security Audit Logs';
    dirTooltip = 'Perpetual immutable audit log of administrative actions, user logins, and data modifications.';
    dirBadge = `${liveAuditLogs.length} Events`;
    dirCrumbs = [
      { label: 'Directory & Admin', route: '/directory' },
      { label: 'Security Audit Logs' }
    ];
  }

  // Dynamic filter categories for Approvals
  const approvalFilterCategories = useMemo(() => [
    {
      id: 'type',
      label: 'Master Category',
      icon: Layers,
      allLabel: 'All Master Records',
      options: [
        { value: 'ALL', label: 'All Master Records' },
        { value: 'vendors', label: 'Suppliers & Contractors' },
        { value: 'customers', label: 'Customers & Buyers' },
        { value: 'jobWorkRates', label: 'JW Rate Master' },
        { value: 'valueMasters', label: 'JW Value Master' },
        { value: 'processes', label: 'Machine Processes' },
        { value: 'locations', label: 'Godowns & Locations' },
        { value: 'tareStandards', label: 'Tare Standards' },
        { value: 'signatories', label: 'Plant Signatories' }
      ]
    },
    ...(approvalSubView === 'history' ? [{
      id: 'status',
      label: 'Resolution Status',
      icon: ShieldCheck,
      allLabel: 'All Statuses',
      options: [
        { value: 'ALL', label: 'All Statuses' },
        { value: 'APPROVED', label: 'Approved Only' },
        { value: 'REJECTED', label: 'Rejected Only' }
      ]
    }] : [])
  ], [approvalSubView]);

  // Dynamic filter categories for Rates Master
  const rateFilterCategories = useMemo(() => [
    {
      id: 'party',
      label: 'Job Worker (Party)',
      icon: Users,
      allLabel: 'All Parties',
      options: [
        { value: 'ALL', label: 'All Parties' },
        ...displayVendors.map(v => ({ value: v.name, label: v.name }))
      ]
    }
  ], [displayVendors]);

  // Dynamic filter categories for Audit logs
  const auditFilterCategories = useMemo(() => [
    {
      id: 'category',
      label: 'Event Category',
      icon: Shield,
      allLabel: 'All Categories',
      options: [
        { value: 'ALL', label: 'All Categories' },
        { value: 'LOGIN', label: 'Authentication / Login' },
        { value: 'CREATE', label: 'Create Record' },
        { value: 'UPDATE', label: 'Update Record' },
        { value: 'DELETE', label: 'Delete Record' },
        { value: 'SECURITY', label: 'Security & Permissions' }
      ]
    }
  ], []);

  let dirSearchProps = null;
  let dirFilterProps = null;

  if (activeTab === 'directory' || activeTab === 'vendors' || activeTab === 'customers') {
    const isVendors = directorySubView === 'vendors';
    dirSearchProps = {
      value: isVendors ? vendorSearch : customerSearch,
      onChange: isVendors ? setVendorSearch : setCustomerSearch,
      placeholder: isVendors ? 'Search vendor name, GSTIN, city, phone...' : 'Search customer name, GSTIN, city, phone...'
    };
  } else if (activeTab === 'ratesValuation' || activeTab === 'rateMaster' || activeTab === 'valueMaster') {
    const isRates = pricingSubView === 'rates';
    dirSearchProps = {
      value: isRates ? rateSearch : valueSearch,
      onChange: isRates ? setRateSearch : setValueSearch,
      placeholder: isRates ? 'Search rate by party, item, process...' : 'Search valuation by item, hsn...'
    };
    if (isRates) {
      dirFilterProps = {
        categories: rateFilterCategories,
        activeFilters: { party: ratePartyFilter },
        onApply: (f) => { if (f.party !== undefined) setRatePartyFilter(f.party); },
        onReset: () => setRatePartyFilter('ALL')
      };
    }
  } else if (activeTab === 'rbac') {
    dirSearchProps = {
      value: userSearch,
      onChange: setUserSearch,
      placeholder: 'Search user by name, email, role...'
    };
  } else if (activeTab === 'approvals') {
    dirSearchProps = {
      value: approvalSearch,
      onChange: setApprovalSearch,
      placeholder: 'Search approvals by record title, type, submitter...'
    };
    dirFilterProps = {
      categories: approvalFilterCategories,
      activeFilters: {
        type: approvalTypeFilter,
        ...(approvalSubView === 'history' ? { status: approvalStatusFilter } : {})
      },
      onApply: (f) => {
        if (f.type !== undefined) setApprovalTypeFilter(f.type);
        if (f.status !== undefined) setApprovalStatusFilter(f.status);
      },
      onReset: () => {
        setApprovalTypeFilter('ALL');
        setApprovalStatusFilter('ALL');
      }
    };
  } else if (activeTab === 'audit') {
    dirSearchProps = {
      value: auditSearch,
      onChange: setAuditSearch,
      placeholder: 'Search audit events by user, action, module...'
    };
    dirFilterProps = {
      categories: auditFilterCategories,
      activeFilters: { category: auditCategoryFilter },
      onApply: (f) => { if (f.category !== undefined) setAuditCategoryFilter(f.category); },
      onReset: () => setAuditCategoryFilter('ALL')
    };
  }

  const renderDirActions = () => (
    <>
      {activeTab === 'directory' && (
        <>
          <HeaderButton
            icon={Download}
            label="Export CSV"
            onClick={() => exportToCsv(directorySubView === 'vendors' ? 'Vendors_Directory.csv' : 'Customers_Directory.csv', directorySubView === 'vendors' ? filteredVendors : filteredCustomers)}
            title="Export CSV"
          />
          {directorySubView === 'vendors' ? (
            <HeaderButton
              icon={Plus}
              label="Add Vendor"
              variant="primary"
              onClick={() => { setSelectedVendorToEdit(null); setShowAddVendorModal(true); }}
              title="Add Vendor"
            />
          ) : (
            <HeaderButton
              icon={Plus}
              label="Add Customer"
              variant="primary"
              onClick={() => { setSelectedCustomerToEdit(null); setShowAddCustomerModal(true); }}
              title="Add Customer"
            />
          )}
        </>
      )}

      {activeTab === 'ratesValuation' && (
        <>
          <HeaderButton
            icon={Download}
            label="Export CSV"
            onClick={() => exportToCsv(pricingSubView === 'rates' ? 'Job_Work_Rates.csv' : 'Valuation_Master.csv', pricingSubView === 'rates' ? filteredRates : filteredValueMasters)}
            title="Export CSV"
          />
          {pricingSubView === 'rates' ? (
            <HeaderButton
              icon={Plus}
              label="Add Rate Contract"
              variant="primary"
              onClick={() => { setSelectedRateToEdit(null); setShowAddRateModal(true); }}
              title="Add Rate Contract"
            />
          ) : (
            <HeaderButton
              icon={Plus}
              label="Add Valuation Standard"
              variant="primary"
              onClick={() => { setSelectedValueToEdit(null); setShowAddValueModal(true); }}
              title="Add Valuation Standard"
            />
          )}
        </>
      )}

      {activeTab === 'rbac' && (
        <>
          <HeaderButton
            icon={Download}
            label="Export CSV"
            onClick={() => exportToCsv('RBAC_Users_List.csv', filteredUsers)}
            title="Export Users List to CSV"
          />
          {isAdmin && (
            <HeaderButton
              icon={UserPlus}
              label="Create User"
              variant="primary"
              onClick={() => setShowCreateUserModal(true)}
              title="Create Employee / User Account"
            />
          )}
        </>
      )}

      {activeTab === 'approvals' && (
        <HeaderButton
          icon={Download}
          label="Export Approvals"
          onClick={() => exportToCsv('Master_Approvals_Queue.csv', filteredApprovals.map(a => ({
            ID: a.id,
            RecordTitle: a.recordTitle,
            MasterType: a.masterLabel || a.masterType,
            Action: a.action,
            Status: a.status,
            SubmittedBy: a.submittedBy?.displayName || a.submittedBy?.email || '',
            SubmitterRole: a.submittedBy?.role || '',
            ReviewedBy: a.reviewedBy?.displayName || a.reviewedBy?.email || '',
            ReviewNotes: a.reviewNotes || '',
            Date: formatApprovalTimestamp(a.createdAt)
          })))}
          title="Export Approvals to CSV"
        />
      )}

      {activeTab === 'audit' && (
        <HeaderButton
          icon={Download}
          label="Export Audit Log"
          onClick={() => exportToCsv('Security_Audit_Logs.csv', filteredAuditLogs)}
          title="Export Audit Log"
        />
      )}
    </>
  );

  return (
    <div className="ds-container">
      {/* ── Standard Unified Page Header with Breadcrumbs ── */}
      <PageHeader
        breadcrumbs={dirCrumbs}
        title={dirTitle}
        tooltip={dirTooltip}
        searchProps={dirSearchProps}
        filterProps={dirFilterProps}
        actions={renderDirActions()}
      />

      {/* ── Access Denied Banner if Tab Not Permitted ── */}
      {!canAccessTab(activeTab) && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', margin: '20px 0' }}>
          <ShieldAlert size={48} style={{ color: '#ef4444', margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>Access Restricted</h2>
          <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
            You do not have permission to view this section. Please contact your system administrator to request access.
          </p>
        </div>
      )}

      {/* ── Business Directory Switcher ── */}
      {activeTab === 'directory' && canAccessTab('directory') && (
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
      {activeTab === 'ratesValuation' && canAccessTab('ratesValuation') && (
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
      {activeTab === 'settings' && canAccessTab('settings') && (
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
      {(activeTab === 'vendors' || (activeTab === 'directory' && directorySubView === 'vendors')) && canAccessTab('directory') && (
        <>
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
      {(activeTab === 'rateMaster' || (activeTab === 'ratesValuation' && pricingSubView === 'rates')) && canAccessTab('ratesValuation') && (
        <div className="jw-ledger-section">
          <div className="jw-table-container">
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th>PARTY NAME</th>
                  <th>PROCESS</th>
                  <th>ITEM NAME</th>
                  <th>UOM</th>
                  <th>DATE</th>
                  <th>RATE</th>
                  <th>NOTES</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'center' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {filteredRates.length === 0 ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
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
                      <td className="td-material-col" style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '220px' }} title={r.notes || ''}>
                        {r.notes || '-'}
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
                                notes: r.notes || '',
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
      {(activeTab === 'valueMaster' || (activeTab === 'ratesValuation' && pricingSubView === 'value')) && canAccessTab('ratesValuation') && (
        <div className="jw-ledger-section">
          <div className="jw-table-container">
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
      {(activeTab === 'miscMaster' || (activeTab === 'settings' && settingsSubView === 'tare')) && canAccessTab('settings') && (
        <div className="ds-two-col-grid">
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
      {(activeTab === 'customers' || (activeTab === 'directory' && directorySubView === 'customers')) && canAccessTab('directory') && (
        <>
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
      {(activeTab === 'settings' && settingsSubView === 'erp') && canAccessTab('settings') && (
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
      {activeTab === 'rbac' && canAccessTab('rbac') && (
        <>
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
                              onClick={() => navigate(`/assign-permissions/${u.uid || u.id}`)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 14px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: '6px',
                                fontSize: '0.8125rem',
                                fontWeight: 700,
                                color: '#1d4ed8',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                              onMouseOver={e => { e.currentTarget.style.background = '#dbeafe'; }}
                              onMouseOut={e => { e.currentTarget.style.background = '#eff6ff'; }}
                              title="Configure Granular Permissions & Module Access"
                            >
                              <Shield size={13} style={{ color: '#2563eb' }} />
                              Assign Permissions
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
      {activeTab === 'audit' && canAccessTab('audit') && (
        <>
          {auditCategoryFilter !== 'ALL' && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 600, marginBottom: '10px' }}>
              <span>Category: <strong>{auditCategoryFilter}</strong></span>
              <button type="button" onClick={() => setAuditCategoryFilter('ALL')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1d4ed8', padding: 0, display: 'flex' }}>
                <X size={12} />
              </button>
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

      {/* ── TAB 10: Master Data Approvals Center ── */}
      {activeTab === 'approvals' && canAccessTab('approvals') && (
        <>
          {/* Sub-view Switcher Pills */}
          <div className="erp-subnav-pills" style={{ marginBottom: 18 }}>
            <button
              className={`erp-subnav-pill ${approvalSubView === 'pending' ? 'active' : ''}`}
              onClick={() => setApprovalSubView('pending')}
            >
              <Clock size={13} />
              <span>Pending Requests ({pendingApprovalsList.length})</span>
            </button>
            <button
              className={`erp-subnav-pill ${approvalSubView === 'history' ? 'active' : ''}`}
              onClick={() => setApprovalSubView('history')}
            >
              <CheckCircle2 size={13} />
              <span>Resolved History ({historyApprovalsList.length})</span>
            </button>
          </div>

          {/* Active Filter Pills if applied */}
          {(approvalTypeFilter !== 'ALL' || (approvalSubView === 'history' && approvalStatusFilter !== 'ALL')) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {approvalTypeFilter !== 'ALL' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', color: '#1d4ed8', fontWeight: 600 }}>
                  <span>Category: <strong>{approvalTypeFilter}</strong></span>
                  <button type="button" onClick={() => setApprovalTypeFilter('ALL')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#1d4ed8', padding: 0, display: 'flex' }}>
                    <X size={13} />
                  </button>
                </div>
              )}
              {approvalSubView === 'history' && approvalStatusFilter !== 'ALL' && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', color: '#b45309', fontWeight: 600 }}>
                  <span>Status: <strong>{approvalStatusFilter}</strong></span>
                  <button type="button" onClick={() => setApprovalStatusFilter('ALL')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#b45309', padding: 0, display: 'flex' }}>
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Requests Content */}
          {filteredApprovals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 20px', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#64748b' }}>
              <CheckCircle2 size={44} style={{ color: '#22c55e', margin: '0 auto 14px', display: 'block' }} />
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>
                {approvalSubView === 'pending' ? 'All Clear! No Pending Requests' : 'No Resolved Approval Records Found'}
              </div>
              <div style={{ fontSize: '0.82rem', marginTop: '6px', color: '#64748b' }}>
                {approvalSubView === 'pending'
                  ? 'All staff master change submissions have been reviewed and committed.'
                  : 'Change requests that have been approved or rejected will be archived here.'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {filteredApprovals.map(item => {
                const isPending = item.status === 'PENDING';
                const isApproved = item.status === 'APPROVED';
                const isRejected = item.status === 'REJECTED';
                const isExpanded = Boolean(expandedApprovalMap[item.id]);
                const createdDateStr = formatApprovalTimestamp(item.createdAt, 'Recent');
                const reviewedDateStr = formatApprovalTimestamp(item.reviewedAt, '');

                return (
                  <div
                    key={item.id}
                    className="ds-approval-card"
                    style={{
                      border: isPending ? '1px solid #cbd5e1' : '1px solid #e2e8f0',
                      boxShadow: isPending ? '0 2px 6px rgba(15, 23, 42, 0.06)' : 'none'
                    }}
                  >
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {item.action === 'CREATE' && (
                          <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0', padding: '3px 9px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                            + CREATE NEW
                          </span>
                        )}
                        {item.action === 'UPDATE' && (
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 9px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                            ✎ EDIT / UPDATE
                          </span>
                        )}
                        {item.action === 'DELETE' && (
                          <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', padding: '3px 9px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800 }}>
                            ✕ DELETE
                          </span>
                        )}

                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700 }}>
                          {item.masterLabel || item.masterType}
                        </span>

                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem', letterSpacing: '-0.01em' }}>
                          {item.recordTitle}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: isPending ? '#fef3c7' : isApproved ? '#dcfce7' : '#fee2e2',
                          color: isPending ? '#b45309' : isApproved ? '#15803d' : '#b91c1c',
                          border: `1px solid ${isPending ? '#fde68a' : isApproved ? '#bbf7d0' : '#fecaca'}`
                        }}>
                          {item.status}
                        </span>

                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} />
                          {createdDateStr}
                        </span>
                      </div>
                    </div>

                    {/* Submitter & Reviewer Meta Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '0.78rem', color: '#64748b' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} style={{ color: '#64748b' }} />
                        <span>Submitted by: <strong style={{ color: '#0f172a' }}>{item.submittedBy?.displayName || item.submittedBy?.email || 'Staff'}</strong> ({item.submittedBy?.role || 'staff'})</span>
                      </div>

                      {!isPending && (
                        <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                          Reviewed by: <strong style={{ color: '#0f172a' }}>{item.reviewedBy?.displayName || item.reviewedBy?.email || 'Admin'}</strong>
                          {reviewedDateStr && <span> on {reviewedDateStr}</span>}
                        </div>
                      )}
                    </div>

                    {/* Data Details View / Diff - Only shown when expanded */}
                    {isExpanded && (
                      <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {item.action === 'UPDATE' && item.previousData ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Previous Master Values
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {Object.keys(item.previousData || {})
                                  .filter(k => !['createdAt', 'updatedAt', 'id'].includes(k))
                                  .map(k => (
                                    <span key={k} style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', color: '#7f1d1d' }}>
                                      <strong>{k}:</strong> {String(item.previousData[k] ?? '—')}
                                    </span>
                                  ))}
                              </div>
                            </div>

                            <div style={{ background: '#ffffff', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Proposed New Values
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {Object.keys(item.proposedData || {})
                                  .filter(k => !['createdAt', 'updatedAt', 'id'].includes(k))
                                  .map(k => (
                                    <span key={k} style={{ background: '#f0fdf4', border: '1px solid #dcfce7', padding: '2px 8px', borderRadius: '4px', fontSize: '0.74rem', color: '#14532d' }}>
                                      <strong>{k}:</strong> {String(item.proposedData[k] ?? '—')}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                              {item.action === 'DELETE' ? 'Target Record For Removal' : 'Submitted Record Data'}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {Object.keys(item.proposedData || {})
                                .filter(k => !['createdAt', 'updatedAt', 'id'].includes(k))
                                .map(k => (
                                  <span key={k} style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '3px 8px', borderRadius: '4px', fontSize: '0.74rem', color: '#334155' }}>
                                    <strong style={{ color: '#64748b' }}>{k}:</strong> {String(item.proposedData[k] ?? '—')}
                                  </span>
                                ))}
                            </div>
                          </div>
                        )}

                        {item.reviewNotes && (
                          <div style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1', fontSize: '0.75rem', color: isRejected ? '#991b1b' : '#166534' }}>
                            <strong>Reviewer Notes / Reason:</strong> {item.reviewNotes}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div className="ds-approval-actions-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', paddingTop: '6px', borderTop: '1px solid #f1f5f9' }}>
                      <button
                        type="button"
                        onClick={() => toggleExpandApproval(item.id)}
                        style={{
                          background: isExpanded ? '#eff6ff' : '#ffffff',
                          color: isExpanded ? '#1d4ed8' : '#475569',
                          border: isExpanded ? '1px solid #bfdbfe' : '1px solid #cbd5e1',
                          padding: '6px 14px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s'
                        }}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        <span>{isExpanded ? 'Hide Changes' : 'View Changes'}</span>
                      </button>

                      {isPending && (
                        showRejectInputMap[item.id] ? (
                          <div className="ds-approval-reject-box" style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1, justifyContent: 'flex-end', minWidth: '280px' }}>
                            <input
                              type="text"
                              placeholder="Reason for rejection (e.g. invalid GSTIN, price mismatch)..."
                              value={rejectReasonMap[item.id] || ''}
                              onChange={e => setRejectReasonMap({ ...rejectReasonMap, [item.id]: e.target.value })}
                              style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.8rem',
                                flex: 1,
                                maxWidth: '380px'
                              }}
                            />
                            <div className="ds-approval-reject-btns" style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                disabled={processingApprovalId === item.id}
                                onClick={() => handleRejectRequest(item)}
                                style={{
                                  background: '#dc2626',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '6px 14px',
                                  borderRadius: '6px',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                Confirm Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowRejectInputMap({ ...showRejectInputMap, [item.id]: false })}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#64748b',
                                  fontSize: '0.78rem',
                                  cursor: 'pointer'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="ds-approval-btn-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <button
                              type="button"
                              disabled={processingApprovalId === item.id}
                              onClick={() => setShowRejectInputMap({ ...showRejectInputMap, [item.id]: true })}
                              style={{
                                background: '#ffffff',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                padding: '6px 16px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                              }}
                            >
                              ✕ Reject Request
                            </button>
                            <button
                              type="button"
                              disabled={processingApprovalId === item.id}
                              onClick={() => handleApproveRequest(item)}
                              style={{
                                background: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                padding: '6px 18px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
                                transition: 'all 0.15s'
                              }}
                            >
                              <Check size={14} />
                              {processingApprovalId === item.id ? 'Approving...' : '✓ Approve & Commit'}
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
              <div className="mform-field" style={{ marginTop: '8px' }}>
                <label className="mform-label">Contract Notes &amp; Terms</label>
                <textarea
                  className="mform-input"
                  style={{ minHeight: '64px', resize: 'vertical' }}
                  placeholder="e.g. Rate valid for Grade HD only. Permissible burning loss max 0.5%. Payment within 15 days."
                  value={newRateForm.notes || ''}
                  onChange={e => setNewRateForm({ ...newRateForm, notes: e.target.value })}
                />
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

      {/* Create Employee / User Modal */}
      {showCreateUserModal && (
        <CreateUserModal
          onClose={() => setShowCreateUserModal(false)}
        />
      )}

      {/* Admin Master Approval Center Modal */}
      {showApprovalModal && (
        <ApprovalCenterModal
          onClose={() => setShowApprovalModal(false)}
        />
      )}
    </div>
  );
}
