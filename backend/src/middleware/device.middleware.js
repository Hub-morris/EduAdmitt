import pool from '../config/db.js';
import { sendMail } from '../config/mailer.js';

export async function checkDevice(req, res, next) {
  const { fingerprint } = req.body;
  const user = req.user;

  if (!user) {
    return res.status(401).json({ error: 'Authentication required for device check' });
  }

  if (!fingerprint) {
    return res.status(400).json({ error: 'Missing device fingerprint' });
  }

  const knownDevice = await pool.query(
    'SELECT id FROM devices WHERE user_id = $1 AND fingerprint = $2',
    [user.id, fingerprint]
  );

  if (!knownDevice.rows.length) {
    await pool.query(
      'INSERT INTO devices (user_id, fingerprint, first_seen, last_seen) VALUES ($1, $2, NOW(), NOW())',
      [user.id, fingerprint]
    );

    await sendMail(
      user.email,
      'New device login detected — eduAdmit',
      `<p>A login was just made from a device we haven't seen before. If this wasn't you, please reset your password immediately.</p>`
    );

    req.isNewDevice = true;
  } else {
    await pool.query('UPDATE devices SET last_seen = NOW() WHERE id = $1', [knownDevice.rows[0].id]);
  }

  next();
}
