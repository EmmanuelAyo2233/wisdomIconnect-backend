require('dotenv').config();
const emailService = require('./services/emailService');

async function test() {
  console.log('Sending test email directly to emmypro200@gmail.com...');
  const result = await emailService.sendEmail({
    to: 'emmypro200@gmail.com',
    subject: 'Wisicom Mentee Notification Test',
    html: '<h2>Test Mentee Notification</h2><p>Hello, this is a direct notification test to verify email delivery to emmypro200@gmail.com.</p>'
  });
  console.log('Send result:', result);
}

test().catch(console.error);
