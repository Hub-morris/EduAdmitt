import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

export async function sendMail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: `"eduAdmit" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    console.info('sendMail success:', { to, subject, messageId: info?.messageId });
    return info;
  } catch (err) {
    console.error('sendMail failed:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    // Do not throw — return null so callers can continue and backend doesn't 500
    return null;
  }
}

export default transporter;
