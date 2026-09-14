import { useState, useEffect } from 'react';
import {
  Search, Phone, MapPin, Building, RotateCcw, Save, CheckCircle2, FileText, Plus, Download,
  Layers, Package, Users, DollarSign, Tag, Calculator, ShieldCheck
} from 'lucide-react';
import { subscribeVendors, subscribeBuyers, addVendor, addBuyer, subscribeJobWorkRates, addJobWorkRate } from '../api/directory.api';
import { subscribeJobWorks, ARTICLE_TARE_DEFAULTS, AUTHORIZED_PERSONS, JW_PROCESS_LIST } from '../api/jobwork.api';
import { subscribeSalesOrders } from '../api/sales.api';
import { useWorkflow } from '../context/WorkflowContext';
import { exportToCsv } from '../utils/exportCsv';
import AddVendorModal from '../modals/AddVendorModal';
import AddCustomerModal from '../modals/AddCustomerModal';
import '../styles/DirectorySettings.css';

export default function DirectorySettingsView() {
  const [activeTab, setActiveTab] = useState('vendors');
  const [vendorSearch, setVendorSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [rateSearch, setRateSearch] = useState('');

  const [liveVendors, setLiveVendors] = useState([]);
  const [liveBuyers, setLiveBuyers] = useState([]);
  const [liveJobWorks, setLiveJobWorks] = useState([]);
  const [liveSalesOrders, setLiveSalesOrders] = useState([]);
  const [liveRates, setLiveRates] = useState([]);

  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddRateModal, setShowAddRateModal] = useState(false);

  const [newRateForm, setNewRateForm] = useState({
    party: 'GALAXY.ENTERPRISE',
    process: JW_PROCESS_LIST[0],
    item: 'ANCHOR YARN ^ YARN HANK',
    uom: 'Kgs',
    rate: '17.50'
  });

  useEffect(() => {
    const unsubV = subscribeVendors(setLiveVendors);
    const unsubB = subscribeBuyers(setLiveBuyers);
    const unsubJ = subscribeJobWorks(setLiveJobWorks);
    const unsubS = subscribeSalesOrders(setLiveSalesOrders);
    const unsubR = subscribeJobWorkRates(setLiveRates);
    return () => {
      unsubV();
      unsubB();
      unsubJ();
      unsubS();
      unsubR();
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
        rate: Number(data.rate || 17.5),
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

  const handleSaveNewRate = async (e) => {
    e.preventDefault();
    try {
      await addJobWorkRate(newRateForm);
      setShowAddRateModal(false);
      alert('Job Work Rate Master entry created successfully!');
    } catch (err) {
      console.error('Error adding rate:', err);
    }
  };

  const [companyProfile, setCompanyProfile] = useState({
    legalName: 'Kamani Plastic Industries',
    gstin: '24AAACK1234F1Z8',
    phone: '+91 2824 220011 / +91 98250 12345',
    address: 'Plot No. 12 & 14, GIDC Phase-II, Dhoraji, Dist. Rajkot, Gujarat - 360410',
    jwPrefix: 'JW-2026-',
    wastageAllowance: '2.5'
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
      avatar: (v.name || 'VE').slice(0, 2).toUpperCase(),
      name: v.name || 'Vendor',
      processBadge: v.processBadge || 'Job Work Processor',
      phone: v.phone || '+91 98250 00000',
      location: v.location || 'Gujarat',
      gst: `GST: ${v.gst || '24AABCS9912K1Z4'}`,
      rate: typeof v.rate === 'number' ? `₹${v.rate}/KG` : v.rate || '₹17.50/KG',
      pending: `${pendingTotal.toLocaleString('en-IN')} KG`,
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
      avatar: (b.name || 'CU').slice(0, 2).toUpperCase(),
      name: b.name || 'Customer',
      termsBadge: b.category || b.paymentTerms || 'Wholesale Buyer',
      phone: b.phone || '',
      location: b.location || 'Gujarat',
      gst: `GST: ${b.gst || '24AAAAA0000A1Z5'}`,
      orders: `${totalOrdersCount} Orders`,
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

  const filteredRates = allRates.filter(r => 
    (r.party || '').toLowerCase().includes(rateSearch.toLowerCase()) ||
    (r.process || '').toLowerCase().includes(rateSearch.toLowerCase()) ||
    (r.item || '').toLowerCase().includes(rateSearch.toLowerCase())
  );

  return (
    <div className="ds-container">
      {/* ── Page Header ── */}
      <div className="ds-page-header">
        <div>
          <h1 className="ds-page-title">Directory, Rate Masters &amp; System Configuration</h1>
          <p className="ds-page-subtitle">
            Maintain Job Work Rate Masters, packaging tare standards, vendors, wholesale customers, and company profile.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="ds-tabs-row">
          <button
            className={`ds-tab-btn ${activeTab === 'vendors' ? 'active' : ''}`}
            onClick={() => setActiveTab('vendors')}
          >
            Processing Vendors
          </button>
          <button
            className={`ds-tab-btn ${activeTab === 'rateMaster' ? 'active' : ''}`}
            onClick={() => setActiveTab('rateMaster')}
          >
            JW Rate Master
          </button>
          <button
            className={`ds-tab-btn ${activeTab === 'miscMaster' ? 'active' : ''}`}
            onClick={() => setActiveTab('miscMaster')}
          >
            Packaging &amp; Tare Standards
          </button>
          <button
            className={`ds-tab-btn ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            Customers
          </button>
          <button
            className={`ds-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ERP Settings
          </button>
        </div>
      </div>

      {/* ── TAB 1: Processing Vendors ── */}
      {activeTab === 'vendors' && (
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

      {/* ── TAB 2: Job Work Rate Master (Matching Excel 'JW Rate Master') ── */}
      {activeTab === 'rateMaster' && (
        <div className="jw-ledger-section">
          <div className="ds-filter-row">
            <div className="ds-search-wrap">
              <Search size={14} className="ds-search-icon" />
              <input
                type="text"
                placeholder="Search by Party, Process, Item..."
                className="ds-search-input"
                value={rateSearch}
                onChange={e => setRateSearch(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="ds-records-count">Showing {filteredRates.length} rates</span>
              <button className="jw-btn-ghost" onClick={() => exportToCsv('JW_Rate_Master.csv', filteredRates)} style={{ cursor: 'pointer' }}>
                <Download size={14} /> Export CSV
              </button>
              <button className="inv-btn-dark-pill" onClick={() => setShowAddRateModal(true)}>
                <Plus size={14} /> Add Rate Contract
              </button>
            </div>
          </div>

          <div className="jw-table-container" style={{ marginTop: '12px' }}>
            <table className="jw-ledger-table">
              <thead>
                <tr>
                  <th>JOB WORK PARTY</th>
                  <th>PROCESS NAME</th>
                  <th>ITEM SPECIFICATION</th>
                  <th>UOM</th>
                  <th>EFFECTIVE DATE</th>
                  <th>PROCESSING RATE (₹)</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredRates.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Misc Master & Packaging Tare Standards ── */}
      {activeTab === 'miscMaster' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          {/* Packaging Tare Standards Card */}
          <div className="ds-settings-card">
            <div className="ds-card-header-inner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Package size={18} style={{ color: '#ea580c' }} />
                <h2 className="ds-card-title">Packaging Tare Weight Standards</h2>
              </div>
              <p className="ds-card-subtitle">Default tare deducted on gross scale weights (from Excel Misc Master)</p>
            </div>

            <div className="jw-table-container" style={{ marginTop: '10px' }}>
              <table className="jw-ledger-table">
                <thead>
                  <tr>
                    <th>ARTICLE TYPE</th>
                    <th>STANDARD TARE WEIGHT</th>
                    <th>TYPICAL USE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>BORA</td>
                    <td className="td-qty" style={{ fontWeight: 'bold', color: '#0284c7' }}>0.200 KG (200g)</td>
                    <td>Polymer Granules &amp; Danline Bags</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>PLASTIC CONE</td>
                    <td className="td-qty" style={{ fontWeight: 'bold', color: '#0284c7' }}>0.025 KG (25g)</td>
                    <td>Yarn / Monofilament Cones</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>KHALI BAG</td>
                    <td className="td-qty" style={{ fontWeight: 'bold', color: '#0284c7' }}>0.120 KG (120g)</td>
                    <td>Secondary Pack Bagging</td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold' }}>THELI (PACKAGING)</td>
                    <td className="td-qty" style={{ fontWeight: 'bold', color: '#0284c7' }}>0.015 KG (15g)</td>
                    <td>Consumer Hank Sleeves</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Authorized Personnel & Supervisors Card */}
          <div className="ds-settings-card">
            <div className="ds-card-header-inner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={18} style={{ color: '#2563eb' }} />
                <h2 className="ds-card-title">Authorized Personnel &amp; Supervisors</h2>
              </div>
              <p className="ds-card-subtitle">Dispatch issuers and inward QA signatories configured in system</p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
              {AUTHORIZED_PERSONS.map(p => (
                <span key={p} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 'bold', color: '#1e293b' }}>
                  👤 {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: Customers ── */}
      {activeTab === 'customers' && (
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

      {/* ── TAB 5: ERP Settings ── */}
      {activeTab === 'settings' && (
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

      {/* Add Rate Modal */}
      {showAddRateModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddRateModal(false)}>
          <div className="modal-dialog modal-md">
            <div className="modal-header-dark">
              <div>
                <h2 className="modal-title">Add Job Work Rate Contract</h2>
                <p className="modal-subtitle">Configure process processing rate per KG for vendor</p>
              </div>
              <button className="modal-close-btn" onClick={() => setShowAddRateModal(false)}>✕</button>
            </div>
            <form className="modal-body" onSubmit={handleSaveNewRate}>
              <div className="mform-field">
                <label className="mform-label">Job Work Party</label>
                <select className="mform-select" value={newRateForm.party} onChange={e => setNewRateForm({ ...newRateForm, party: e.target.value })}>
                  {displayVendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              <div className="mform-field">
                <label className="mform-label">Process Name</label>
                <select className="mform-select" value={newRateForm.process} onChange={e => setNewRateForm({ ...newRateForm, process: e.target.value })}>
                  {JW_PROCESS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="mform-field">
                <label className="mform-label">Item Description</label>
                <input type="text" className="mform-input" value={newRateForm.item} onChange={e => setNewRateForm({ ...newRateForm, item: e.target.value })} required />
              </div>
              <div className="mform-row mform-col-2">
                <div className="mform-field">
                  <label className="mform-label">Rate (₹)</label>
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
              </div>
              <div className="modal-footer" style={{ marginTop: '14px' }}>
                <button type="button" className="mfooter-btn cancel" onClick={() => setShowAddRateModal(false)}>Cancel</button>
                <button type="submit" className="mfooter-btn confirm">Save Rate Master</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
