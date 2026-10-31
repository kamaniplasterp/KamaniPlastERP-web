import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Plus } from 'lucide-react';
import '../styles/SearchableSelect.css';

/**
 * Universal Searchable Dropdown Select Component
 * Compatible with native select props and provides real-time search filtering.
 */
export default function SearchableSelect({
  value = '',
  onChange,
  options = [],
  placeholder = '-- Select --',
  searchPlaceholder = 'Type to search...',
  disabled = false,
  required = false,
  allowCustom = false,
  clearable = false,
  className = '',
  style = {},
  name = '',
  id = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize options into { value, label, sublabel } format
  const normalizedOptions = useMemo(() => {
    return (options || []).map(opt => {
      if (opt === null || opt === undefined) return { value: '', label: '' };
      if (typeof opt === 'object') {
        const val = opt.value !== undefined ? String(opt.value) : (opt.id || opt.name || opt.label || '');
        const lbl = opt.label !== undefined ? String(opt.label) : (opt.name || opt.value || opt.id || '');
        return {
          value: val,
          label: lbl,
          sublabel: opt.sublabel || opt.category || opt.processBadge || opt.location || ''
        };
      }
      return {
        value: String(opt),
        label: String(opt),
        sublabel: ''
      };
    });
  }, [options]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    const rawVal = typeof value === 'object' && value !== null
      ? (value.value || value.target?.value || value.label || '')
      : value;
    const strVal = String(rawVal ?? '');
    return normalizedOptions.find(o => o.value === strVal || o.label === strVal);
  }, [value, normalizedOptions]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter(opt => 
      opt.label.toLowerCase().includes(q) ||
      opt.value.toLowerCase().includes(q) ||
      (opt.sublabel && opt.sublabel.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const handleSelect = (optValue) => {
    if (onChange) {
      // Pass raw value as primary argument, and event-like object as second arg for full compatibility
      onChange(optValue, { target: { value: optValue, name: name || id } });
    }
    setIsOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    if (onChange) {
      onChange('', { target: { value: '', name: name || id } });
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < filteredOptions.length ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions.length > 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex].value);
      } else if (allowCustom && searchQuery.trim()) {
        handleSelect(searchQuery.trim());
      }
    }
  };

  const displayLabel = selectedOption
    ? selectedOption.label
    : (typeof value === 'object' && value !== null 
        ? (value.label || value.value || value.target?.value || '') 
        : (value ? String(value) : ''));

  const hasExactMatch = filteredOptions.some(
    o => o.label.toLowerCase() === searchQuery.trim().toLowerCase() ||
         o.value.toLowerCase() === searchQuery.trim().toLowerCase()
  );

  return (
    <div
      ref={containerRef}
      className={`searchable-select-wrap ${isOpen ? 'is-open' : ''} ${className}`}
      style={style}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden input to support standard HTML form validation if required */}
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute', pointerEvents: 'none' }}
          value={value || ''}
          onChange={() => {}}
          required={required}
        />
      )}

      {/* Main Trigger Button */}
      <button
        type="button"
        id={id}
        name={name}
        disabled={disabled}
        className="searchable-select-trigger"
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`searchable-select-value ${!displayLabel ? 'is-placeholder' : ''}`}>
          {displayLabel || placeholder}
        </span>

        <span className="searchable-select-actions">
          {clearable && value && !disabled && (
            <span
              className="searchable-select-clear"
              onClick={handleClear}
              title="Clear selection"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown size={14} className="searchable-select-chevron" />
        </span>
      </button>

      {/* Floating Dropdown */}
      {isOpen && !disabled && (
        <div className="searchable-select-dropdown" role="listbox">
          {/* Search Input Bar */}
          <div className="searchable-select-search-box">
            <Search size={13} className="searchable-select-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="searchable-select-search-input"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onClick={e => e.stopPropagation()}
            />
          </div>

          {/* Options List */}
          <div ref={listRef} className="searchable-select-options-list">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, index) => {
                const isSelected = selectedOption && selectedOption.value === opt.value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={`${opt.value}-${index}`}
                    className={`searchable-select-option ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="searchable-select-option-content">
                      <span className="searchable-select-option-label">{opt.label}</span>
                      {opt.sublabel && (
                        <span className="searchable-select-option-sublabel">{opt.sublabel}</span>
                      )}
                    </div>
                    {isSelected && <Check size={14} className="searchable-select-check-icon" />}
                  </div>
                );
              })
            ) : (
              <div className="searchable-select-empty">
                {allowCustom && searchQuery.trim() ? (
                  <span>No existing match for "{searchQuery}"</span>
                ) : (
                  <span>No options found</span>
                )}
              </div>
            )}

            {/* Allow typing custom new value on the fly */}
            {allowCustom && searchQuery.trim() && !hasExactMatch && (
              <button
                type="button"
                className="searchable-select-custom-btn"
                onClick={() => handleSelect(searchQuery.trim())}
              >
                <Plus size={13} /> Use "{searchQuery.trim()}"
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

