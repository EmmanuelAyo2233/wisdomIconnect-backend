const axios = require('axios');
exports.processRefund = async (reference, amountNaira) => {
 try {
  if(!process.env.PAYSTACK_SECRET_KEY) throw new Error('Payment configuration missing');
  const response = await axios.post('https://api.paystack.co/refund',{transaction:reference,amount:Math.round(amountNaira*100)},{headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`},timeout:15000});
  return {success:response.data.status===true,data:response.data.data};
 } catch { return {success:false,message:'Refund requires provider reconciliation'}; }
};
