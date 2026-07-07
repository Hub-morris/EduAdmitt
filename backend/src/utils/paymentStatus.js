const SUCCESS_STATUSES = new Set(['completed', 'paid', 'success']);

export function isMpesaResultSuccessful(resultCode) {
  if (resultCode === 0 || resultCode === '0') return true;
  return String(resultCode).trim() === '0';
}

export function isPaymentSuccessful(payment) {
  if (!payment) return false;

  const status = String(payment.status || '').toLowerCase();
  if (SUCCESS_STATUSES.has(status)) return true;

  const providerPayload = payment.provider_payload;
  if (!providerPayload) return false;

  const resultCode = providerPayload.ResultCode
    ?? providerPayload?.Body?.stkCallback?.ResultCode
    ?? providerPayload?.providerResponse?.ResultCode;

  return isMpesaResultSuccessful(resultCode);
}
