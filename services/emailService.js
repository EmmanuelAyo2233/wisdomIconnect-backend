const axios = require('axios');
const nodemailer = require('nodemailer');

class EmailService {
  async sendEmail({ to, subject, html }) {
    // 1. Try Brevo API if key is present
    if (process.env.BREVO_API_KEY) {
      try {
        const payload = {
          sender: {
            name: "Wisicom",
            email: process.env.SMTP_EMAIL || "wisdomiconnect@gmail.com"
          },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html
        };

        await axios.post('https://api.brevo.com/v3/smtp/email', payload, {
          timeout:15000,
          headers: {
            'accept': 'application/json',
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json'
          }
        });

        return true;
      } catch (error) {
        require('../utils/logger').error('⚠️ Error sending email via Brevo API:', error.response?.data || error.message);
        console.log('Attempting fallback via Nodemailer/SMTP...');
      }
    }

    // 2. Fallback to Nodemailer SMTP (e.g. Brevo SMTP / Gmail)
    const smtpEmail = process.env.SMTP_EMAIL || process.env.GMAIL_USER;
    const smtpPass = process.env.SMTP_PASSWORD || process.env.GMAIL_PASS;
    const smtpHost = process.env.SMTP_SERVER || process.env.SMTP_SEVER || 'smtp-relay.brevo.com';
    const smtpPort = Number(process.env.SMTP_PORT) || 587;

    if (smtpEmail && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          connectionTimeout:15000,greetingTimeout:15000,socketTimeout:20000,
          port: smtpPort,
          secure: smtpPort === 465, // true for 465, false for 587 / 2525
          auth: {
            user: smtpEmail,
            pass: smtpPass
          },
          tls: {
            rejectUnauthorized: true
          }
        });

        await transporter.sendMail({
          from: `"Wisicom" <${smtpEmail}>`,
          to: to,
          subject: subject,
          html: html
        });

        return true;
      } catch (error) {
        require('../utils/logger').error('❌ Error sending email via Nodemailer/SMTP:', error.message);
        return false;
      }
    }

    // 3. If no credentials provided, log email details in development mode
    require('../utils/logger').warn(`⚠️ [EMAIL SKIPPED] Neither BREVO_API_KEY nor SMTP credentials (SMTP_EMAIL / SMTP_PASSWORD) are set in .env.`);
    return false;
  }
}

module.exports = new EmailService();
