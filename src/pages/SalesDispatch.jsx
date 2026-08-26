import { useState } from 'react';
import Sidebar from '../layouts/Sidebar';
import TopNav from '../layouts/TopNav';
import SalesDispatchView from '../views/SalesDispatchView';
import SalesOrderModal from '../modals/SalesOrderModal';
import NewJobWorkModal from '../modals/NewJobWorkModal';
import DispatchChallanModal from '../modals/DispatchChallanModal';
import { Circle } from 'lucide-react';
import '../styles/Dashboard.css';

export default function SalesDispatch() {
  const [activeNav, setActiveNav] = useState('sales');
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [salesModalMode, setSalesModalMode] = useState('sales');
  const [showJobWorkModal, setShowJobWorkModal] = useState(false);

  const openSalesOrder = () => {
    setSalesModalMode('sales');
    setShowSalesModal(true);
  };

  const openDispatchModal = () => {
    setShowDispatchModal(true);
  };

  const openJobWork = () => {
    setShowJobWorkModal(true);
  };

  const openSimulator = () => setShowSimulator(true);

  return (
    <div className="erp-layout">
      <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} onOpenSimulator={openSimulator} />

      <div className="erp-main-area">
        <TopNav onNewJobWork={openJobWork} onSalesOrder={openSalesOrder} onOpenSimulator={openSimulator} />

        <main className="erp-content">
          <SalesDispatchView
            onOpenSalesOrder={openSalesOrder}
            onOpenDispatchModal={openDispatchModal}
          />
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
      {showSalesModal && (
        <SalesOrderModal
          mode={salesModalMode}
          onClose={() => setShowSalesModal(false)}
        />
      )}
      {showDispatchModal && (
        <DispatchChallanModal onClose={() => setShowDispatchModal(false)} />
      )}
      {showJobWorkModal && (
        <NewJobWorkModal onClose={() => setShowJobWorkModal(false)} />
      )}
    </div>
  );
}
