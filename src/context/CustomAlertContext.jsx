import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  HelpCircle, 
  X, 
  Check 
} from 'lucide-react';
import '../styles/CustomAlert.css';

const CustomAlertContext = createContext(null);

// Singleton reference for non-React or global window access
let alertBridge = null;

/**
 * Intelligent helper to detect the modal type and title from text
 */
function inferAlertMeta(message = '', defaultType = 'info', isConfirm = false) {
  const msgLower = String(message).toLowerCase();

  if (isConfirm) {
    if (msgLower.includes('delete') || msgLower.includes('clear') || msgLower.includes('remove')) {
      return { type: 'danger', title: 'Confirm Deletion' };
    }
    if (msgLower.includes('exceed') || msgLower.includes('warning') || msgLower.includes('discrepancy')) {
      return { type: 'warning', title: 'Attention Required' };
    }
    return { type: 'confirm', title: 'Please Confirm' };
  }

  // Error
  if (msgLower.includes('failed') || msgLower.includes('error') || msgLower.includes('cannot') || msgLower.includes('blocked') || msgLower.includes('prevented')) {
    return { type: 'error', title: 'Action Failed' };
  }
  // Validation / Warning
  if (
    msgLower.includes('please enter') || 
    msgLower.includes('please select') || 
    msgLower.includes('please specify') || 
    msgLower.includes('please verify') || 
    msgLower.includes('please provide') || 
    msgLower.includes('cannot be negative') || 
    msgLower.includes('already in') || 
    msgLower.includes('already registered') || 
    msgLower.includes('no data') || 
    msgLower.includes('no bags') || 
    msgLower.includes('maximum 4') ||
    msgLower.includes('exceeds')
  ) {
    return { type: 'warning', title: 'Required Field Notice' };
  }
  // Success
  if (
    msgLower.includes('success') || 
    msgLower.includes('successfully') || 
    msgLower.includes('recorded') || 
    msgLower.includes('generated') || 
    msgLower.includes('saved') || 
    msgLower.includes('confirmed') || 
    msgLower.includes('created') || 
    msgLower.includes('updated') || 
    msgLower.includes('added')
  ) {
    return { type: 'success', title: 'Success' };
  }

  return { type: defaultType, title: 'Notification' };
}

