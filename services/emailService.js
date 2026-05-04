const axios = require('axios');

class EmailService {
  async sendEmail({ to, subject, html }) {
    if (!process.env.BREVO_API_KEY) {
      console.warn('BREVO_API_KEY not set in environment variables. Email sending skipped.');
      return false;
    }

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

      console.log('Email sent successfully via Brevo API to:', to);
      return true;
    } catch (error) {
      console.error('Error sending email via Brevo API:', error.response?.data || error.message);
      return false;
    }
  }
}

module.exports = new EmailService();
