import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireOtpVerified } from '../middleware/otp.middleware.js';
import {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication,
} from '../controllers/webauthn.controller.js';

const router = express.Router();

router.get('/register-options', authMiddleware, requireOtpVerified, getRegistrationOptions);
router.post('/verify-registration', authMiddleware, requireOtpVerified, verifyRegistration);
router.get('/auth-options', requireOtpVerified, getAuthenticationOptions);
router.post('/verify-authentication', requireOtpVerified, verifyAuthentication);

export default router;