export function CustomAlertProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const queueRef = useRef([]);
  const confirmBtnRef = useRef(null);

  const processQueue = useCallback(() => {
    if (queueRef.current.length > 0) {
      const nextItem = queueRef.current.shift();
      setCurrent(nextItem);
    } else {
      setCurrent(null);
    }
  }, []);

  const showAlertInternal = useCallback((options) => {
    return new Promise((resolve) => {
      const item = {
        id: Date.now() + Math.random(),
        ...options,
        resolve
      };
      if (!current) {
        setCurrent(item);
      } else {
        queueRef.current.push(item);
      }
    });
  }, [current]);

  const handleClose = useCallback((value = false) => {
    if (current) {
      current.resolve(value);
      processQueue();
    }
  }, [current, processQueue]);

  // Expose bridge
  useEffect(() => {
    alertBridge = {
      alert: (message, opts = {}) => {
        const meta = inferAlertMeta(message, opts.type || 'info', false);
        return showAlertInternal({
          message: String(message || ''),
          title: opts.title || meta.title,
          type: opts.type || meta.type,
          confirmText: opts.confirmText || 'OK',
          isConfirm: false
        });
      },
      confirm: (message, opts = {}) => {
        const meta = inferAlertMeta(message, opts.type || 'confirm', true);
        const isDestructive = opts.isDestructive ?? (meta.type === 'danger' || String(message).toLowerCase().includes('delete'));
        return showAlertInternal({
          message: String(message || ''),
          title: opts.title || meta.title,
          type: opts.type || meta.type,
          confirmText: opts.confirmText || (isDestructive ? 'Delete' : 'Confirm'),
          cancelText: opts.cancelText || 'Cancel',
          isConfirm: true,
          isDestructive
        });
      }
    };

    // Monkey-patch window.alert so that ANY direct alert(...) call uses our UI
    if (typeof window !== 'undefined') {
      if (!window.__nativeAlert) {
        window.__nativeAlert = window.alert;
      }
      window.alert = (msg) => {
        return alertBridge.alert(msg);
      };
    }

    return () => {
      alertBridge = null;
    };
  }, [showAlertInternal]);

  // Keyboard navigation & focus
  useEffect(() => {
    if (!current) return;

    const timer = setTimeout(() => {
      if (confirmBtnRef.current) {
        confirmBtnRef.current.focus();
      }
    }, 50);

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose(false);
      } else if (e.key === 'Enter') {
        // Only trigger if not already focused on cancel
        if (document.activeElement && document.activeElement.classList.contains('custom-alert-btn-cancel')) {
          return;
        }
        e.preventDefault();
        handleClose(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [current, handleClose]);

  const renderIcon = () => {
    if (!current) return null;
    const type = current.type;
    if (type === 'success') return <CheckCircle2 size={24} strokeWidth={2.2} />;
    if (type === 'error' || type === 'danger') return <AlertCircle size={24} strokeWidth={2.2} />;
    if (type === 'warning') return <AlertTriangle size={24} strokeWidth={2.2} />;
    if (type === 'confirm') return <HelpCircle size={24} strokeWidth={2.2} />;
    return <Info size={24} strokeWidth={2.2} />;
  };

  const renderMessageContent = () => {
    if (!current?.message) return null;
    const lines = current.message.split('\n');

    if (lines.length === 1) {
      return <p className="custom-alert-line">{lines[0]}</p>;
    }

    return (
      <div className="custom-alert-paragraphs">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return null;

          if (trimmed.startsWith('⚠️')) {
            return (
              <div key={idx} className="custom-alert-callout-warning">
                {trimmed}
              </div>
            );
          }

          if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
            return (
              <div key={idx} className="custom-alert-bullet-row">
                <span className="custom-alert-bullet-icon" style={{ color: '#64748b' }}>•</span>
                <span>{trimmed.replace(/^[•\-]\s*/, '')}</span>
              </div>
            );
          }

          if (trimmed.startsWith('✓')) {
            return (
              <div key={idx} className="custom-alert-bullet-row" style={{ background: '#f0fdf4', color: '#166534' }}>
                <Check size={14} className="custom-alert-bullet-icon" style={{ color: '#16a34a' }} />
                <span>{trimmed.replace(/^✓\s*/, '')}</span>
              </div>
            );
          }

          return (
            <p key={idx} className="custom-alert-line">
              {trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  const contextValue = {
    alert: (msg, opts) => alertBridge ? alertBridge.alert(msg, opts) : Promise.resolve(),
    confirm: (msg, opts) => alertBridge ? alertBridge.confirm(msg, opts) : Promise.resolve(false),
    success: (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Success', type: 'success' }) : Promise.resolve(),
    error: (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Error', type: 'error' }) : Promise.resolve(),
    warning: (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Notice', type: 'warning' }) : Promise.resolve(),
    info: (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Information', type: 'info' }) : Promise.resolve()
  };

  return (
    <CustomAlertContext.Provider value={contextValue}>
      {children}
      {current && (
        <div 
          className="custom-alert-overlay" 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleClose(false);
            }
          }}
        >
          <div 
            className="custom-alert-dialog" 
            role="dialog" 
            aria-modal="true" 
            aria-labelledby="custom-alert-title"
          >
            <button 
              className="custom-alert-close-btn" 
              onClick={() => handleClose(false)} 
              title="Close"
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>

            <div className="custom-alert-header">
              <div className={`custom-alert-icon-box ${current.type}`}>
                {renderIcon()}
              </div>
              <div className="custom-alert-title-wrap">
                <h3 id="custom-alert-title" className="custom-alert-title">
                  {current.title}
                </h3>
                <span className={`custom-alert-type-badge ${current.type}`}>
                  {current.type === 'confirm' ? 'Confirmation' : current.type}
                </span>
              </div>
            </div>

            <div className="custom-alert-body">
              {renderMessageContent()}
            </div>

            <div className="custom-alert-footer">
              {current.isConfirm && (
                <button
                  type="button"
                  className="custom-alert-btn custom-alert-btn-cancel"
                  onClick={() => handleClose(false)}
                >
                  {current.cancelText || 'Cancel'}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                className={`custom-alert-btn ${
                  current.isDestructive 
                    ? 'custom-alert-btn-danger' 
                    : current.type === 'success' 
                      ? 'custom-alert-btn-primary' 
                      : 'custom-alert-btn-primary'
                }`}
                onClick={() => handleClose(true)}
              >
                {current.confirmText || 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </CustomAlertContext.Provider>
  );
}

// Hook for components
export function useAlert() {
  const ctx = useContext(CustomAlertContext);
  if (!ctx) {
    // If used outside provider, fallback to alertBridge
    return {
      alert: (msg, opts) => alertBridge ? alertBridge.alert(msg, opts) : Promise.resolve(),
      confirm: (msg, opts) => alertBridge ? alertBridge.confirm(msg, opts) : Promise.resolve(false),
      success: (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Success', type: 'success' }) : Promise.resolve(),
      error: (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Error', type: 'error' }) : Promise.resolve(),
      warning: (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Notice', type: 'warning' }) : Promise.resolve(),
      info: (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Information', type: 'info' }) : Promise.resolve()
    };
  }
  return ctx;
}

// Global functions for direct import anywhere
export const showAlert = (msg, opts) => alertBridge ? alertBridge.alert(msg, opts) : Promise.resolve();
export const showConfirm = (msg, opts) => alertBridge ? alertBridge.confirm(msg, opts) : Promise.resolve(false);
export const showSuccess = (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Success', type: 'success' }) : Promise.resolve();
export const showError = (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Error', type: 'error' }) : Promise.resolve();
export const showWarning = (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Notice', type: 'warning' }) : Promise.resolve();
export const showInfo = (msg, title) => alertBridge ? alertBridge.alert(msg, { title: title || 'Information', type: 'info' }) : Promise.resolve();

