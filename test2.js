const http = require('http');
function run() {
  const req = http.request({
    hostname: '127.0.0.1',
    port: 5000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, res => {
    let d = '';
    res.on('data', c => d+=c);
    res.on('end', () => {
      console.log("LOGIN HTTP STATUS", res.statusCode, d);
      try {
        const t = JSON.parse(d).token;
        if(!t) return;
        
        const req2 = http.request({
          hostname: '127.0.0.1', port: 5000, path: '/api/v1/mentors/explore', method: 'GET',
          headers: { 'Authorization': 'Bearer ' + t }
        }, res2 => {
            let d2 = ''; res2.on('data', c => d2 += c);
            res2.on('end', () => console.log('MENTORS ENDPOINT:', res2.statusCode, d2));
        });
        req2.end();
      } catch(e) {}
    });
  });
  req.on('error', e => console.error(e));
  req.write(JSON.stringify({ email: 'admin@wisdomconnect.com', password: 'password123' }));
  req.end();
}
run();
