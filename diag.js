const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, res => {
  let d = '';
  res.on('data', c => d+=c);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(d);
      const token = parsed.token;
      console.log('TOKEN:', token ? 'FOUND' : 'MISSING');
      if (!token) {
        console.log('LOGIN FAILED:', parsed);
        return;
      }
      
      const req2 = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/v1/admin/users',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }, res2 => {
        let d2 = '';
        res2.on('data', c => d2 += c);
        res2.on('end', () => console.log('USERS RESPONSE:', res2.statusCode, d2));
      });
      req2.end();
    } catch(e) {
      console.log('Parse error:', e, d);
    }
  });
});

req.on('error', e => console.log('Request error:', e.message));
req.write(JSON.stringify({ email: 'admin@wisdomconnect.com', password: 'password123' }));
req.end();
