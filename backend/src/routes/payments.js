import express from 'express';
import pool from '../config/db.js';
import { authMiddleware, adminMiddleware, studentMiddleware } from '../middleware/auth.js';

const router = express.Router();

const normalizePhone = (phone) => {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('254')) return cleaned;
  if (cleaned.startsWith('0')) return `254${cleaned.slice(1)}`;
  return cleaned;
};

const getMpesaConfig = () => ({
  consumerKey: process.env.MPESA_CONSUMER_KEY,
  consumerSecret: process.env.MPESA_CONSUMER_SECRET,
  shortcode: process.env.MPESA_SHORTCODE,
  passkey: process.env.MPESA_PASSKEY,
  env: process.env.MPESA_ENV || 'sandbox',
  callbackUrl: process.env.MPESA_CALLBACK_URL,
});

const getMpesaAccessToken = async (config) => {
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
  const baseUrl = config.env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
  const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || 'Failed to obtain M-PESA access token');
  }
  return payload.access_token;
};

const getMpesaTimestamp = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

const updateApplicationPaymentState = async (applicationId, paymentStatus, rejectionReason = null) => {
  if (!applicationId) return;
  await pool.query(
    `UPDATE applications SET payment_status = $1, payment_rejection_reason = $2, updated_at = NOW() WHERE id = $3`,
    [paymentStatus, rejectionReason || null, applicationId]
  );
};

