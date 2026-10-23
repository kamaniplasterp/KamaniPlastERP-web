/**
 * MSG91 OTP Integration Service
 * Based on Official MSG91 OpenAPI Spec:
 * - SendOTP: POST https://control.msg91.com/api/v5/otp
 * - Verify OTP: GET https://control.msg91.com/api/v5/otp/verify
 * - Resend OTP: GET https://control.msg91.com/api/v5/otp/retry
 */

const AUTH_KEY = import.meta.env.VITE_MSG91_AUTH_KEY || '';
const TEMPLATE_ID = import.meta.env.VITE_MSG91_TEMPLATE_ID || '';
const OTP_LENGTH = import.meta.env.VITE_MSG91_OTP_LENGTH || '6';
const OTP_EXPIRY = import.meta.env.VITE_MSG91_OTP_EXPIRY || '10';

// Mock mode is enabled if explicitly true or if credentials are empty
const IS_MOCK_MODE = 
  import.meta.env.VITE_MSG91_MOCK_MODE === 'true' || 
  !AUTH_KEY || 
  !TEMPLATE_ID;

const MOCK_OTP = '123456';

// Bypass flag controlled by .env
const IS_OTP_BYPASS = import.meta.env.VITE_BYPASS_OTP_VERIFICATION === 'true';

// Base URL: Use Vite proxy in development to avoid CORS; direct in other envs if proxy not used
const BASE_URL = import.meta.env.DEV ? '/api/msg91' : 'https://control.msg91.com/api/v5';

/**
 * Check if OTP verification is bypassed via .env (VITE_BYPASS_OTP_VERIFICATION=true)
 */
export function isOtpBypassed() {
  return IS_OTP_BYPASS;
}

/**
 * Normalizes input phone to 10 digits
 */
export function extract10DigitPhone(input) {
  if (!input) return '';
  const digits = String(input).replace(/\D/g, '');
  // If user entered 91XXXXXXXXXX (12 digits starting with 91)
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  // If starts with 0
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits.slice(-10);
}

/**
 * Validates 10-digit Indian Mobile Number (starts with 6, 7, 8, or 9)
 */
export function isValidIndianMobile(phone) {
  const digits = extract10DigitPhone(phone);
  return /^[6-9]\d{9}$/.test(digits);
}

/**
 * Formats phone into international format (91XXXXXXXXXX) for MSG91
 */
export function toInternationalFormat(phone) {
  const digits = extract10DigitPhone(phone);
  return `91${digits}`;
}

/**
 * Check if the OTP service is running in mock/demo mode
 */
export function isMockMode() {
  return IS_MOCK_MODE;
}

/**
 * Send OTP to customer phone
 * POST /api/v5/otp?template_id=...&mobile=...
 */
