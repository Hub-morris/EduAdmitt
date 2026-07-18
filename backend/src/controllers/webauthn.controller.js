import jwt from 'jsonwebtoken';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import pool from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'eduadmit-dev-secret';
const RP_NAME = process.env.RP_NAME || 'eduAdmit';
const RP_ID = process.env.RP_ID || 'localhost';
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';

function bufferToBase64(buffer) {
  return Buffer.from(buffer).toString('base64');
}

function base64urlToBuffer(base64urlString) {
  const padLength = (4 - (base64urlString.length % 4)) % 4;
  const base64 = `${base64urlString.replace(/-/g, '+').replace(/_/g, '/')}${'='.repeat(padLength)}`;
  return Buffer.from(base64, 'base64');
}

export async function getRegistrationOptions(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const credsResult = await pool.query('SELECT credential_id FROM webauthn_credentials WHERE user_id = $1', [user.id]);

    const options = generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: String(user.id),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials: credsResult.rows.map((row) => ({
        id: Buffer.from(row.credential_id, 'base64'),
        type: 'public-key',
      })),
      authenticatorSelection: {
        userVerification: 'required',
      },
    });

    req.session.currentChallenge = options.challenge;
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate registration options' });
  }
}

export async function verifyRegistration(req, res) {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const expectedChallenge = req.session.currentChallenge;
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Biometric registration failed' });
    }

    const { credentialID, credentialPublicKey, counter, transports } = verification.registrationInfo;

    await pool.query(
      'INSERT INTO webauthn_credentials (user_id, credential_id, credential_public_key, counter, transports) VALUES ($1, $2, $3, $4, $5)',
      [
        user.id,
        bufferToBase64(credentialID),
        bufferToBase64(credentialPublicKey),
        counter,
        JSON.stringify(transports || []),
      ]
    );

    res.json({ verified: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify biometric registration' });
  }
}

export async function getAuthenticationOptions(req, res) {
  try {
    if (!req.session.otpVerified && !req.session.pendingWebAuthn) {
      return res.status(403).json({ error: 'OTP verification required before biometric authentication' });
    }

    const userId = req.session.pendingWebAuthn || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: 'Missing pending authentication session' });
    }

    const credsResult = await pool.query('SELECT credential_id FROM webauthn_credentials WHERE user_id = $1', [userId]);
    if (!credsResult.rows.length) {
      return res.status(400).json({ error: 'No registered biometric credentials found' });
    }

    const options = generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: credsResult.rows.map((row) => ({
        id: Buffer.from(row.credential_id, 'base64'),
        type: 'public-key',
      })),
      userVerification: 'required',
    });

    req.session.currentChallenge = options.challenge;
    res.json(options);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate authentication options' });
  }
}

export async function verifyAuthentication(req, res) {
  try {
    if (!req.session.otpVerified && !req.session.pendingWebAuthn) {
      return res.status(403).json({ error: 'OTP verification required before biometric authentication' });
    }

    const pendingUserId = req.session.pendingWebAuthn;
    const authenticatedUser = req.user;
    const userId = pendingUserId || authenticatedUser?.id;

    if (!userId) {
      return res.status(400).json({ error: 'Missing authentication context' });
    }

    const credentialId = bufferToBase64(base64urlToBuffer(req.body.id));
    const result = await pool.query('SELECT * FROM webauthn_credentials WHERE credential_id = $1', [credentialId]);
    if (!result.rows.length) {
      return res.status(400).json({ error: 'Unknown credential' });
    }

    const credential = result.rows[0];
    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: req.session.currentChallenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: Buffer.from(credential.credential_id, 'base64'),
        credentialPublicKey: Buffer.from(credential.credential_public_key, 'base64'),
        counter: Number(credential.counter),
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ error: 'Biometric verification failed' });
    }

    await pool.query('UPDATE webauthn_credentials SET counter = $1 WHERE id = $2', [verification.authenticationInfo.newCounter, credential.id]);

    if (pendingUserId) {
      const userResult = await pool.query('SELECT id, email, role, full_name FROM users WHERE id = $1', [pendingUserId]);
      if (!userResult.rows.length) {
        return res.status(400).json({ error: 'User not found' });
      }

      const user = userResult.rows[0];
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      delete req.session.pendingWebAuthn;
      delete req.session.otpVerified;
      return res.json({ token, user: { id: user.id, email: user.email, role: user.role, fullName: user.full_name } });
    }

    res.json({ verified: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to verify biometric authentication' });
  }
}
