const http = require('http');
const { User, Mentee } = require('./models');

const baseURL = 'http://localhost:5001/api/v1';

async function makeRequest(method, endpoint, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseURL + endpoint);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body),
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
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
  console.log('🧪 Testing HttpOnly Cookie Auth Flow...\n');
  const email = `testuser-${Date.now()}@example.com`;
  const password = 'password123';
  const name = 'Test Cookie User';

  try {
    // 1. Register a new Mentee
    console.log(`📝 1. Registering user ${email}...`);
    const registerRes = await makeRequest('POST', '/auth/register', {
      name,
      email,
      password,
      confirmPassword: password,
      userType: 'mentee',
      interests: ['Guidance in Web Development']
    });

    console.log('   Status:', registerRes.status);
    if (registerRes.status !== 201) {
      console.error('   ❌ Registration failed:', registerRes.body);
      return;
    }
    console.log('   ✅ Registration successful.');

    // 2. Fetch OTP from DB
    console.log('🔍 2. Retrieving verification OTP from database...');
    const user = await User.findOne({ where: { email } });
    if (!user) {
      console.error('   ❌ User not found in DB!');
      return;
    }
    const otp = user.verificationToken;
    console.log('   ✅ Found OTP:', otp);

    // 3. Verify Email and get cookie
    console.log('✉️ 3. Verifying email via /auth/verify-email...');
    const verifyRes = await makeRequest('POST', '/auth/verify-email', {
      email,
      otp
    });

    console.log('   Status:', verifyRes.status);
    const cookies = verifyRes.headers['set-cookie'];
    console.log('   Cookies returned:', cookies);
    
    let hasAuthTokenCookie = cookies && cookies.some(c => c.startsWith('authToken='));
    if (hasAuthTokenCookie) {
      console.log('   ✅ Cookie "authToken" is present in Set-Cookie headers!');
    } else {
      console.error('   ❌ Cookie "authToken" is MISSING!');
    }

    const token = verifyRes.body.token;
    console.log('   ✅ Token in JSON response body:', token ? 'Present' : 'Missing');

    // Extract the cookie string
    const cookieHeader = cookies ? cookies.map(c => c.split(';')[0]).join('; ') : '';

    // 4. Test accessing protected endpoint WITH Cookie (no Auth header)
    console.log('\n🔒 4. Accessing protected endpoint /user/me WITH cookie (no Auth header)...');
    const meResWithCookie = await makeRequest('GET', '/user/me', null, {
      'Cookie': cookieHeader
    });

    console.log('   Status:', meResWithCookie.status);
    if (meResWithCookie.status === 200) {
      console.log('   ✅ Successfully authenticated using HttpOnly cookie!');
      console.log('   User Profile:', meResWithCookie.body.data.name, `(${meResWithCookie.body.data.email})`);
    } else {
      console.error('   ❌ Cookie authentication failed:', meResWithCookie.body);
    }

    // 5. Test accessing protected endpoint WITH Authorization header fallback (no cookie)
    console.log('\n🔒 5. Accessing protected endpoint /user/me WITH Authorization header (no cookie)...');
    const meResWithHeader = await makeRequest('GET', '/user/me', null, {
      'Authorization': `Bearer ${token}`
    });

    console.log('   Status:', meResWithHeader.status);
    if (meResWithHeader.status === 200) {
      console.log('   ✅ Successfully authenticated using Authorization header!');
    } else {
      console.error('   ❌ Authorization header authentication failed:', meResWithHeader.body);
    }

    // 6. Test login
    console.log('\n🔑 6. Testing /auth/login...');
    const loginRes = await makeRequest('POST', '/auth/login', {
      email,
      password
    });

    console.log('   Status:', loginRes.status);
    const loginCookies = loginRes.headers['set-cookie'];
    console.log('   Login cookies:', loginCookies);
    if (loginCookies && loginCookies.some(c => c.startsWith('authToken='))) {
      console.log('   ✅ Login cookie "authToken" set successfully!');
    } else {
      console.error('   ❌ Login cookie missing!');
    }

    const loginCookieHeader = loginCookies ? loginCookies.map(c => c.split(';')[0]).join('; ') : '';

    // 7. Test logout
    console.log('\n🚪 7. Testing /auth/logout...');
    const logoutRes = await makeRequest('POST', '/auth/logout', null, {
      'Cookie': loginCookieHeader
    });

    console.log('   Status:', logoutRes.status);
    const logoutCookies = logoutRes.headers['set-cookie'];
    console.log('   Logout cookies:', logoutCookies);
    if (logoutCookies && logoutCookies.some(c => c.includes('authToken=;'))) {
      console.log('   ✅ Logout cleared cookie successfully!');
    } else {
      console.error('   ❌ Logout failed to clear cookie!');
    }

    // Clean up test user
    console.log('\n🧹 Cleaning up test user...');
    await user.destroy();
    console.log('   Done.');

  } catch (error) {
    console.error('❌ Test execution error:', error);
  } finally {
    process.exit(0);
  }
}

testAuthFlow();
