const http = require('http');

// Test the complete auth flow
const baseURL = 'http://localhost:5000/api/v1';

async function makeRequest(method, endpoint, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, baseURL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: JSON.parse(body),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: body,
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function testAuthFlow() {
  console.log('🧪 Testing Auth Flow...\n');

  try {
    // 1. Test login
    console.log('📝 1. Testing LOGIN...');
    const loginRes = await makeRequest('POST', '/auth/login', {
      email: 'mentor1@example.com',
      password: 'password123',
    });
    console.log('   Status:', loginRes.status);
    console.log('   Response:', JSON.stringify(loginRes.body, null, 2));
    
    if (loginRes.status !== 200) {
      console.error('   ❌ Login failed!');
      return;
    }

    const token = loginRes.body.token;
    if (!token) {
      console.error('   ❌ Token not in response!');
      return;
    }
    console.log('   ✅ Token received:', token.substring(0, 20) + '...');

    // 2. Test protected endpoint WITH token
    console.log('\n🔐 2. Testing Protected Endpoint WITH token...');
    const meRes = await makeRequest('GET', '/user/me', null, token);
    console.log('   Status:', meRes.status);
    console.log('   Response:', JSON.stringify(meRes.body, null, 2).substring(0, 200));
    
    if (meRes.status === 200) {
      console.log('   ✅ Protected endpoint works with token!');
    } else {
      console.error('   ❌ Protected endpoint failed with token!');
    }

    // 3. Test protected endpoint WITHOUT token
    console.log('\n❌ 3. Testing Protected Endpoint WITHOUT token (should fail)...');
    const noTokenRes = await makeRequest('GET', '/user/me', null, null);
    console.log('   Status:', noTokenRes.status);
    console.log('   Response:', JSON.stringify(noTokenRes.body, null, 2));
    
    if (noTokenRes.status === 401) {
      console.log('   ✅ Correctly rejected without token!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAuthFlow();
