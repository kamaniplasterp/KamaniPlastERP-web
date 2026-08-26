import { useState } from 'react';
import Sidebar from '../layouts/Sidebar';
import TopNav from '../layouts/TopNav';
import InventoryStockView from '../views/InventoryStockView';
import NewJobWorkModal from '../modals/NewJobWorkModal';
import SalesOrderModal from '../modals/SalesOrderModal';
import { Circle } from 'lucide-react';
import '../styles/Dashboard.css';

export default function InventoryStock() {
  const [activeNav, setActiveNav] = useState('inventory');
  const [showJobWorkModal, setShowJobWorkModal] = useState(false);
  const [showSalesOrderModal, setShowSalesOrderModal] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [salesOrderMode, setSalesOrderMode] = useState('sales');

  const openJobWork = () => setShowJobWorkModal(true);
  const openSalesOrder = () => { setSalesOrderMode('sales'); setShowSalesOrderModal(true); };
  const openSimulator = () => setShowSimulator(true);

  return (
    <div className="erp-layout">
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} onOpenSimulator={openSimulator} />

      <div className="erp-main-area">
        <TopNav onNewJobWork={openJobWork} onSalesOrder={openSalesOrder} onOpenSimulator={openSimulator} />

        <main className="erp-content">
          <InventoryStockView onOpenJobWork={openJobWork} onOpenSalesOrder={openSalesOrder} />
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

      {/* ── Modals ── */}
      {showJobWorkModal && (
        <NewJobWorkModal onClose={() => setShowJobWorkModal(false)} />
      )}
      {showSalesOrderModal && (
        <SalesOrderModal
          mode={salesOrderMode}
          onClose={() => setShowSalesOrderModal(false)}
        />
      )}
    </div>
  );
}
