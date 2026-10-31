import { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';
import '../styles/HeaderInfoTooltip.css';

export default function HeaderInfoTooltip({ text }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  if (!text) return null;

  return (
    <div
      ref={containerRef}
      className="header-info-tooltip-wrap"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        className="header-info-btn"
        onClick={() => setIsOpen(prev => !prev)}
        aria-label="Information"
        title="View description"
      >
        <Info size={14} strokeWidth={2.4} />
      </button>

      {isOpen && (
        <div className="header-info-popover" role="tooltip">
          <div className="header-info-arrow" />
          <div className="header-info-text">{text}</div>
        </div>
      )}
    </div>
  );
}

