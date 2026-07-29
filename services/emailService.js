const axios = require('axios');
const nodemailer = require('nodemailer');

class EmailService {
  async sendEmail({ to, subject, html }) {
    // 1. Try Brevo API if key is present
    if (process.env.BREVO_API_KEY) {
      try {
        const payload = {
          sender: {
            name: "WisdomIconnect",
            email: process.env.SMTP_EMAIL || "wisdomiconnect@gmail.com"
          },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html
        };

        await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
          headers: {
            'accept': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json'
          }
        });

        console.log('✅ Email sent successfully via Brevo API to:', to);
        return true;
      } catch (error) {
        console.error('⚠️ Error sending email via Brevo API:', error.response?.data || error.message);
        console.log('Attempting fallback via Nodemailer/SMTP...');
      }
    }

    // 2. Fallback to Nodemailer SMTP (e.g. Gmail)
    const smtpEmail = process.env.SMTP_EMAIL || process.env.GMAIL_USER;
    const smtpPass = process.env.SMTP_PASSWORD || process.env.GMAIL_PASS;

    if (smtpEmail && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_SERVER || process.env.SMTP_SEVER || 'smtp.gmail.com',
          port: Number(process.env.SMTP_PORT) || 465,
          secure: Number(process.env.SMTP_PORT) === 465 || !process.env.SMTP_PORT, // true for 465
          auth: {
            user: smtpEmail,
            pass: smtpPass
          }
        });

        await transporter.sendMail({
          from: `"WisdomIconnect" <${smtpEmail}>`,
          to: to,
          subject: subject,
          html: html
        });

        console.log('✅ Email sent successfully via Nodemailer/SMTP to:', to);
        return true;
      } catch (error) {
        console.error('❌ Error sending email via Nodemailer/SMTP:', error.message);
        return false;
      }
    }

    // 3. If no credentials provided, log email details in development mode
    console.warn(`⚠️ [EMAIL SKIPPED] Neither BREVO_API_KEY nor SMTP credentials (SMTP_EMAIL / SMTP_PASSWORD) are set in .env.`);
    console.log(`📧 [EMAIL PREVIEW] To: ${to} | Subject: "${subject}"`);
    return false;
  }
}

module.exports = new EmailService();
