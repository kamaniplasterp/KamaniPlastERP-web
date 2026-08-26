import { useState } from 'react';
import Sidebar from '../layouts/Sidebar';
import TopNav from '../layouts/TopNav';
import DirectorySettingsView from '../views/DirectorySettingsView';
import NewJobWorkModal from '../modals/NewJobWorkModal';
import SalesOrderModal from '../modals/SalesOrderModal';
import { Circle } from 'lucide-react';
import '../styles/Dashboard.css';

export default function DirectorySettings() {
  const [activeNav, setActiveNav] = useState('directory');
  const [showJobWorkModal, setShowJobWorkModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);

  const openJobWork = () => setShowJobWorkModal(true);
  const openSalesOrder = () => setShowSalesModal(true);

  return (
    <div className="erp-layout">
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />

      <div className="erp-main-area">
        <TopNav onNewJobWork={openJobWork} onSalesOrder={openSalesOrder} />

        <main className="erp-content">
          <DirectorySettingsView />
        </main>

        {/* ── Status Bar ── */}
        <footer className="erp-statusbar">
          <div className="status-left">
            <span className="status-online">
              <Circle size={7} fill="#22c55e" color="#22c55e" />
              Systems Online
            </span>
            <span className="status-sep">•</span>
            <span>Active Session: 2h 45m</span>
            <span className="status-sep">•</span>
            <span>Plant 1 – Rajkot GIDC</span>
          </div>
          <div className="status-right">
            <span>Kamani Plastic Industrial ERP</span>
            <span className="status-sep">•</span>
            <span className="status-edition">Unified Edition</span>
          </div>
        </footer>
      </div>

      {/* ── Shared Modals ── */}
      {showJobWorkModal && (
        <NewJobWorkModal onClose={() => setShowJobWorkModal(false)} />
      )}
      {showSalesModal && (
        <SalesOrderModal mode="sales" onClose={() => setShowSalesModal(false)} />
      )}
    </div>
  );
}
