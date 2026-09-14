import { useState, useEffect } from 'react';
import {
  Search, Phone, MapPin, Building, RotateCcw, Save, CheckCircle2, FileText, Plus, Download,
  Layers, Package, Users, DollarSign, Tag, Calculator, ShieldCheck
} from 'lucide-react';
import { 
  subscribeVendors, 
  subscribeBuyers, 
  addVendor, 
  addBuyer, 
  subscribeJobWorkRates, 
  addJobWorkRate,
  subscribeJwValueMasters,
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
import { subscribeJobWorks, JW_PROCESS_LIST } from '../api/jobwork.api';
import { subscribeSalesOrders } from '../api/sales.api';
import { useWorkflow } from '../context/WorkflowContext';
import { exportToCsv } from '../utils/exportCsv';
import AddVendorModal from '../modals/AddVendorModal';
import AddCustomerModal from '../modals/AddCustomerModal';
import JwValueMasterModal from '../modals/JwValueMasterModal';
import '../styles/DirectorySettings.css';

export default function DirectorySettingsView() {
  const [activeTab, setActiveTab] = useState('vendors');
  const [vendorSearch, setVendorSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [rateSearch, setRateSearch] = useState('');
  const [valueSearch, setValueSearch] = useState('');

  const [liveVendors, setLiveVendors] = useState([]);
  const [liveBuyers, setLiveBuyers] = useState([]);
  const [liveJobWorks, setLiveJobWorks] = useState([]);
  const [liveSalesOrders, setLiveSalesOrders] = useState([]);
  const [liveRates, setLiveRates] = useState([]);
  const [liveValueMasters, setLiveValueMasters] = useState([]);

  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showAddRateModal, setShowAddRateModal] = useState(false);
  const [showAddValueModal, setShowAddValueModal] = useState(false);

  const [newRateForm, setNewRateForm] = useState({
    party: 'GALAXY.ENTERPRISE',
    process: JW_PROCESS_LIST[0],
    item: 'ANCHOR YARN ^ YARN HANK',
    uom: 'Kgs',
    rate: '17.50'
  });

  const [tareStandards, setTareStandards] = useState(DEFAULT_TARE_STANDARDS);
  const [personnelList, setPersonnelList] = useState(DEFAULT_PERSONNEL);
  const [newPersonName, setNewPersonName] = useState('');
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

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await updateCompanyProfile(companyProfile);
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

  const filteredValueMasters = liveValueMasters.filter(v => 
    (v.code || '').toLowerCase().includes(valueSearch.toLowerCase()) ||
    (v.itemDescription || '').toLowerCase().includes(valueSearch.toLowerCase())
  );

  return (
    <div className="ds-container">
      {/* ── Page Header ── */}
      <div className="ds-page-header">
        <div>
          <h1 className="ds-page-title">Directory, Rate Masters &amp; System Configuration</h1>
          <p className="ds-page-subtitle">
            Maintain Job Work Rate Masters, JW Value Masters, packaging tare standards, vendors, wholesale customers, and company profile.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="ds-tabs-row">
          <button
            className={`ds-tab-btn ${activeTab === 'vendors' ? 'active' : ''}`}
            onClick={() => setActiveTab('vendors')}
          >
            Supplier Master (Vendors)
          </button>
          <button
            className={`ds-tab-btn ${activeTab === 'rateMaster' ? 'active' : ''}`}
            onClick={() => setActiveTab('rateMaster')}
          >
            JW Rate Master
          </button>
          <button
            className={`ds-tab-btn ${activeTab === 'valueMaster' ? 'active' : ''}`}
            onClick={() => setActiveTab('valueMaster')}
          >
            JW Value Master
          </button>
          <button
            className={`ds-tab-btn ${activeTab === 'miscMaster' ? 'active' : ''}`}
            onClick={() => setActiveTab('miscMaster')}
          >
            Misc Master (Tare &amp; Personnel)
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
                  <th>PARTY NAME</th>
                  <th>PROCESS</th>
                  <th>ITEM NAME</th>
                  <th>UOM</th>
                  <th>DATE</th>
                  <th>RATE</th>
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

      {/* ── TAB: Job Work Value Master (Sheet: JW Value Master) ── */}
      {activeTab === 'valueMaster' && (
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span className="ds-records-count">Showing {filteredValueMasters.length} valuation entries</span>
              <button className="jw-btn-ghost" onClick={() => exportToCsv('JW_Value_Master.csv', filteredValueMasters)} style={{ cursor: 'pointer' }}>
                <Download size={14} /> Export CSV
              </button>
              <button className="inv-btn-dark-pill" onClick={() => setShowAddValueModal(true)}>
                <Plus size={14} /> Add Valuation Entry
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
                        <button
                          onClick={async () => {
                            if (window.confirm(`Delete valuation entry ${v.code}?`)) {
                              await deleteJwValueMaster(v.id);
                            }
                          }}
                          style={{
                            background: 'transparent',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
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
      {activeTab === 'miscMaster' && (
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
                      BORA (Polymer Bags)
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Granules &amp; Danline secondary bags</div>
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
                      KHALI BAG
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Secondary pack protective bags</div>
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
                      THELI (PACKAGING)
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Consumer hank sleeves &amp; liners</div>
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

          {/* 12 Lookup Master Categories from Excel Misc Master */}
          <div className="ds-settings-card" style={{ gridColumn: 'span 2', marginTop: '10px' }}>
            <div className="ds-card-header-inner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={18} style={{ color: '#0284c7' }} />
                <h2 className="ds-card-title">Misc Master Lookup Reference Catalog (12 Standard Tables)</h2>
              </div>
              <p className="ds-card-subtitle">Master dropdown &amp; lookup definitions matching Excel Sheet: Misc Master</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginTop: '14px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>1. Deduction Particulars</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Trimming, Wastage, Extra Cutting, Edge Loss, Coil Core</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>2. Division</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Danline Rope, Twine, Hank Yarn, Polymer Trading</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>3. UOM (Unit of Measure)</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Kgs, Pieces, Coils, Hanks, Bundles, Reels, Nos</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>4. Articles</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Secondary Packaging Bags, Bobbins, Cones, Liners</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>5. Nature</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Job Work Processing, Internal Extrusion, Scrap Salvage</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>6. Process</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>FISHING YARN, DANLINE YARN, HANK, TWISTING, ROPE</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>7. Item Description</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>PP Danline, HDPE Granules, Masterbatch, White Natural</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>8. Sample PCs.</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Standard 10 PCs / batch QA sampling protocol</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>9. Person Name</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>SURESHBHAI, RAMILBHAI, MANSUKHBHAI, RAJESHBHAI</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>10. Article Type</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>BORA, PLASTIC CONE, KHALI BAG, THELI, NONE</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>11. Bags Type</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>PP Woven 25kg, HDPE Woven 50kg, Laminated Sacks</div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>12. B. Loss % (Bag Loss %)</div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Standard 0.00% – 5.00% allowable burning tare loss</div>
              </div>
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
                <label className="mform-label">Party Name</label>
                <select className="mform-select" value={newRateForm.party} onChange={e => setNewRateForm({ ...newRateForm, party: e.target.value })}>
                  {displayVendors.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              <div className="mform-field">
                <label className="mform-label">Process</label>
                <select className="mform-select" value={newRateForm.process} onChange={e => setNewRateForm({ ...newRateForm, process: e.target.value })}>
                  {JW_PROCESS_LIST.map(p => <option key={p} value={p}>{p}</option>)}
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
                <button type="button" className="mfooter-btn cancel" onClick={() => setShowAddRateModal(false)}>Cancel</button>
                <button type="submit" className="mfooter-btn confirm">Save Rate Master</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add JW Value Master Modal */}
      {showAddValueModal && (
        <JwValueMasterModal
          onClose={() => setShowAddValueModal(false)}
        />
      )}
    </div>
  );
}
