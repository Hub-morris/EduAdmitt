import SibApiV3Sdk from 'sib-api-v3-sdk';

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendMail({ to, subject, html }: MailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    await emailApi.sendTransacEmail({
      sender: {
        email: process.env.EMAIL_FROM,
        name: process.env.EMAIL_FROM_NAME || 'eduAdmit',
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });
    console.log(`Email sent successfully to ${to}`);
    return { success: true };
  } catch (err: any) {
    console.error(`Brevo send failed for ${to}:`, err?.message || err);
    return { success: false, error: err?.message || 'Unknown error' };
  }
}
