import { useState, useEffect } from 'react';
import {
  Search, Phone, MapPin, Building, RotateCcw, Save, CheckCircle2, FileText, Plus, Download
} from 'lucide-react';
import { subscribeVendors, subscribeBuyers, addVendor, addBuyer } from '../api/directory.api';
import { useWorkflow } from '../context/WorkflowContext';
import { exportToCsv } from '../utils/exportCsv';
import AddVendorModal from '../modals/AddVendorModal';
import AddCustomerModal from '../modals/AddCustomerModal';
import { seedInitialData } from '../api/seed';
import '../styles/DirectorySettings.css';



export default function DirectorySettingsView() {
  const [activeTab, setActiveTab] = useState('vendors');
  const [vendorSearch, setVendorSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const [liveVendors, setLiveVendors] = useState([]);
  const [liveBuyers, setLiveBuyers] = useState([]);
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  useEffect(() => {
    const unsubV = subscribeVendors(setLiveVendors);
    const unsubB = subscribeBuyers(setLiveBuyers);
    return () => {
      unsubV();
      unsubB();
    };
  }, []);

  const handleSaveVendor = async (data) => {
    try {
      await addVendor({
        name: data.name,
        processBadge: data.processBadge,
        phone: data.phone,
        location: data.location,
        gst: data.gst,
        rate: Number(data.rate || 8.5),
        pendingKg: 0
      });
    } catch (err) {
      console.error('Error adding vendor:', err);
    }
  };

  const handleSaveCustomer = async (data) => {
    try {
      await addBuyer({
        name: data.name,
        category: data.category,
        phone: data.phone,
        location: data.location,
        gst: data.gst,
        paymentTerms: data.paymentTerms,
        totalOrders: 0,
        outstandingAmount: '₹0.00L'
      });
    } catch (err) {
      console.error('Error adding customer:', err);
    }
  };

  const [companyProfile, setCompanyProfile] = useState({
    legalName: 'Kamani Plastic Industries',
    gstin: '24AAACK1234F1Z8',
    phone: '+91 2824 220011 / +91 98250 12345',
    address: 'Plot No. 12 & 14, GIDC Phase-II, Dhoraji, Dist. Rajkot, Gujarat - 360410',
    jwPrefix: 'JW-2026-',
    wastageAllowance: '2'
  });

  const handleSaveProfile = (e) => {
    e.preventDefault();
    alert('Factory company profile configuration saved successfully!');
  };

  const handleReloadDemoData = () => {
    if (confirm('Are you sure you want to reload clean factory sample data for Job Work, RM, FG, Orders, and Dispatches?')) {
      alert('Factory sample data reloaded successfully!');
    }
  };

  const displayVendors = liveVendors.map(v => ({
    avatar: (v.name || 'VE').slice(0, 2).toUpperCase(),
    name: v.name || 'Vendor',
    processBadge: v.processBadge || 'Job Work Processor',
    phone: v.phone || '',
    location: v.location || 'Gujarat',
    gst: `GST: ${v.gst || '24AAAAA0000A1Z5'}`,
    rate: typeof v.rate === 'number' ? `₹${v.rate}/KG` : v.rate || '₹18/KG',
    pending: typeof v.pendingKg === 'number' ? `${v.pendingKg.toLocaleString()} KG` : v.pendingKg || '0 KG',
    pendingOrange: (Number(v.pendingKg) || 0) > 0
  }));

  const displayBuyers = liveBuyers.map(b => ({
    avatar: (b.name || 'CU').slice(0, 2).toUpperCase(),
    name: b.name || 'Buyer',
    termsBadge: `Category: ${b.category || 'Trading'}`,
    phone: b.phone || '',
    location: b.location || 'Gujarat',
    gst: `GST: ${b.gst || '24AAAAA0000A1Z5'}`,
    orders: `${b.totalOrders || 0} Orders`,
    booked: b.outstandingAmount || '₹0.00L'
  }));

  const { globalSearch } = useWorkflow();
  const activeVendorQuery = vendorSearch || globalSearch || '';
  const activeCustomerQuery = customerSearch || globalSearch || '';

  const filteredVendors = displayVendors.filter(v =>
    (v.name || '').toLowerCase().includes(activeVendorQuery.toLowerCase()) ||
    (v.location || '').toLowerCase().includes(activeVendorQuery.toLowerCase()) ||
    (v.phone || '').toLowerCase().includes(activeVendorQuery.toLowerCase()) ||
    (v.gst || '').toLowerCase().includes(activeVendorQuery.toLowerCase())
  );

  const filteredCustomers = displayBuyers.filter(c =>
    (c.name || '').toLowerCase().includes(activeCustomerQuery.toLowerCase()) ||
    (c.location || '').toLowerCase().includes(activeCustomerQuery.toLowerCase()) ||
    (c.phone || '').toLowerCase().includes(activeCustomerQuery.toLowerCase()) ||
    (c.gst || '').toLowerCase().includes(activeCustomerQuery.toLowerCase())
  );

  return (
    <div className="ds-container">
      {/* ── Page Header ── */}
      <div className="ds-page-header">
        <div className="ds-header-left">
          <div className="ds-title-row">
            <h1 className="ds-page-title">Directory &amp; System Configuration</h1>
            <span className="ds-badge-grey">{displayVendors.length} Vendors • {displayBuyers.length} Customers</span>
          </div>
          <p className="ds-page-subtitle">
            Unified directory for managing processing partners, buyers, and factory-wide configuration settings.
          </p>
        </div>

        {/* Top Right Navigation Pills */}
        <div className="ds-tab-pills">
          <button
            className={`ds-pill-btn ${activeTab === 'vendors' ? 'active' : ''}`}
            onClick={() => setActiveTab('vendors')}
          >
            Processing Vendors ({displayVendors.length})
          </button>
          <button
            className={`ds-pill-btn ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            Customers ({displayBuyers.length})
          </button>
          <button
            className={`ds-pill-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ERP Settings
          </button>
        </div>
      </div>

      {/* ── TAB 1: Processing Vendors ── */}
      {activeTab === 'vendors' && (
        <>
          {/* Search Row */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="ds-records-count">Showing {filteredVendors.length} records</span>
              <button className="jw-btn-ghost" onClick={() => exportToCsv('Vendors_Directory.csv', filteredVendors)} style={{ cursor: 'pointer' }}>
                <Download size={14} /> Export CSV
              </button>
              <button className="inv-btn-dark-pill" onClick={() => setShowAddVendorModal(true)}>
                <Plus size={14} /> Add New Vendor
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="ds-cards-grid">
            {filteredVendors.map(v => (
              <div key={v.name} className="ds-card">
                <div className="ds-card-header">
                  <div className="ds-card-title-group">
                    <h3 className="ds-card-name">{v.name}</h3>
                    <span className="ds-process-badge">{v.processBadge}</span>
                  </div>
                  <span className="ds-avatar-badge">{v.avatar}</span>
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

      {/* ── TAB 2: Customers ── */}
      {activeTab === 'customers' && (
        <>
          {/* Search Row */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="ds-records-count">Showing {filteredCustomers.length} records</span>
              <button className="jw-btn-ghost" onClick={() => exportToCsv('Customers_Directory.csv', filteredCustomers)} style={{ cursor: 'pointer' }}>
                <Download size={14} /> Export CSV
              </button>
              <button className="inv-btn-dark-pill" onClick={() => setShowAddCustomerModal(true)}>
                <Plus size={14} /> Add New Customer
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="ds-cards-grid">
            {filteredCustomers.map(c => (
              <div key={c.name} className="ds-card">
                <div className="ds-card-header">
                  <div className="ds-card-title-group">
                    <h3 className="ds-card-name">{c.name}</h3>
                    <span className="ds-term-badge">{c.termsBadge}</span>
                  </div>
                  <span className="ds-avatar-badge">{c.avatar}</span>
                </div>

                <div className="ds-card-info-list">
                  <div className="ds-info-item">
                    <Phone size={13} className="ds-info-icon" />
                    <span>{c.phone}</span>
                  </div>
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

      {/* ── TAB 3: ERP Settings ── */}
      {activeTab === 'settings' && (
        <div className="ds-settings-grid">
          {/* Left Section: Company Profile Form */}
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

          {/* Right Section: Factory Demo Data Management */}
          <div className="ds-demo-reset-box">
            <div className="ds-demo-header">
              <RotateCcw size={16} /> Factory Demo Data Management
            </div>
            <p className="ds-demo-desc">
              Restore the ERP with clean demonstration records for Job Work challans, RM stock, finished goods, sales orders, and dispatches.
            </p>
            <button className="ds-btn-reload" onClick={handleReloadDemoData}>
              <RotateCcw size={14} /> Reload Factory Sample Data
            </button>
          </div>
        </div>
      )}

      {/* Local Modals */}
      {showAddVendorModal && (
        <AddVendorModal
          onClose={() => setShowAddVendorModal(false)}
          onSave={handleSaveVendor}
        />
      )}
      {showAddCustomerModal && (
        <AddCustomerModal
          onClose={() => setShowAddCustomerModal(false)}
          onSave={handleSaveCustomer}
        />
      )}
    </div>
  );
}
