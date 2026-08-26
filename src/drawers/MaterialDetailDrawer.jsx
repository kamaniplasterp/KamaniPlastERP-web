import React from 'react';
import { X, Briefcase, History, ShoppingCart } from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import '../styles/MaterialDetailDrawer.css';

export default function MaterialDetailDrawer({ material, isOpen, onClose, onIssueJW, onAddProduction }) {
  const { simulatedJobWorks, simulatedSalesOrders, simulatedMovements } = useWorkflow();

  if (!isOpen || !material) return null;

  const isFG = material.type === 'fg' || (material.code && material.code.startsWith('FG-'));
  const matCode = (material.code || '').toLowerCase();
  const matName = (material.name || '').toLowerCase();

  const jwList = (material.jwList && material.jwList.length > 0) ? material.jwList : (
    (simulatedJobWorks || []).filter(j => {
      const jwMat = (j.rawMat || '').toLowerCase();
      const jwMatId = (j.rawMaterialId || '').toLowerCase();
      if (matName.includes('yarn') || matCode.includes('yarn')) {
        return jwMat.includes('yarn') || jwMatId.includes('yarn');
      } else {
        return !jwMat.includes('yarn');
      }
    }).map(j => ({
      id: j.jwNo || j.id,
      vendor: j.vendor || 'Shree Plastic Works',
      sent: j.sentQty || `${j.sentQtyKg || 2000} KG`,
      recd: j.recQty || `${j.recQtyKg || 1960} KG`,
      bal: j.balQty || `${j.balQtyKg || 0} KG`,
      status: j.status || 'FULLY RECEIVED',
      badgeClass: j.status === 'FULLY RECEIVED' || j.status === 'COMPLETED' ? 'badge-completed' : 'badge-sent'
    }))
  );

  const salesOrdersList = (material.salesOrdersList && material.salesOrdersList.length > 0) ? material.salesOrdersList : (
    (simulatedSalesOrders || []).map(s => ({
      id: s.orderNo || s.id,
      customer: s.customer || 'ABC Marine Traders',
      qty: `${s.reservedCoils || s.orderedQtyCoils || 300} Coils`,
      status: s.status || 'RESERVED',
      badgeClass: s.status === 'COMPLETED' ? 'badge-completed' : 'badge-sent'
    }))
  );

  const filteredMovements = (simulatedMovements || []).filter(m => {
    const itemStr = (m.item || '').toLowerCase();
    const refStr = (m.ref || '').toLowerCase();
    const remarksStr = (m.remarks || '').toLowerCase();

    // If item name matches directly
    if (matName && itemStr && (itemStr.includes(matName) || matName.includes(itemStr))) return true;
    if (matCode && itemStr && itemStr.includes(matCode)) return true;

    // Specific category matching for RM vs FG
    if (isFG) {
      return itemStr.includes('rope') || itemStr.includes('danline') || itemStr.includes('fg') || refStr.startsWith('dsp-') || refStr.startsWith('fg-');
    } else {
      // Raw Material
      if (matName.includes('yarn') || matCode.includes('yarn')) {
        return itemStr.includes('yarn') || remarksStr.includes('yarn');
      } else {
        // Granules / Repol
        return (itemStr.includes('repol') || itemStr.includes('granules') || refStr.startsWith('rm-') || refStr.startsWith('jw-') || refStr.startsWith('grn-')) && !itemStr.includes('yarn');
      }
    }
  });

  const stockLogs = (material.stockLogs && material.stockLogs.length > 0) ? material.stockLogs : (
    filteredMovements.map(m => ({
      date: m.time || '2026-08-26',
      ref: m.ref || 'DOC-REF',
      action: m.remarks || `${m.type} movement`,
      qty: m.inward !== '0' ? m.inward : `-${m.outward}`,
      isPlus: m.inward !== '0'
    }))
  );

  return (
    <div className="mdrawer-overlay" onClick={onClose}>
      <div className="mdrawer-content" onClick={e => e.stopPropagation()}>
        {/* Dark Header */}
        <div className="mdrawer-header">
          <div className="mdrawer-header-top">
            <span className="mdrawer-code">{material.code || (isFG ? 'FG-PPD-06-YL' : 'RM-PP-001')}</span>
            <button className="mdrawer-close-btn" onClick={onClose} title="Close Drawer">
              <X size={18} />
            </button>
          </div>
          <h2 className="mdrawer-title">{material.name || (isFG ? 'PP Danline Rope 6mm (Yellow)' : 'PP Granules (Raffia Grade)')}</h2>
          <div className="mdrawer-sub">
            {isFG ? (
              <>Dia: {material.grade || '6 mm'} • Color: Bright Yellow with Blue Tracer • Finished Goods Warehouse Bay 3</>
            ) : (
              <>{material.brand || 'Reliance Repol H030SG'} • {material.grade || 'H030SG (MFI 3.2)'} • Loc: Silo Bay A-1 (Main Warehouse)</>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="mdrawer-body">
          {/* KPI Summary Card */}
          {isFG ? (
            <div className="mdrawer-kpi-grid">
              <div className="mdrawer-kpi-col">
                <div className="mdrawer-kpi-label">TOTAL STOCK</div>
                <div className="mdrawer-kpi-val text-dark">{material.totalBalance || '1250 Coils'}</div>
              </div>
              <div className="mdrawer-kpi-col">
                <div className="mdrawer-kpi-label">RESERVED</div>
                <div className="mdrawer-kpi-val text-blue">{material.atJobWork || '400 Coils'}</div>
              </div>
              <div className="mdrawer-kpi-col">
                <div className="mdrawer-kpi-label">FREE TO SELL</div>
                <div className="mdrawer-kpi-val text-green">{material.availFactory || '850 Coils'}</div>
              </div>
            </div>
          ) : (
            <div className="mdrawer-kpi-grid">
              <div className="mdrawer-kpi-col">
                <div className="mdrawer-kpi-label">AVAILABLE IN FACTORY</div>
                <div className="mdrawer-kpi-val text-green">{material.availFactory || '8500 KG'}</div>
              </div>
              <div className="mdrawer-kpi-col">
                <div className="mdrawer-kpi-label">AT JOB WORK</div>
                <div className="mdrawer-kpi-val text-amber">{material.atJobWork || '4500 KG'}</div>
              </div>
              <div className="mdrawer-kpi-col">
                <div className="mdrawer-kpi-label">TOTAL BALANCE</div>
                <div className="mdrawer-kpi-val text-dark">{material.totalBalance || '14000 KG'}</div>
              </div>
            </div>
          )}

          {/* Section: Allocated Sales Orders (FG) or Job Works (RM) */}
          {isFG ? (
            <div className="mdrawer-section">
              <div className="mdrawer-sec-header">
                <div className="mdrawer-sec-title">
                  <ShoppingCart size={15} className="icon-purple" />
                  ALLOCATED SALES ORDERS ({salesOrdersList.length})
                </div>
              </div>

              <div className="mdrawer-jw-list">
                {salesOrdersList.map((so, i) => (
                  <div key={i} className="mdrawer-jw-item">
                    <div className="mdrawer-jw-left">
                      <div className="mdrawer-jw-title">{so.id}</div>
                      <div className="mdrawer-jw-sub">{so.customer}</div>
                    </div>
                    <span className={`mdrawer-badge ${so.badgeClass}`}>
                      • {so.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mdrawer-section">
              <div className="mdrawer-sec-header">
                <div className="mdrawer-sec-title">
                  <Briefcase size={15} className="icon-amber" />
                  JOB WORKS ISSUED FOR THIS MATERIAL ({jwList.length})
                </div>
                <button
                  className="mdrawer-action-link"
                  onClick={() => { onClose(); if (onIssueJW) onIssueJW(); }}
                >
                  + Issue New JW
                </button>
              </div>

              <div className="mdrawer-jw-list">
                {jwList.map((jw, i) => (
                  <div key={i} className="mdrawer-jw-item">
                    <div className="mdrawer-jw-left">
                      <div className="mdrawer-jw-title">
                        {jw.id} <span className="mdrawer-jw-dot">•</span> {jw.vendor}
                      </div>
                      <div className="mdrawer-jw-sub">
                        Sent: {jw.sent} | Rec: {jw.rec} | Pending: <span className="text-bold-amber">{jw.pending}</span>
                      </div>
                    </div>
                    <span className={`mdrawer-badge ${jw.badgeClass}`}>
                      • {jw.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Recent Stock Logs (if RM) */}
          {!isFG && (
            <div className="mdrawer-section">
              <div className="mdrawer-sec-header">
                <div className="mdrawer-sec-title">
                  <History size={15} className="icon-blue" />
                  RECENT STOCK INWARD / OUTWARD LOGS
                </div>
              </div>

              <div className="mdrawer-log-list">
                {stockLogs.map((log, i) => (
                  <div key={i} className="mdrawer-log-item">
                    <div className="mdrawer-log-left">
                      <div className="mdrawer-log-ref">{log.ref}</div>
                      <div className="mdrawer-log-desc">{log.desc}</div>
                    </div>
                    <div className={`mdrawer-log-qty ${log.type === 'in' ? 'text-green' : 'text-red'}`}>
                      {log.qty}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mdrawer-footer" style={{ justifyContent: isFG ? 'space-between' : 'flex-end' }}>
          {isFG ? (
            <>
              <button
                className="mdrawer-dark-btn"
                onClick={() => { onClose(); if (onAddProduction) onAddProduction(); else alert(`Add production inward for ${material.code}`); }}
              >
                + Add Production Inward
              </button>
              <button className="mdrawer-close-footer-btn" onClick={onClose}>
                Close
              </button>
            </>
          ) : (
            <button className="mdrawer-close-footer-btn" onClick={onClose}>
              Close Drawer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
