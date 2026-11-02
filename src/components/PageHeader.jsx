import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import HeaderInfoTooltip from './HeaderInfoTooltip';
import AdvancedFilterPopup from './AdvancedFilterPopup';
import '../styles/PageHeader.css';

/**
 * Standardized Header Button
 * Supports automatic collapsing to icon-only when horizontal space is limited,
 * showing the full label in a native tooltip.
 */
export function HeaderButton({
  icon: Icon,
  label,
  title,
  variant = 'secondary', // 'primary' | 'secondary' | 'ghost'
  active = false,
  onClick,
  className = '',
  badge,
  children,
  ...rest
}) {
  const tooltip = title || label;

  return (
    <button
      type="button"
      className={`header-btn header-btn-${variant} ${active ? 'active' : ''} ${className}`}
      onClick={onClick}
      title={tooltip}
      aria-label={label || tooltip}
      {...rest}
    >
      {Icon && <Icon size={14} className="header-btn-icon" />}
      {label && <span className="header-btn-label">{label}</span>}
      {badge !== undefined && <span className="header-btn-badge">{badge}</span>}
      {children}
    </button>
  );
}

/**
 * Standardized PageHeader component
 * Follows ERP design:
 * 1. Breadcrumbs navigation at top (Parent / Submodule / Current)
 * 2. Single horizontal row:
 *    - Left: Page title + information tooltip + status/count badge
 *    - Right: Search bar + Advanced Filter Popup + Page Actions (Create, Export, Stats, etc.)
 * 3. Icon-only button collapse on compact screen widths with full tooltips
 * 4. Eliminates duplicate headers and unnecessary vertical stacking
 */
export default function PageHeader({
  breadcrumbs = [],
  title,
  tooltip,
  badge,
  searchProps,
  filterProps,
  actions,
  children,
  className = ''
}) {
  const navigate = useNavigate();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Automatically focus input when search popover opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select?.();
    }
  }, [isSearchOpen]);

  // Click outside or press Escape to close search bar and revert to button
  useEffect(() => {
    if (!isSearchOpen) return;

    function handleClickOutside(event) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsSearchOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen]);

  return (
    <header className={`standard-page-header ${className}`}>
      {/* ── Breadcrumb Navigation ── */}
      {breadcrumbs.length > 0 && (
        <nav className="header-breadcrumbs" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            const isFirst = idx === 0;

            return (
              <span key={idx} className="breadcrumb-item-wrap">
                {!isFirst && <span className="breadcrumb-separator">/</span>}

                {isLast || !crumb.route ? (
                  <span className="breadcrumb-current" aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    className="breadcrumb-link"
                    onClick={() => navigate(crumb.route)}
                  >
                    <span>{crumb.label}</span>
                  </button>
                )}
              </span>
            );
          })}
        </nav>
      )}

      {/* ── Title & Actions in a Single Horizontal Row ── */}
      <div className="header-title-actions-row">
        {/* Left Group: Title and info tooltip */}
        <div className="header-title-group">
          <h1 className="header-page-title">{title}</h1>
          {tooltip && <HeaderInfoTooltip text={tooltip} />}
        </div>

        {/* Right Group: Search, Filter, Actions */}
        <div className="header-actions-group">
          {/* Integrated Search Button (Icon-Only) with Floating Search Bar Popover */}
          {searchProps && (
            <div className="header-search-container" ref={searchContainerRef}>
              <HeaderButton
                icon={Search}
                title={searchProps.value ? `Active search: "${searchProps.value}" (Click to edit)` : 'Search'}
                variant="secondary"
                active={Boolean(isSearchOpen || searchProps.value)}
                className={`header-search-btn header-btn-icon-only ${searchProps.value ? 'has-search-query' : ''}`}
                badge={searchProps.value ? 1 : undefined}
                onClick={() => setIsSearchOpen(prev => !prev)}
              />

              {isSearchOpen && (
                <div className="header-search-popover" role="dialog" aria-label="Search box">
                  <Search size={14} className="header-search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="header-search-input"
                    placeholder={searchProps.placeholder || 'Search...'}
                    value={searchProps.value || ''}
                    onChange={e => searchProps.onChange(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') setIsSearchOpen(false);
                      if (e.key === 'Enter') setIsSearchOpen(false);
                    }}
                  />
                  {searchProps.value && (
                    <button
                      type="button"
                      className="header-search-clear"
                      onClick={() => {
                        searchProps.onChange('');
                        if (searchProps.onClear) searchProps.onClear();
                        searchInputRef.current?.focus();
                      }}
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="header-search-close-btn"
                    onClick={() => setIsSearchOpen(false)}
                    title="Close search"
                    aria-label="Close search"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Integrated Advanced Floating Filter Popup */}
          {filterProps && (
            <AdvancedFilterPopup {...filterProps} />
          )}

          {/* Page Actions (Buttons, Dropdowns, etc.) */}
          {actions}
        </div>
      </div>

      {/* ── Optional Children (e.g. Sub-view tabs or contextual panels) ── */}
      {children && (
        <div className="header-children-wrap">
          {children}
        </div>
      )}
    </header>
  );
}
