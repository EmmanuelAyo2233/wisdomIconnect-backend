const { transporter } = require("../utils/email");

async function sendEmail(recipients, subject, message) {
    try {
        const info = await transporter.sendMail({
            from: `"Wisdom Connect <${SMTP_EMAIL}>`,
            to: recipients.map((r) => r.email),
            subject: subject,
            html: `<html><body>Commente: ${message}</body></html>`,
        });
        return { success: true, info };
    } catch (error) {
        return { success: false, error };
    }
}

module.exports = { sendEmail };
