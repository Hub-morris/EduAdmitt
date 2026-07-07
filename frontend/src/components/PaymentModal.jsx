import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import api from '../api/client';
import './PaymentModal.css';

function isPaymentCompleted(data) {
  if (!data) return false;
  const status = String(data.status || '').toLowerCase();
  if (['completed', 'paid', 'success'].includes(status)) return true;

  const payload = data.provider_payload;
  if (!payload) return false;

  const resultCode = payload.ResultCode
    ?? payload?.Body?.stkCallback?.ResultCode
    ?? payload?.providerResponse?.ResultCode;

  return resultCode === 0 || resultCode === '0';
}

export default function PaymentModal({ amount, reference, programme, paymentId, onCancel, onConfirm }) {
  const [phone, setPhone] = useState('');
  const [phase, setPhase] = useState('ready'); // ready | waiting | success | error
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState('');

  const fetchPaymentStatus = async () => {
    const statusRes = await api.get(`/payments/${paymentId}`);
    return statusRes.data;
  };

  const handleStatusUpdate = async (data) => {
    if (isPaymentCompleted(data)) {
      setReceipt(data.provider_payload || { reference, amount, method: 'M-PESA' });
      setPhase('success');
      setTimeout(() => onConfirm(data.provider_payload || {}), 800);
      return true;
    }
    if (data.status === 'failed') {
      setPhase('error');
      const providerPayload = data.provider_payload || {};
      const backendMessage = providerPayload?.Body?.stkCallback?.ResultDesc
        || providerPayload?.ResultDesc
        || providerPayload?.error
        || 'Payment failed';
      setError(backendMessage);
      return true;
    }
    return false;
  };

  const confirmPaymentManually = async () => {
    try {
      setError('');
      await api.post(`/payments/${paymentId}/confirm`, {});
      const data = await fetchPaymentStatus();
      await handleStatusUpdate(data);
      if (!isPaymentCompleted(data)) {
        setError('Manual confirmation did not complete the payment. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to confirm payment manually');
    }
  };

  const sendStk = async () => {
    if (!phone) return setError('Enter phone number');
    setError('');
    setPhase('waiting');
    try {
      await api.post(`/payments/${paymentId}/stk-push`, { phone });

      const start = Date.now();
      const timeout = 60000; // 60s
      const pollInterval = 2000;

      const poll = setInterval(async () => {
        try {
          const data = await fetchPaymentStatus();
          const finished = await handleStatusUpdate(data);
          if (finished) {
            clearInterval(poll);
            return;
          }
          if (Date.now() - start > timeout) {
            clearInterval(poll);
            setPhase('error');
            setError('Payment confirmation timed out');
          }
        } catch (err) {
          console.error(err);
          clearInterval(poll);
          setPhase('error');
          setError('Unable to refresh payment status. Please try again.');
        }
      }, pollInterval);
    } catch (err) {
      console.error(err);
      setPhase('error');
      setError(err.response?.data?.error || 'Failed to initiate STK push');
    }
  };

  const refreshStatus = async () => {
    try {
      setError('');
      const data = await fetchPaymentStatus();
      const finished = await handleStatusUpdate(data);
      if (!finished) {
        setError('Payment still pending. Please check your phone and try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Unable to refresh payment status. Please try again.');
    }
  };

  return (
    <div className="modal-backdrop">
      <motion.div className="modal" initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
        <div className="header-accent">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '.9rem', color: '#2b6b2f' }}>Secure Payment</div>
              <div className="amount">KES {Number(amount).toFixed(2)}</div>
            </div>
            <div>
              <img src="/mpesa-logo.svg" alt="M-PESA" style={{ height: 28 }} onError={(e) => e.target.remove()} />
            </div>
          </div>
        </div>
        {phase === 'ready' && (
          <div className="modal-content">
            <h3>Pay Application Fee</h3>
            <p>Do you want to pay KES 1 to EduAdmit? Complete the payment securely using your M-PESA account. After you tap Send STK Push, you will receive a prompt on your phone. Enter your PIN to approve the payment and the system will confirm it automatically.</p>
            <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'6px 10px', borderRadius:'999px', background:'#ecfdf3', color:'#166534', fontSize:'0.84rem', fontWeight:600, marginBottom:'12px' }}>
              <span>●</span> Secure STK payment
            </div>
            <div className="form-row">
              <input className="form-input" placeholder="+2547XXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="payment-info">
              <div className="payment-chip">
                <span className="payment-chip-label">Programme</span>
                <span>{programme}</span>
              </div>
              <div className="payment-chip">
                <span className="payment-chip-label">Amount</span>
                <span>KES {Number(amount).toFixed(2)}</span>
              </div>
              {reference && <div className="payment-chip">
                <span className="payment-chip-label">Reference</span>
                <span>{reference}</span>
              </div>}
            </div>
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
              <button className="btn btn-primary" onClick={sendStk}>Send STK Push</button>
            </div>
          </div>
        )}

        {phase === 'waiting' && (
          <div className="modal-content center">
            <h3>Waiting for payment confirmation</h3>
            <p>An STK push has been sent to {phone}. Enter your M-PESA PIN on your phone to complete payment. The callback from Safaricom will confirm the result automatically.</p>
            <div className="spinner" style={{ margin: '1rem auto' }} />
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={refreshStatus}>Refresh status</button>
              <button className="btn btn-secondary" onClick={confirmPaymentManually}>Confirm manually</button>
              <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        )}

        {phase === 'success' && receipt && (
          <div className="modal-content success">
            <h3>Payment Successful!</h3>
            <p>Your application fee has been paid successfully.</p>
            <div className="receipt">
              <div className="receipt-row">
                <span className="receipt-label">Amount Paid</span>
                <span className="receipt-value">KES {Number(receipt.amount).toFixed(2)}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Receipt</span>
                <span className="receipt-value">{receipt.transaction}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Method</span>
                <span className="receipt-value">{receipt.method}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Reference</span>
                <span className="receipt-value">{receipt.reference}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-label">Time</span>
                <span className="receipt-value">{new Date(receipt.time).toLocaleString()}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={onCancel}>Close</button>
            </div>
          </div>
        )}
        {phase === 'error' && (
          <div className="modal-content">
            <h3>Payment Error</h3>
            <p style={{ color: 'var(--danger)' }}>{error || 'An error occurred during payment.'}</p>
            <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-secondary" onClick={confirmPaymentManually}>Confirm manually</button>
              <button className="btn btn-secondary" onClick={onCancel}>Close</button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
