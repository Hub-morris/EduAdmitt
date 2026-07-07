import test from 'node:test';
import assert from 'node:assert/strict';
import { isMpesaResultSuccessful, isPaymentSuccessful } from '../src/utils/paymentStatus.js';

test('treats completed payments as successful', () => {
  assert.equal(isPaymentSuccessful({ status: 'completed' }), true);
  assert.equal(isPaymentSuccessful({ status: 'paid' }), true);
});

test('treats successful M-PESA callback payloads as successful', () => {
  assert.equal(
    isPaymentSuccessful({
      status: 'pending',
      provider_payload: {
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
      },
    }),
    true
  );

  assert.equal(
    isPaymentSuccessful({
      status: 'failed',
      provider_payload: {
        ResultCode: '0',
        ResultDesc: 'The service request is processed successfully.',
      },
    }),
    true
  );
});

test('isMpesaResultSuccessful accepts numeric and string zero', () => {
  assert.equal(isMpesaResultSuccessful(0), true);
  assert.equal(isMpesaResultSuccessful('0'), true);
  assert.equal(isMpesaResultSuccessful(1), false);
  assert.equal(isMpesaResultSuccessful('1'), false);
});

test('rejects failed or pending payments without a successful callback', () => {
  assert.equal(isPaymentSuccessful({ status: 'pending' }), false);
  assert.equal(isPaymentSuccessful({ status: 'failed' }), false);
  assert.equal(
    isPaymentSuccessful({
      status: 'failed',
      provider_payload: { ResultCode: 1, ResultDesc: 'Failed' },
    }),
    false
  );
});