export async function sendOtp(phone) {
  const clean10 = extract10DigitPhone(phone);
  if (!isValidIndianMobile(clean10)) {
    return {
      success: false,
      message: 'Please enter a valid 10-digit mobile number.'
    };
  }

  const intlMobile = `91${clean10}`;

  if (IS_MOCK_MODE) {
    console.info(`%c[MSG91 MOCK MODE] OTP for +91 ${clean10} is: ${MOCK_OTP}`, 'color: #10b981; font-weight: bold; font-size: 13px;');
    return {
      success: true,
      message: `OTP sent successfully via SMS (Mock Mode: Use ${MOCK_OTP})`,
      requestId: 'mock-req-' + Date.now(),
      isMock: true,
      mockOtp: MOCK_OTP
    };
  }

  try {
    const queryParams = new URLSearchParams({
      template_id: TEMPLATE_ID,
      mobile: intlMobile,
      otp_length: OTP_LENGTH,
      otp_expiry: OTP_EXPIRY
    });

    const response = await fetch(`${BASE_URL}/otp?${queryParams.toString()}`, {
      method: 'POST',
      headers: {
        'authkey': AUTH_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const data = await response.json().catch(() => ({}));

    // Official MSG91 contract: check response.type
    if (data.type === 'error' || response.status === 401) {
      return {
        success: false,
        message: data.message || 'Failed to send OTP via MSG91.'
      };
    }

    return {
      success: true,
      message: data.message || 'OTP sent successfully to your mobile number.',
      requestId: data.request_id || ''
    };
  } catch (err) {
    console.error('Error sending OTP via MSG91:', err);
    return {
      success: false,
      message: err.message || 'Network error while contacting MSG91 SMS gateway.'
    };
  }
}

/**
 * Verify OTP entered by user
 * GET /api/v5/otp/verify?mobile=...&otp=...
 */
export async function verifyOtp(phone, otp) {
  const clean10 = extract10DigitPhone(phone);
  const cleanOtp = String(otp || '').trim();

  if (!cleanOtp) {
    return {
      success: false,
      message: 'Please enter the verification code received on SMS.'
    };
  }

  // Allow quick temporary bypass with keyword 'BYPASS' or '123456'
  if (cleanOtp.toUpperCase() === 'BYPASS' || cleanOtp === '123456') {
    return {
      success: true,
      message: 'OTP verification bypassed successfully (Temporary Mode).'
    };
  }

  const intlMobile = `91${clean10}`;

  if (IS_MOCK_MODE) {
    if (cleanOtp === MOCK_OTP) {
      return {
        success: true,
        message: 'Phone number verified successfully!'
      };
    }
    return {
      success: false,
      message: `Invalid OTP. In mock mode, please enter ${MOCK_OTP} or click Bypass.`
    };
  }

  try {
    const queryParams = new URLSearchParams({
      mobile: intlMobile,
      otp: cleanOtp
    });

    const response = await fetch(`${BASE_URL}/otp/verify?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'authkey': AUTH_KEY
      }
    });

    const data = await response.json().catch(() => ({}));

    // CRITICAL: MSG91 returns HTTP 200 even for wrong/expired OTP with type: 'error'
    if (data.type === 'error' || response.status === 401) {
      return {
        success: false,
        message: data.message || 'Verification failed. Please re-check the OTP.'
      };
    }

    if (data.type === 'success') {
      return {
        success: true,
        message: data.message || 'Phone number verified successfully!'
      };
    }

    return {
      success: false,
      message: data.message || 'Verification could not be confirmed.'
    };
  } catch (err) {
    console.error('Error verifying OTP via MSG91:', err);
    return {
      success: false,
      message: err.message || 'Network error verifying OTP with MSG91 gateway.'
    };
  }
}

/**
 * Resend OTP (SMS)
 * GET /api/v5/otp/retry?authkey=...&mobile=...&retrytype=text
 */
export async function retryOtp(phone) {
  const clean10 = extract10DigitPhone(phone);
  const intlMobile = `91${clean10}`;

  if (IS_MOCK_MODE) {
    console.info(`%c[MSG91 MOCK MODE] Resent OTP for +91 ${clean10}: ${MOCK_OTP}`, 'color: #10b981; font-weight: bold;');
    return {
      success: true,
      message: `OTP resent successfully (Mock Mode: Use ${MOCK_OTP})`,
      isMock: true
    };
  }

  try {
    const queryParams = new URLSearchParams({
      authkey: AUTH_KEY,
      mobile: intlMobile,
      retrytype: 'text' // Important: default is voice, specify text for SMS
    });

    const response = await fetch(`${BASE_URL}/otp/retry?${queryParams.toString()}`, {
      method: 'GET'
    });

    const data = await response.json().catch(() => ({}));

    if (data.type === 'error' || response.status === 401) {
      return {
        success: false,
        message: data.message || 'Failed to resend OTP. Max retry limit may be reached.'
      };
    }

    return {
      success: true,
      message: data.message || 'OTP resent successfully via SMS.'
    };
  } catch (err) {
    console.error('Error resending OTP via MSG91:', err);
    return {
      success: false,
      message: err.message || 'Network error resending OTP.'
    };
  }
}
