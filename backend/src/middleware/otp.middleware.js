export function requireOtpVerified(req, res, next) {
  if (!req.session?.otpVerified && !req.session?.pendingWebAuthn) {
    return res.status(403).json({ error: 'OTP verification required before biometric authentication' });
  }

  next();
}
