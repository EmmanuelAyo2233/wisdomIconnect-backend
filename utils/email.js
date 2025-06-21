const {
    nodemailer,
    SMTP_SEVER,
    SMTP_PORT,
    SMTP_EMAIL,
    SMTP_PASSWORD,
} = require("../config/reuseablePackages");

const transporter = nodemailer.createTransport({
    host: SMTP_SEVER,
    port: SMTP_PORT,
    secure: false,
    auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASSWORD,
    },
});

module.exports = { transporter };
