import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  X, Search, Scale, Package, Printer, BookOpen, 
  MapPin, Tag, Calendar, Layers, CheckCircle2, 
  ExternalLink, ArrowRight, Barcode, Filter 
} from 'lucide-react';
import { printSingleBagSticker } from '../utils/stickerPdf';

export default function QuickBagLookupModal({ 
  isOpen, 
  onClose, 
  liveBags = [], 
  onOpenBagDrawer, 
  onLocateInDiary 
}) {
  if (!isOpen) return null;

  const [query, setQuery] = useState('');
  const [stockTypeFilter, setStockTypeFilter] = useState('ALL'); // 'ALL' | 'FIXED' | 'LOOSE'
  const [selectedBagId, setSelectedBagId] = useState(null);
  const searchInputRef = useRef(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Filter bags
  const filteredBags = useMemo(() => {
    const cleanQ = query.trim().toLowerCase();
    return liveBags.filter(b => {
      // Stock type filter
      if (stockTypeFilter === 'FIXED' && b.stockType !== 'FIXED') return false;
      if (stockTypeFilter === 'LOOSE' && b.stockType === 'FIXED') return false;

      if (!cleanQ) return true;

      // Extract string representations
      const bagNoStr = String(b.bagNumber || '');
      const paddedNoStr = bagNoStr.padStart(6, '0');
      const barcodeStr = `kp-${paddedNoStr}`.toLowerCase();
      const bagCodeWithPrefix = `bag-${bagNoStr}`.toLowerCase();
      const batchStr = String(b.batchNumber || b.batch || b.lotNo || b.lotBatch || b.lotGroup || '').toLowerCase();
      const slipStr = String(b.inwardSlipNo || '').toLowerCase();
      const qualityStr = String(b.quality || b.itemName || '').toLowerCase();
      const formStr = String(b.form || b.formType || '').toLowerCase();
      const colorStr = String(b.color || '').toLowerCase();
      const sizeStr = String(b.size || '').toLowerCase();
      const locationStr = String(b.location || '').toLowerCase();

      // Check numeric or string match
      return (
        bagNoStr === cleanQ ||
        bagNoStr.includes(cleanQ) ||
        bagCodeWithPrefix.includes(cleanQ) ||
        barcodeStr.includes(cleanQ) ||
        batchStr.includes(cleanQ) ||
        slipStr.includes(cleanQ) ||
        qualityStr.includes(cleanQ) ||
        formStr.includes(cleanQ) ||
        colorStr.includes(cleanQ) ||
        sizeStr.includes(cleanQ) ||
        locationStr.includes(cleanQ)
      );
    });
  }, [liveBags, query, stockTypeFilter]);

  // Determine current active bag for hero profile
  const activeBag = useMemo(() => {
    if (selectedBagId) {
      const found = liveBags.find(b => (b.id === selectedBagId || b.bagNumber === selectedBagId));
      if (found) return found;
    }
    // If exact query matches 1 bag, auto select it
    if (filteredBags.length === 1) {
      return filteredBags[0];
    }
    return null;
  }, [selectedBagId, liveBags, filteredBags]);

  const handlePrint = (bag, e) => {
    if (e) e.stopPropagation();
    printSingleBagSticker(bag);
  };

  const handleLocate = (bag, e) => {
    if (e) e.stopPropagation();
    if (onLocateInDiary) {
      onLocateInDiary(bag);
      onClose();
    }
  };

  const handleOpenDrawer = (bag, e) => {
    if (e) e.stopPropagation();
    if (onOpenBagDrawer) {
      onOpenBagDrawer(bag);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog" style={{ maxWidth: '1060px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Dark Header */}
        <div className="modal-header-dark" style={{ flexShrink: 0 }}>
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: '#2563eb' }}>
              <Barcode size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="modal-title">Quick Bag / Batch / Barcode Lookup</span>
                <span style={{ fontSize: '0.72rem', background: '#1e293b', color: '#93c5fd', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  ઝડપી બેગ શોધ
                </span>
              </div>
              <p className="modal-subtitle">
                Instantly scan or search floor bag serials, check scale weights, godown locations, and print stickers.
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ overflowY: 'auto', padding: '16px 20px', flex: 1 }}>
          
          {/* Prominent Search Bar */}
          <div style={{ position: 'relative', marginBottom: '14px' }}>
            <Search 
              size={18} 
              style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} 
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by Bag # (e.g. 1, 14, BAG-014), Barcode (KP-000014), Batch #, Slip #, Quality, Size..."
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setSelectedBagId(null);
              }}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px 42px 12px 44px',
                fontSize: '0.96rem',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                outline: 'none',
                fontWeight: 500,
                background: '#f8fafc',
                color: '#0f172a'
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); setSelectedBagId(null); searchInputRef.current?.focus(); }}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '4px'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick Filter Bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginRight: '4px' }}>FILTER:</span>
              <button
                type="button"
                onClick={() => setStockTypeFilter('ALL')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: stockTypeFilter === 'ALL' ? '1px solid #2563eb' : '1px solid #cbd5e1',
                  background: stockTypeFilter === 'ALL' ? '#eff6ff' : '#ffffff',
                  color: stockTypeFilter === 'ALL' ? '#1d4ed8' : '#475569'
                }}
              >
                All ({liveBags.length})
              </button>
              <button
                type="button"
                onClick={() => setStockTypeFilter('FIXED')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: stockTypeFilter === 'FIXED' ? '1px solid #16a34a' : '1px solid #cbd5e1',
                  background: stockTypeFilter === 'FIXED' ? '#f0fdf4' : '#ffffff',
                  color: stockTypeFilter === 'FIXED' ? '#15803d' : '#475569'
                }}
              >
                Fixed 50kg Bags ({liveBags.filter(b => b.stockType === 'FIXED').length})
              </button>
              <button
                type="button"
                onClick={() => setStockTypeFilter('LOOSE')}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: stockTypeFilter === 'LOOSE' ? '1px solid #ea580c' : '1px solid #cbd5e1',
                  background: stockTypeFilter === 'LOOSE' ? '#fff7ed' : '#ffffff',
                  color: stockTypeFilter === 'LOOSE' ? '#c2410c' : '#475569'
                }}
              >
                Loose Stock ({liveBags.filter(b => b.stockType !== 'FIXED').length})
              </button>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
              Showing {filteredBags.length} of {liveBags.length} Bags
            </div>
          </div>

          {/* Hero Selected Bag Profile Card */}
          {activeBag && (
            <div style={{
              background: '#f8fafc',
              border: '2px solid #3b82f6',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '16px',
              boxShadow: '0 4px 12px -2px rgba(59, 130, 246, 0.12)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '1rem',
                    fontWeight: 900,
                    padding: '4px 12px',
                    borderRadius: '6px',
                    letterSpacing: '0.04em'
                  }}>
                    BAG #{activeBag.bagNumber}
                  </span>
                  <span style={{
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px'
                  }}>
                    KP-{String(activeBag.bagNumber).padStart(6, '0')}
                  </span>
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: activeBag.stockType === 'FIXED' ? '#dcfce7' : '#ffedd5',
                    color: activeBag.stockType === 'FIXED' ? '#15803d' : '#c2410c',
                    border: `1px solid ${activeBag.stockType === 'FIXED' ? '#86efac' : '#fed7aa'}`
                  }}>
                    {activeBag.stockType === 'FIXED' ? '● FIXED DUAL STOCK (50 KG)' : '● LOOSE STOCK'}
                  </span>
                </div>

                {/* Direct Action Buttons on Card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={(e) => handlePrint(activeBag, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: '#2563eb',
                      color: '#ffffff',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                    title="Print 100x75mm Industrial Barcode Sticker"
                  >
                    <Printer size={13} /> Print Sticker
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleLocate(activeBag, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: '#ffffff',
                      color: '#0f172a',
                      border: '1px solid #cbd5e1',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                    title="Highlight Lot in Physical Diary View"
                  >
                    <BookOpen size={13} /> View in Diary
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleOpenDrawer(activeBag, e)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: '#f1f5f9',
                      color: '#334155',
                      border: '1px solid #cbd5e1',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                    title="Edit weight / godown location"
                  >
                    <ExternalLink size={13} /> Details
                  </button>
                </div>
              </div>

              {/* Specs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontSize: '0.82rem' }}>
                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>SCALE WEIGHT</div>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#16a34a' }}>
                    {Number(activeBag.actualWeightKg || activeBag.standardWeightKg || 50).toFixed(1)} <span style={{ fontSize: '0.75rem' }}>KG</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    Std: {Number(activeBag.standardWeightKg || 50).toFixed(1)} KG
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>QUALITY / GRADE</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeBag.quality || activeBag.itemName || 'Standard'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    {activeBag.form || activeBag.formType || 'Hank'} • {activeBag.color || 'Natural'}
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>SPEC / COILS</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                    {activeBag.size || '3×3'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    {activeBag.coilCount ? `${activeBag.coilCount} Coils` : '10 Coils'}
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>GODOWN LOCATION</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} style={{ color: '#2563eb' }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeBag.location || 'KPI Godown'}</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    {activeBag.date || 'Today'}
                  </div>
                </div>

                <div style={{ background: '#ffffff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b' }}>LOT / BATCH #</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {activeBag.batchNumber || activeBag.batch || activeBag.lotNo || (activeBag.inwardSlipNo ? `LOT-${activeBag.inwardSlipNo}` : '—')}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: '#64748b' }}>
                    Slip: {activeBag.inwardSlipNo || '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Matching Bags List Table */}
          <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflowX: 'auto', background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <table className="inv-table" style={{ width: '100%', minWidth: '920px', margin: 0, fontSize: '0.84rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ width: '110px', padding: '10px 14px' }}>BAG #</th>
                  <th style={{ textAlign: 'right', width: '95px', padding: '10px 14px' }}>SCALE WT</th>
                  <th style={{ width: '105px', padding: '10px 14px' }}>STOCK TYPE</th>
                  <th style={{ minWidth: '200px', padding: '10px 14px' }}>QUALITY &amp; SPEC</th>
                  <th style={{ minWidth: '150px', padding: '10px 14px' }}>LOCATION</th>
                  <th style={{ minWidth: '160px', padding: '10px 14px' }}>LOT / SLIP #</th>
                  <th style={{ textAlign: 'center', width: '120px', padding: '10px 14px' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredBags.length > 0 ? (
                  filteredBags.slice(0, 50).map(bag => {
                    const isSelected = activeBag && (activeBag.id === bag.id || activeBag.bagNumber === bag.bagNumber);
                    const actWt = Number(bag.actualWeightKg || bag.standardWeightKg || 50).toFixed(1);

                    return (
                      <tr 
                        key={bag.id || `bag-${bag.bagNumber}`}
                        onClick={() => setSelectedBagId(bag.id || bag.bagNumber)}
                        style={{
                          cursor: 'pointer',
                          background: isSelected ? '#eff6ff' : 'transparent',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 800, color: '#0f172a' }}>#{bag.bagNumber}</span>
                            <span style={{ fontSize: '0.68rem', color: '#64748b' }}>KP-{String(bag.bagNumber).padStart(4, '0')}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 14px' }}>
                          <strong style={{ color: '#16a34a', fontSize: '0.88rem' }}>{actWt}</strong> <span style={{ fontSize: '0.7rem', color: '#64748b' }}>KG</span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            background: bag.stockType === 'FIXED' ? '#dcfce7' : '#ffedd5',
                            color: bag.stockType === 'FIXED' ? '#15803d' : '#c2410c'
                          }}>
                            {bag.stockType === 'FIXED' ? 'FIXED' : 'LOOSE'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {bag.quality || bag.itemName || 'Standard'} • <span style={{ color: '#64748b', fontWeight: 500 }}>{bag.size || '3×3'}</span>
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {bag.form || bag.formType || 'Hank'} | {bag.color || 'Natural'}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#334155' }}>
                            <MapPin size={12} style={{ color: '#64748b', flexShrink: 0 }} />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                              {bag.location || 'KPI Godown'}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>
                            {bag.batchNumber || bag.batch || bag.lotNo || (bag.inwardSlipNo ? `LOT-${bag.inwardSlipNo}` : '—')}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', padding: '10px 14px' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={(e) => handlePrint(bag, e)}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '5px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.74rem',
                                color: '#1d4ed8',
                                fontWeight: 600
                              }}
                              title="Print Sticker"
                            >
                              <Printer size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleLocate(bag, e)}
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '5px',
                                padding: '4px 8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.74rem',
                                color: '#334155',
                                fontWeight: 600
                              }}
                              title="Locate in Diary"
                            >
                              <BookOpen size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px 16px', color: '#64748b' }}>
                      <Scale size={30} style={{ opacity: 0.35, marginBottom: '6px' }} />
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>No bags match "{query}"</div>
                      <div style={{ fontSize: '0.76rem', color: '#94a3b8', marginTop: '3px' }}>
                        Try searching by serial integer (e.g. 14), batch number, or clear filters.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredBags.length > 50 && (
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '8px' }}>
              Showing first 50 results of {filteredBags.length}. Refine search query to narrow results.
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', flexShrink: 0 }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Tip: Press <kbd style={{ background: '#e2e8f0', border: '1px solid #cbd5e1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, color: '#334155' }}>ESC</kbd> to close</span>
            <span>•</span>
            <span>Barcode format: <code style={{ color: '#2563eb', fontWeight: 600 }}>KP-######</code></span>
          </div>
          <button
            type="button"
            className="mfooter-btn cancel"
            onClick={onClose}
            style={{ minWidth: '85px', padding: '6px 16px', borderRadius: '6px' }}
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
