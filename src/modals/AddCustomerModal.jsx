import { useState, useEffect } from 'react';
import { 
  X, 
  Building, 
  ShieldCheck, 
  CheckCircle2, 
  MessageSquare, 
  AlertCircle, 
  RefreshCw 
} from 'lucide-react';
import { 
  sendOtp, 
  verifyOtp, 
  retryOtp, 
  isValidIndianMobile, 
  extract10DigitPhone,
  isMockMode,
  isOtpBypassed
} from '../api/msg91.api';
import '../styles/Modals.css';

export default function AddCustomerModal({ onClose, onSave }) {
  const isBypassed = isOtpBypassed();

  const [formData, setFormData] = useState({
    name: '',
    category: 'Marine & Fishing Supplies',
    phone: '',
    contactPerson: '',
    whatsapp: '',
    location: '',
    gst: '',
    paymentTerms: '30 Days Net'
  });

  const [isSameAsPhone, setIsSameAsPhone] = useState(true);

  // Primary Phone OTP state
  const [isPhoneVerified, setIsPhoneVerified] = useState(isBypassed);
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState('');
  const [phoneCountdown, setPhoneCountdown] = useState(0);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneOtpStatus, setPhoneOtpStatus] = useState({ message: '', type: '' });

  // Separate WhatsApp OTP state (for when WhatsApp number is different)
  const [isWhatsappVerified, setIsWhatsappVerified] = useState(isBypassed);
  const [waOtpSent, setWaOtpSent] = useState(false);
  const [waOtpCode, setWaOtpCode] = useState('');
  const [waCountdown, setWaCountdown] = useState(0);
  const [waLoading, setWaLoading] = useState(false);
  const [waOtpStatus, setWaOtpStatus] = useState({ message: '', type: '' });

  // Countdown timer for Phone OTP
  useEffect(() => {
    let timer;
    if (phoneCountdown > 0) {
      timer = setTimeout(() => setPhoneCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [phoneCountdown]);

  // Countdown timer for WhatsApp OTP
  useEffect(() => {
    let timer;
    if (waCountdown > 0) {
      timer = setTimeout(() => setWaCountdown(prev => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [waCountdown]);

  const handleChange = (field, val) => {
    setFormData(prev => {
      const next = { ...prev, [field]: val };
      if (field === 'phone' && isSameAsPhone) {
        next.whatsapp = val;
      }
      return next;
    });

    // If OTP verification is active, changing numbers resets verification
    if (!isBypassed) {
      if (field === 'phone' && isPhoneVerified) {
        setIsPhoneVerified(false);
        setPhoneOtpSent(false);
        setPhoneOtpCode('');
        setPhoneOtpStatus({ message: 'Phone number changed. Please re-verify via OTP.', type: 'info' });
      }

      if (field === 'whatsapp' && isWhatsappVerified) {
        setIsWhatsappVerified(false);
        setWaOtpSent(false);
        setWaOtpCode('');
        setWaOtpStatus({ message: 'WhatsApp number changed. Please re-verify via OTP.', type: 'info' });
      }
    }
  };

  const handleToggleSameAsPhone = (checked) => {
    setIsSameAsPhone(checked);
    if (checked) {
      setFormData(prev => ({ ...prev, whatsapp: prev.phone }));
      if (!isBypassed) {
        setIsWhatsappVerified(false);
        setWaOtpSent(false);
        setWaOtpCode('');
        setWaOtpStatus({ message: '', type: '' });
      }
    }
  };

  // ── Primary Phone OTP Handlers ──
  const handleSendPhoneOtp = async () => {
    const clean = extract10DigitPhone(formData.phone);
    if (!isValidIndianMobile(clean)) {
      setPhoneOtpStatus({ message: 'Please enter a valid 10-digit Indian mobile number.', type: 'error' });
      return;
    }

    setPhoneLoading(true);
    setPhoneOtpStatus({ message: '', type: '' });

    const result = await sendOtp(clean);
    setPhoneLoading(false);

    if (result.success) {
      setPhoneOtpSent(true);
      setPhoneCountdown(30);
      setPhoneOtpStatus({ message: result.message || 'OTP sent successfully via SMS.', type: 'info' });
      if (result.isMock && result.mockOtp) {
        setPhoneOtpCode(result.mockOtp);
      }
    } else {
      setPhoneOtpStatus({ message: result.message || 'Failed to send OTP.', type: 'error' });
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtpCode.trim()) {
      setPhoneOtpStatus({ message: 'Please enter the 6-digit OTP code.', type: 'error' });
      return;
    }

    setPhoneLoading(true);
    setPhoneOtpStatus({ message: '', type: '' });

    const result = await verifyOtp(formData.phone, phoneOtpCode);
    setPhoneLoading(false);

    if (result.success) {
      setIsPhoneVerified(true);
      setPhoneOtpStatus({ message: result.message || 'Phone number verified!', type: 'success' });
    } else {
      setPhoneOtpStatus({ message: result.message || 'Incorrect OTP code.', type: 'error' });
    }
  };

  const handleResendPhoneOtp = async () => {
    if (phoneCountdown > 0) return;
    setPhoneLoading(true);
    setPhoneOtpStatus({ message: '', type: '' });

    const result = await retryOtp(formData.phone);
    setPhoneLoading(false);

    if (result.success) {
      setPhoneCountdown(30);
      setPhoneOtpStatus({ message: result.message || 'OTP resent via SMS.', type: 'info' });
    } else {
      setPhoneOtpStatus({ message: result.message || 'Failed to resend OTP.', type: 'error' });
    }
  };

  // ── WhatsApp OTP Handlers ──
  const handleSendWaOtp = async () => {
    const clean = extract10DigitPhone(formData.whatsapp);
    if (!isValidIndianMobile(clean)) {
      setWaOtpStatus({ message: 'Please enter a valid 10-digit WhatsApp mobile number.', type: 'error' });
      return;
    }

    setWaLoading(true);
    setWaOtpStatus({ message: '', type: '' });

    const result = await sendOtp(clean);
    setWaLoading(false);

    if (result.success) {
      setWaOtpSent(true);
      setWaCountdown(30);
      setWaOtpStatus({ message: result.message || 'OTP sent successfully via SMS to WhatsApp number.', type: 'info' });
      if (result.isMock && result.mockOtp) {
        setWaOtpCode(result.mockOtp);
      }
    } else {
      setWaOtpStatus({ message: result.message || 'Failed to send OTP.', type: 'error' });
    }
  };

  const handleVerifyWaOtp = async () => {
    if (!waOtpCode.trim()) {
      setWaOtpStatus({ message: 'Please enter the 6-digit OTP code.', type: 'error' });
      return;
    }

    setWaLoading(true);
    setWaOtpStatus({ message: '', type: '' });

    const result = await verifyOtp(formData.whatsapp, waOtpCode);
    setWaLoading(false);

    if (result.success) {
      setIsWhatsappVerified(true);
      setWaOtpStatus({ message: result.message || 'WhatsApp number verified!', type: 'success' });
    } else {
      setWaOtpStatus({ message: result.message || 'Incorrect OTP code.', type: 'error' });
    }
  };

  const handleResendWaOtp = async () => {
    if (waCountdown > 0) return;
    setWaLoading(true);
    setWaOtpStatus({ message: '', type: '' });

    const result = await retryOtp(formData.whatsapp);
    setWaLoading(false);

    if (result.success) {
      setWaCountdown(30);
      setWaOtpStatus({ message: result.message || 'OTP resent via SMS.', type: 'info' });
    } else {
      setWaOtpStatus({ message: result.message || 'Failed to resend OTP.', type: 'error' });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter a valid customer name.');
      return;
    }

    const cleanPhone = extract10DigitPhone(formData.phone);
    if (!cleanPhone) {
      alert('Please enter a valid customer contact phone number.');
      return;
    }

    const cleanWhatsapp = isSameAsPhone 
      ? cleanPhone 
      : extract10DigitPhone(formData.whatsapp) || cleanPhone;

    // In non-bypass mode, ensure numbers are verified
    if (!isBypassed) {
      if (!isPhoneVerified) {
        alert('Please verify the primary contact phone number via SMS OTP before saving.');
        return;
      }
      if (!isSameAsPhone && !isWhatsappVerified) {
        alert('Please verify the separate WhatsApp number via SMS OTP before saving.');
        return;
      }
    }

    const finalPhoneVerified = isBypassed ? true : isPhoneVerified;
    const finalWaVerified = isBypassed ? true : (isSameAsPhone ? isPhoneVerified : isWhatsappVerified);

    const payload = {
      ...formData,
      phone: cleanPhone,
      whatsapp: cleanWhatsapp,
      isWhatsAppDifferent: !isSameAsPhone,
      isPhoneVerified: finalPhoneVerified,
      phoneVerifiedAt: new Date().toISOString(),
      isWhatsappVerified: finalWaVerified,
      whatsappVerifiedAt: new Date().toISOString(),
      verificationStatus: isBypassed ? 'bypassed_env' : 'verified'
    };

    if (onSave) onSave(payload);
    alert(`Customer / Buyer "${formData.name}" registered successfully!`);
    onClose();
  };

  const cleanPhone = extract10DigitPhone(formData.phone);
  const isPhoneReady = isValidIndianMobile(cleanPhone);

  const cleanWa = extract10DigitPhone(formData.whatsapp);
  const isWaReady = isValidIndianMobile(cleanWa);

  // Can submit check when verification is required
  const canSubmit = isBypassed 
    ? (formData.name.trim() && cleanPhone) 
    : (formData.name.trim() && cleanPhone && isPhoneVerified && (isSameAsPhone || isWhatsappVerified));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-md">
        {/* Header */}
        <div className="modal-header-dark">
          <div className="modal-header-icon-row">
            <div className="modal-header-icon" style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
              <Building size={16} />
            </div>
            <div>
              <h2 className="modal-title">Add New Customer / Buyer</h2>
              <p className="modal-subtitle">Register buyer or wholesale distributor in ERP directory</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body Form */}
        <form className="modal-body" onSubmit={handleSubmit}>
          {/* Row 1: Name and Category */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Customer / Company Name <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. ABC Marine Traders"
                value={formData.name}
                onChange={e => handleChange('name', e.target.value)}
                required
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Category / Sector <span className="req">*</span></label>
              <select
                className="mform-select"
                value={formData.category}
                onChange={e => handleChange('category', e.target.value)}
                required
              >
                <option value="Marine & Fishing Supplies">Marine &amp; Fishing Supplies</option>
                <option value="Agricultural & Packaging Ropes">Agricultural &amp; Packaging Ropes</option>
                <option value="Hardware & Industrial Wholesale">Hardware &amp; Industrial Wholesale</option>
                <option value="Export & Shipping Supplies">Export &amp; Shipping Supplies</option>
              </select>
            </div>
          </div>

          {/* Row 2: Contact Person & City */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">Contact Person / Manager</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Capt. Roy / Mr. Sharma"
                value={formData.contactPerson}
                onChange={e => handleChange('contactPerson', e.target.value)}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">City / Destination <span className="req">*</span></label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. Veraval, Gujarat"
                value={formData.location}
                onChange={e => handleChange('location', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Row 3: Primary Contact Phone */}
          <div className="mform-field">
            <label className="mform-label">
              Contact Phone Number <span className="req">*</span>
            </label>
            <div className="mform-phone-group">
              <div className={`mform-phone-input-wrap ${(!isBypassed && isPhoneVerified) ? 'is-verified' : ''}`}>
                <span className="mform-phone-prefix">+91</span>
                <input
                  type="tel"
                  maxLength={10}
                  className="mform-phone-input"
                  placeholder="10-digit mobile (e.g. 9848032119)"
                  value={formData.phone}
                  onChange={e => handleChange('phone', e.target.value.replace(/\D/g, ''))}
                  disabled={!isBypassed && isPhoneVerified}
                  required
                />
              </div>

              {/* OTP controls only shown when NOT bypassed via env */}
              {!isBypassed && (
                !isPhoneVerified ? (
                  <button
                    type="button"
                    className="otp-send-btn"
                    onClick={handleSendPhoneOtp}
                    disabled={!isPhoneReady || phoneLoading}
                  >
                    <ShieldCheck size={14} />
                    {phoneOtpSent ? 'Resend' : 'Send OTP'}
                  </button>
                ) : (
                  <div className="otp-verified-badge">
                    <CheckCircle2 size={15} color="#059669" />
                    <span>Verified</span>
                    <span 
                      className="otp-change-link" 
                      onClick={() => {
                        setIsPhoneVerified(false);
                        setPhoneOtpSent(false);
                        setPhoneOtpCode('');
                        setPhoneOtpStatus({ message: '', type: '' });
                      }} 
                      title="Change phone number"
                    >
                      Change
                    </span>
                  </div>
                )
              )}
            </div>

            {/* Inline OTP Verification Drawer for Phone (only when active) */}
            {!isBypassed && phoneOtpSent && !isPhoneVerified && (
              <div className="otp-verify-drawer">
                <div className="otp-verify-header">
                  <span className="otp-verify-label">
                    <ShieldCheck size={14} color="#0284c7" />
                    Enter 6-digit OTP sent to +91 {cleanPhone}
                  </span>
                  {phoneCountdown > 0 ? (
                    <span className="otp-countdown-text">Resend in {phoneCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      className="otp-action-btn resend"
                      onClick={handleResendPhoneOtp}
                      disabled={phoneLoading}
                    >
                      <RefreshCw size={11} style={{ display: 'inline', marginRight: 3 }} />
                      Resend SMS
                    </button>
                  )}
                </div>

                <div className="otp-controls-row">
                  <input
                    type="text"
                    maxLength={6}
                    className="otp-code-input"
                    placeholder="••••••"
                    value={phoneOtpCode}
                    onChange={e => setPhoneOtpCode(e.target.value.replace(/\D/g, ''))}
                  />
                  <button
                    type="button"
                    className="otp-action-btn verify"
                    onClick={handleVerifyPhoneOtp}
                    disabled={phoneLoading || phoneOtpCode.length < 4}
                  >
                    {phoneLoading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>

                {phoneOtpStatus.message && (
                  <p className={`otp-status-msg ${phoneOtpStatus.type}`}>
                    {phoneOtpStatus.type === 'error' && <AlertCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />}
                    {phoneOtpStatus.message}
                  </p>
                )}

                {isMockMode() && (
                  <p className="otp-status-msg info" style={{ fontSize: '0.72rem', color: '#0369a1' }}>
                    💡 <strong>Test Mode Active:</strong> Use mock code <code>123456</code> to verify immediately.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Row 4: WhatsApp Number Section */}
          <div className="mform-field">
            <label className="whatsapp-toggle-wrap">
              <input
                type="checkbox"
                checked={isSameAsPhone}
                onChange={e => handleToggleSameAsPhone(e.target.checked)}
              />
              <span className="whatsapp-toggle-label">
                <MessageSquare size={13} color="#16a34a" />
                WhatsApp number is same as contact phone {cleanPhone ? `(+91 ${cleanPhone})` : ''}
              </span>
            </label>

            {!isSameAsPhone && (
              <div style={{ marginTop: 10, background: '#f8fafc', padding: '12px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <label className="mform-label">
                  WhatsApp Contact Number <span className="req">*</span>
                </label>
                <div className="mform-phone-group">
                  <div className={`mform-phone-input-wrap ${(!isBypassed && isWhatsappVerified) ? 'is-verified' : ''}`}>
                    <span className="mform-phone-prefix">+91</span>
                    <input
                      type="tel"
                      maxLength={10}
                      className="mform-phone-input"
                      placeholder="Enter 10-digit WhatsApp number"
                      value={formData.whatsapp}
                      onChange={e => handleChange('whatsapp', e.target.value.replace(/\D/g, ''))}
                      disabled={!isBypassed && isWhatsappVerified}
                      required={!isSameAsPhone}
                    />
                  </div>

                  {/* WhatsApp OTP controls only shown when NOT bypassed via env */}
                  {!isBypassed && (
                    !isWhatsappVerified ? (
                      <button
                        type="button"
                        className="otp-send-btn"
                        onClick={handleSendWaOtp}
                        disabled={!isWaReady || waLoading}
                      >
                        <ShieldCheck size={14} />
                        {waOtpSent ? 'Resend' : 'Send OTP'}
                      </button>
                    ) : (
                      <div className="otp-verified-badge">
                        <CheckCircle2 size={15} color="#059669" />
                        <span>Verified</span>
                        <span 
                          className="otp-change-link" 
                          onClick={() => {
                            setIsWhatsappVerified(false);
                            setWaOtpSent(false);
                            setWaOtpCode('');
                            setWaOtpStatus({ message: '', type: '' });
                          }} 
                          title="Change WhatsApp number"
                        >
                          Change
                        </span>
                      </div>
                    )
                  )}
                </div>

                {/* Inline OTP Verification Drawer for WhatsApp (only when active) */}
                {!isBypassed && waOtpSent && !isWhatsappVerified && (
                  <div className="otp-verify-drawer" style={{ background: '#ffffff', marginTop: 10 }}>
                    <div className="otp-verify-header">
                      <span className="otp-verify-label">
                        <MessageSquare size={14} color="#16a34a" />
                        Enter 6-digit OTP sent to WhatsApp mobile +91 {cleanWa}
                      </span>
                      {waCountdown > 0 ? (
                        <span className="otp-countdown-text">Resend in {waCountdown}s</span>
                      ) : (
                        <button
                          type="button"
                          className="otp-action-btn resend"
                          onClick={handleResendWaOtp}
                          disabled={waLoading}
                        >
                          <RefreshCw size={11} style={{ display: 'inline', marginRight: 3 }} />
                          Resend SMS
                        </button>
                      )}
                    </div>

                    <div className="otp-controls-row">
                      <input
                        type="text"
                        maxLength={6}
                        className="otp-code-input"
                        placeholder="••••••"
                        value={waOtpCode}
                        onChange={e => setWaOtpCode(e.target.value.replace(/\D/g, ''))}
                      />
                      <button
                        type="button"
                        className="otp-action-btn verify"
                        onClick={handleVerifyWaOtp}
                        disabled={waLoading || waOtpCode.length < 4}
                      >
                        {waLoading ? 'Verifying...' : 'Verify OTP'}
                      </button>
                    </div>

                    {waOtpStatus.message && (
                      <p className={`otp-status-msg ${waOtpStatus.type}`}>
                        {waOtpStatus.type === 'error' && <AlertCircle size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />}
                        {waOtpStatus.message}
                      </p>
                    )}

                    {isMockMode() && (
                      <p className="otp-status-msg info" style={{ fontSize: '0.72rem', color: '#0369a1' }}>
                        💡 <strong>Test Mode Active:</strong> Use mock code <code>123456</code> to verify immediately.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 5: GSTIN and Payment Terms */}
          <div className="mform-row mform-col-2">
            <div className="mform-field">
              <label className="mform-label">GSTIN Number</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. 24AAABC9912F1Z8"
                value={formData.gst}
                onChange={e => handleChange('gst', e.target.value.toUpperCase())}
              />
            </div>
            <div className="mform-field">
              <label className="mform-label">Payment Terms</label>
              <input
                type="text"
                className="mform-input"
                placeholder="e.g. 30 Days Net"
                value={formData.paymentTerms}
                onChange={e => handleChange('paymentTerms', e.target.value)}
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="mfooter-btn cancel" onClick={onClose}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="mfooter-btn confirm"
              disabled={!canSubmit}
              style={{
                opacity: canSubmit ? 1 : 0.6,
                cursor: canSubmit ? 'pointer' : 'not-allowed'
              }}
            >
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
