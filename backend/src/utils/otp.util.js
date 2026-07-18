import crypto from 'crypto';

export const OTP_EXPIRY_MINUTES = 10;
export const MAX_OTP_ATTEMPTS = 5;

export function createOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}
