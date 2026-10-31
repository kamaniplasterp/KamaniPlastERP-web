import React, { useState, useEffect, useRef } from 'react';
import { 
  Filter, 
  RotateCcw, 
  ChevronRight, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Search,
  X,
  Tag
} from 'lucide-react';
import '../styles/AdvancedFilterPopup.css';

/**
 * AdvancedFilterPopup
 * 
 * Floating 2-column popup menu anchored to the Filter button.
 * Matches ERP design:
 * - Header: "FILTER BY CATEGORY" + "Reset all"
 * - Left column: Filter categories with icons, labels, selection preview, right arrow
 * - Right column: Selectable options with checkmarks & optional search
 * - Footer: "Done" primary button to apply changes
 * 
 * Props:
 * - categories: Array of category definitions:
 *     [
 *       {
 *         id: 'party',
 *         label: 'Party',
 *         icon: Users,
 *         type: 'single' | 'multiple', // default 'single'
 *         options: [{ value: 'All', label: 'All Parties' }, { value: 'ABC', label: 'ABC Polymers' }]
 *       }
 *     ]
 * - activeFilters: Object mapping category id to selected value (or array of values)
 *     e.g. { party: 'All', status: ['SENT', 'PARTIAL'] }
 * - onApply: (newFilters) => void
 * - onReset: () => void
 * - placeholder?: string
 */
