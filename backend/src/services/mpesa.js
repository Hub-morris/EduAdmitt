const MPESA_BASE_URLS = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke',
};

export const getMpesaConfig = () => ({
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  shortcode: process.env.MPESA_SHORTCODE,
  passkey: process.env.MPESA_PASSKEY,
  env: process.env.MPESA_ENV || 'sandbox',
  callbackUrl: process.env.MPESA_CALLBACK_URL,
});

export const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('254')) return cleaned;
  if (cleaned.startsWith('0')) return `254${cleaned.slice(1)}`;
  return cleaned;
};

export const getMpesaTimestamp = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const getBaseUrl = (env) => MPESA_BASE_URLS[env === 'production' ? 'production' : 'sandbox'];

export const getMpesaAccessToken = async (config = getMpesaConfig()) => {
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
  const response = await fetch(`${getBaseUrl(config.env)}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || 'Failed to obtain M-PESA access token');
  }
  return payload.access_token;
};

export const buildMpesaPassword = (config, timestamp) =>
  Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString('base64');

export const getCheckoutRequestId = (payment) =>
  payment?.provider_payload?.providerResponse?.CheckoutRequestID
  || payment?.provider_payload?.CheckoutRequestID
  || payment?.provider_payload?.queryResponse?.CheckoutRequestID;

export const isMpesaStillProcessing = (resultCode) => {
  const code = String(resultCode ?? '').trim();
  return code === '4999' || code === '1037';
};

export const queryMpesaStkStatus = async (checkoutRequestId, config = getMpesaConfig()) => {
  if (!config.consumerKey || !config.consumerSecret || !config.shortcode || !config.passkey) {
    throw new Error('M-PESA provider credentials are not configured.');
  }
  if (!checkoutRequestId) {
    throw new Error('CheckoutRequestID is required to query M-PESA payment status.');
  }

  const token = await getMpesaAccessToken(config);
  const timestamp = getMpesaTimestamp();
  const password = buildMpesaPassword(config, timestamp);

  const response = await fetch(`${getBaseUrl(config.env)}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.errorMessage || payload.error || 'Failed to query M-PESA payment status');
  }

  return payload;
};

export const initiateMpesaStkPush = async (payment, phone, req) => {
  const config = getMpesaConfig();
  if (!config.consumerKey || !config.consumerSecret || !config.shortcode || !config.passkey) {
    throw new Error('M-PESA provider credentials are not configured.');
  }

  const token = await getMpesaAccessToken(config);
  const phoneNumber = normalizePhone(phone);
  if (!phoneNumber) throw new Error('A valid phone number is required.');

  const timestamp = getMpesaTimestamp();
  const password = buildMpesaPassword(config, timestamp);
  const callbackBaseUrl = config.callbackUrl || `${req.protocol}://${req.get('host')}/api/payments/callback`;
  const callbackUrl = callbackBaseUrl.includes('?')
    ? `${callbackBaseUrl}&paymentId=${payment.id}`
    : `${callbackBaseUrl}?paymentId=${payment.id}`;
  const amount = String(Math.round(Number(payment.amount || 0)));

  const response = await fetch(`${getBaseUrl(config.env)}/mpesa/stkpushquery/v1/processrequest`.replace('stkpushquery', 'stkpush'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: config.shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: config.shortcode,
      PhoneNumber: phoneNumber,
      CallBackURL: callbackUrl,
      AccountReference: payment.reference,
      TransactionDesc: 'EduAdmit application fee',
    }),
  });

  const payload = await response.json();
  if (!response.ok || payload.ResponseCode !== '0') {
    throw new Error(payload.errorMessage || payload.ResponseDescription || 'M-PESA STK push request failed');
  }

  return payload;
};