const initiateMpesaStkPush = async (payment, phone, req) => {
  const config = getMpesaConfig();
  if (!config.consumerKey || !config.consumerSecret || !config.shortcode || !config.passkey) {
    throw new Error('M-PESA provider credentials are not configured.');
  }

  const token = await getMpesaAccessToken(config);
  const phoneNumber = normalizePhone(phone);
  if (!phoneNumber) throw new Error('A valid phone number is required.');

  const timestamp = getMpesaTimestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${timestamp}`).toString('base64');
  const callbackBaseUrl = config.callbackUrl || `${req.protocol}://${req.get('host')}/api/payments/callback`;
  const callbackUrl = callbackBaseUrl.includes('?')
    ? `${callbackBaseUrl}&paymentId=${payment.id}`
    : `${callbackBaseUrl}?paymentId=${payment.id}`;
  const amount = String(Math.round(Number(payment.amount || 0)));

  const baseUrl = config.env === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

  const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
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

// Create a payment reference for an application or a programme
router.post('/', authMiddleware, studentMiddleware, async (req, res) => {
  try {
    const { applicationId, amount, currency, provider } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount is required' });

    const reference = `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const result = await pool.query(
      `INSERT INTO payments (application_id, reference, amount, currency, provider, provider_payload, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, reference, amount, currency, status`,
      [applicationId || null, reference, amount, currency || 'KES', provider || null, null, 'pending']
    );

    const payment = result.rows[0];

    res.status(201).json({
      paymentId: payment.id,
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Initiate an STK push request through the configured payment provider.
router.post('/:id/stk-push', authMiddleware, studentMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { phone } = req.body;
    const payRes = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (!payRes.rows.length) return res.status(404).json({ error: 'Payment not found' });

    const payment = payRes.rows[0];
    const providerResponse = await initiateMpesaStkPush(payment, phone, req);

    const providerPayload = {
      phone,
      transaction: providerResponse.MerchantRequestID || `STK-${Date.now()}`,
      reference: payment.reference,
      amount: payment.amount,
      method: 'M-PESA',
      time: new Date().toISOString(),
      status: 'initiated',
      providerResponse,
    };

    await pool.query(
      'UPDATE payments SET status = $1, provider = $2, provider_payload = $3, updated_at = NOW() WHERE id = $4',
      ['pending', 'mpesa', providerPayload, id]
    );

    res.json({ initiated: true, provider: 'mpesa', reference: payment.reference, amount: payment.amount, providerResponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Failed to initiate M-PESA payment' });
  }
});

// Provider callback endpoint for successful payment confirmation.
router.post('/:id/confirm', async (req, res) => {
  try {
    const { id } = req.params;
    const payRes = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (!payRes.rows.length) return res.status(404).json({ error: 'Payment not found' });

    await pool.query('UPDATE payments SET status = $1, provider_payload = $2, updated_at = NOW() WHERE id = $3', ['completed', req.body || {}, id]);

    const pay = payRes.rows[0];
    if (pay.application_id) {
      await updateApplicationPaymentState(pay.application_id, 'paid');
    }

    res.json({ message: 'Payment marked as completed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to mark payment' });
  }
});

router.patch('/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const payRes = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (!payRes.rows.length) return res.status(404).json({ error: 'Payment not found' });

    const pay = payRes.rows[0];
    await pool.query('UPDATE payments SET status = $1, updated_at = NOW() WHERE id = $2', ['completed', id]);
    if (pay.application_id) {
      await updateApplicationPaymentState(pay.application_id, 'paid', null);
    }

    res.json({ message: 'Payment approved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to approve payment' });
  }
});

router.patch('/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const payRes = await pool.query('SELECT * FROM payments WHERE id = $1', [id]);
    if (!payRes.rows.length) return res.status(404).json({ error: 'Payment not found' });

    const pay = payRes.rows[0];
    await pool.query('UPDATE payments SET status = $1, provider_payload = $2, updated_at = NOW() WHERE id = $3', ['failed', { rejectionReason: reason || 'Payment rejected by admin' }, id]);
    if (pay.application_id) {
      await updateApplicationPaymentState(pay.application_id, 'failed', reason || 'Payment rejected by admin');
    }

    res.json({ message: 'Payment rejected' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reject payment' });
  }
});

// Get payment status
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT id, reference, amount, currency, status, provider_payload, created_at FROM payments WHERE id = $1', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Payment not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// M-PESA / provider callback endpoint
router.post('/callback', async (req, res) => {
  try {
    const paymentId = req.query.paymentId;
    const body = req.body;
    const callbackBody = body?.Body?.stkCallback || body;
    const resultCode = callbackBody?.ResultCode;
    const status = resultCode === 0 ? 'completed' : 'failed';

    let paymentRes = { rows: [] };
    if (paymentId) {
      paymentRes = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    }

    if (!paymentRes.rows.length) {
      const accountReference = callbackBody?.CallbackMetadata?.Item?.find((item) => item.Name === 'AccountReference')?.Value
        || callbackBody?.AccountReference
        || callbackBody?.Body?.stkCallback?.CallbackMetadata?.Item?.find((item) => item.Name === 'AccountReference')?.Value
        || callbackBody?.Body?.stkCallback?.AccountReference;

      if (accountReference) {
        paymentRes = await pool.query('SELECT * FROM payments WHERE reference = $1 ORDER BY created_at DESC LIMIT 1', [accountReference]);
      }
    }

    if (!paymentRes.rows.length && callbackBody?.MerchantRequestID) {
      paymentRes = await pool.query(
        `SELECT * FROM payments WHERE provider_payload->'providerResponse'->>'MerchantRequestID' = $1 LIMIT 1`,
        [callbackBody.MerchantRequestID]
      );
    }

    if (!paymentRes.rows.length && callbackBody?.CheckoutRequestID) {
      paymentRes = await pool.query(
        `SELECT * FROM payments WHERE provider_payload->'providerResponse'->>'CheckoutRequestID' = $1 LIMIT 1`,
        [callbackBody.CheckoutRequestID]
      );
    }

    if (paymentRes.rows.length) {
      const pay = paymentRes.rows[0];
      await pool.query('UPDATE payments SET provider_payload = $1, status = $2, updated_at = NOW() WHERE id = $3', [callbackBody, status, pay.id]);
      if (pay.application_id) {
        await updateApplicationPaymentState(pay.application_id, status === 'completed' ? 'paid' : 'failed', status === 'failed' ? 'Payment verification failed' : null);
      }
    } else {
      console.log('Callback received but no payment matched', callbackBody);
    }

    res.json({ received: true, status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Callback handling failed' });
  }
});

export default router;