export default function AdvancedFilterPopup({
  categories = [],
  activeFilters = {},
  onApply,
  onReset,
  buttonLabel = 'Filter',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCatId, setSelectedCatId] = useState(categories[0]?.id || '');
  const [draftFilters, setDraftFilters] = useState({ ...activeFilters });
  const [optionSearch, setOptionSearch] = useState('');
  
  const containerRef = useRef(null);
  const popupRef = useRef(null);

  // Sync draft filters when activeFilters change externally or popup opens
  useEffect(() => {
    if (isOpen) {
      setDraftFilters({ ...activeFilters });
      setOptionSearch('');
      if (categories.length > 0 && !selectedCatId) {
        setSelectedCatId(categories[0].id);
      }
    }
  }, [isOpen, activeFilters, categories]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Count active filters (ignoring 'All' or empty values)
  const activeCount = Object.entries(activeFilters).reduce((acc, [key, val]) => {
    if (val === undefined || val === null || val === 'All' || val === '') return acc;
    if (Array.isArray(val)) {
      const nonAll = val.filter(v => v !== 'All' && v !== '');
      return acc + nonAll.length;
    }
    return acc + 1;
  }, 0);

  const activeCategory = categories.find(c => c.id === selectedCatId) || categories[0];

  // Helper to get preview label for a category
  const getCategoryPreview = (cat) => {
    const val = draftFilters[cat.id];
    if (val === undefined || val === null || val === 'All' || val === '') {
      return cat.allLabel || 'All';
    }
    if (Array.isArray(val)) {
      if (val.length === 0 || (val.length === 1 && val[0] === 'All')) {
        return cat.allLabel || 'All';
      }
      return `${val.length} selected`;
    }
    const match = cat.options?.find(o => o.value === val);
    return match ? match.label : String(val);
  };

  // Toggle or select option
  const handleSelectOption = (cat, optionValue) => {
    const isMultiple = cat.type === 'multiple';
    const currentVal = draftFilters[cat.id];

    if (isMultiple) {
      let nextArray = Array.isArray(currentVal) ? [...currentVal] : [];
      if (optionValue === 'All') {
        nextArray = ['All'];
      } else {
        nextArray = nextArray.filter(v => v !== 'All');
        if (nextArray.includes(optionValue)) {
          nextArray = nextArray.filter(v => v !== optionValue);
          if (nextArray.length === 0) {
            nextArray = ['All'];
          }
        } else {
          nextArray.push(optionValue);
        }
      }
      setDraftFilters(prev => ({ ...prev, [cat.id]: nextArray }));
    } else {
      setDraftFilters(prev => ({ ...prev, [cat.id]: optionValue }));
    }
  };

  const isOptionSelected = (cat, optionValue) => {
    const val = draftFilters[cat.id];
    if (cat.type === 'multiple') {
      if (!val || val.length === 0) return optionValue === 'All';
      return Array.isArray(val) && val.includes(optionValue);
    }
    if (val === undefined || val === null || val === '') {
      return optionValue === 'All';
    }
    return val === optionValue;
  };

  const handleResetAll = () => {
    const resetObj = {};
    categories.forEach(cat => {
      resetObj[cat.id] = cat.type === 'multiple' ? ['All'] : 'All';
    });
    setDraftFilters(resetObj);
    if (onReset) onReset();
  };

  const handleApply = () => {
    if (onApply) {
      onApply(draftFilters);
    }
    setIsOpen(false);
  };

  // Filter options by search text
  const filteredOptions = (activeCategory?.options || []).filter(opt => {
    if (!optionSearch.trim()) return true;
    return opt.label?.toLowerCase().includes(optionSearch.toLowerCase()) ||
           opt.value?.toString().toLowerCase().includes(optionSearch.toLowerCase());
  });

  return (
    <div className={`adv-filter-container ${className}`} ref={containerRef}>
      {/* ── Trigger Button ── */}
      <button
        type="button"
        className={`header-btn header-btn-secondary adv-filter-trigger ${isOpen ? 'active' : ''} ${activeCount > 0 ? 'has-active' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title={activeCount > 0 ? `Filters (${activeCount} active)` : buttonLabel}
      >
        <Filter size={14} className="adv-filter-icon" />
        <span className="adv-filter-btn-text">{buttonLabel}</span>
        {activeCount > 0 && (
          <span className="adv-filter-count-badge">{activeCount}</span>
        )}
        {isOpen ? <ChevronUp size={13} className="adv-filter-chevron" /> : <ChevronDown size={13} className="adv-filter-chevron" />}
      </button>

      {/* ── Floating 2-Column Popup ── */}
      {isOpen && (
        <div className="adv-filter-popup" ref={popupRef} role="dialog" aria-label="Filter by Category">
          {/* Header */}
          <div className="adv-filter-header">
            <span className="adv-filter-header-title">FILTER BY CATEGORY</span>
            <button
              type="button"
              className="adv-filter-reset-btn"
              onClick={handleResetAll}
              title="Reset all filters"
            >
              <RotateCcw size={12} />
              <span>Reset all</span>
            </button>
          </div>

          {/* Two-Column Body */}
          <div className="adv-filter-body">
            {/* Left Column: Categories List */}
            <div className="adv-filter-sidebar">
              {categories.map(cat => {
                const IconComponent = cat.icon || Tag;
                const isCatActive = (activeCategory?.id === cat.id);
                const preview = getCategoryPreview(cat);
                const isFiltered = preview !== (cat.allLabel || 'All');

                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`adv-filter-cat-item ${isCatActive ? 'active' : ''} ${isFiltered ? 'cat-filtered' : ''}`}
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      setOptionSearch('');
                    }}
                  >
                    <div className="adv-filter-cat-left">
                      <IconComponent size={14} className="adv-filter-cat-icon" />
                      <span className="adv-filter-cat-label">{cat.label}</span>
                    </div>

                    <div className="adv-filter-cat-right">
                      <span className="adv-filter-cat-preview" title={preview}>{preview}</span>
                      <ChevronRight size={13} className="adv-filter-cat-arrow" />
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Options List */}
            <div className="adv-filter-content">
              {activeCategory ? (
                <>
                  <div className="adv-filter-content-header">
                    <span className="adv-filter-content-title">{activeCategory.label}</span>
                    {activeCategory.type === 'multiple' && (
                      <span className="adv-filter-multi-tag">Multi-select</span>
                    )}
                  </div>

                  {/* Search within options if more than 5 options */}
                  {(activeCategory.options?.length || 0) > 5 && (
                    <div className="adv-filter-option-search">
                      <Search size={12} className="adv-filter-search-icon" />
                      <input
                        type="text"
                        placeholder={`Search ${activeCategory.label.toLowerCase()}...`}
                        value={optionSearch}
                        onChange={e => setOptionSearch(e.target.value)}
                        autoFocus={false}
                      />
                      {optionSearch && (
                        <button
                          type="button"
                          className="adv-filter-search-clear"
                          onClick={() => setOptionSearch('')}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Options List */}
                  <div className="adv-filter-options-list">
                    {filteredOptions.length === 0 ? (
                      <div className="adv-filter-empty-options">No matches found</div>
                    ) : (
                      filteredOptions.map((opt, idx) => {
                        const selected = isOptionSelected(activeCategory, opt.value);

                        return (
                          <button
                            key={idx}
                            type="button"
                            className={`adv-filter-option-item ${selected ? 'selected' : ''}`}
                            onClick={() => handleSelectOption(activeCategory, opt.value)}
                          >
                            <span className="adv-filter-check-slot">
                              {selected && <Check size={14} className="adv-filter-check-icon" />}
                            </span>
                            <span className="adv-filter-option-label">{opt.label}</span>
                            {opt.count !== undefined && (
                              <span className="adv-filter-option-count">{opt.count}</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className="adv-filter-empty-state">Select a category on the left</div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="adv-filter-footer">
            <button
              type="button"
              className="adv-filter-done-btn"
              onClick={handleApply}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

