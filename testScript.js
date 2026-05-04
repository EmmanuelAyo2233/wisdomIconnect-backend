const axios = require('axios');

async function testMe() {
  try {
    // 1. Try to login
    const loginRes = await axios.post('http://localhost:5000/api/v1/auth/login', {
      email: 'emmanuel@example.com', // guess or we can create one
      password: 'password123'
    });
    const token = loginRes.data.token;
    
    // 2. GET /me
    const meRes = await axios.get('http://localhost:5000/api/v1/user/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("SUCCESS:", meRes.data);
  } catch (err) {
    if (err.response) {
      console.log("ERROR STATUS:", err.response.status);
      console.log("ERROR DATA:", err.response.data);
    } else {
      console.log("ERROR:", err.message);
    }
  }
}
testMe();
