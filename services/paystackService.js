const axios = require('axios');
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_c869403811e92b7e632034bd5833823162354197';

exports.processRefund = async (reference, amountNaira = null) => {
  try {
    const payload = { transaction: reference };
    if (amountNaira) {
      payload.amount = Math.round(amountNaira * 100); // Paystack expects amount in kobo
    }
    console.log(`[PAYSTACK REFUND INIT] Ref: ${reference}, Amount (Naira): ${amountNaira || 'FULL'}`);
    const response = await axios.post('https://api.paystack.co/refund', payload, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` }
    });
    console.log(`[PAYSTACK REFUND SUCCESS] Ref: ${reference}`, response.data.data);
    return { success: true, data: response.data.data };
  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    console.error("[PAYSTACK REFUND ERROR] API failure details:", errorDetails);
    return { success: false, message: error.response?.data?.message || error.message };
  }
};
