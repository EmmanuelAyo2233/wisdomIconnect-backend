const { test } = require('node:test');
const assert = require('node:assert/strict');
const { paymentMode } = require('../config/paystack');
const { allowedOrigins, corsOptions } = require('../config/cors');

test('production hosting supports test Paystack but rejects inconsistent payment modes', () => {
  assert.equal(paymentMode({NODE_ENV:'production',PAYSTACK_SECRET_KEY:'sk_test_fixture',PAYSTACK_MODE:'test'}),'test');
  assert.equal(paymentMode({NODE_ENV:'production',PAYSTACK_SECRET_KEY:'sk_live_fixture',PAYSTACK_MODE:'live'}),'live');
  assert.throws(() => paymentMode({PAYSTACK_SECRET_KEY:'sk_test_fixture',PAYSTACK_MODE:'live'}),/does not match/);
  assert.throws(() => paymentMode({PAYSTACK_SECRET_KEY:'invalid'}),/valid Paystack/);
});

test('production startup validation accepts test checkout while keeping secure configuration', t => {
  const fixture={NODE_ENV:'production',DB_HOST:'localhost',DB_NAME:'isolated_fixture',DB_USERNAME:'fixture',SECRET_KEY:'isolated-signing-key-at-least-32-characters',FRONTEND_URL:'https://wisdom-iconnect.vercel.app/',BACKEND_URL:'https://wisdomiconnect-backend-production.up.railway.app',PAYSTACK_SECRET_KEY:'sk_test_fixture',PAYSTACK_MODE:'test',CORS_ORIGINS:'https://wisdom-iconnect.vercel.app',TRUST_PROXY_HOPS:'0'};
  const old=Object.fromEntries(Object.keys(fixture).map(key=>[key,process.env[key]]));
  t.after(()=>{for(const [key,value] of Object.entries(old)) {if(value===undefined)delete process.env[key];else process.env[key]=value;}});
  Object.assign(process.env,fixture);
  const validate=require('../config/envValidator');
  assert.doesNotThrow(validate);
  process.env.SECRET_KEY='too-short';
  assert.throws(validate,/at least 32/);
});

test('allowed origins normalize trailing slash and exclude unrelated domains', () => {
  const env={NODE_ENV:'production',FRONTEND_URL:'https://wisdom-iconnect.vercel.app/',CORS_ORIGINS:' https://wisdom-iconnect.vercel.app '};
  assert.deepEqual(allowedOrigins(env),['https://wisdom-iconnect.vercel.app']);
  for (const value of ['*','https://wisdom-iconnect.vercel.app.evil.invalid/path','http://localhost:5173']) {
    assert.throws(() => allowedOrigins({...env,CORS_ORIGINS:value}));
  }
});

test('pending legacy mentor migration preserves an existing JSON experience column', async () => {
  const migration=require('../migrations/20250831205306-update-mentor-json-fields');
  const qi={describeTable:async()=>({discipline:{type:'JSON'},experience:{type:'JSON'}}),changeColumn:async()=>assert.fail('Unexpected column rewrite'),addColumn:async()=>assert.fail('Duplicate column addition')};
  await migration.up(qi,require('sequelize'));
});

test('legacy mentor migration rejects invalid JSON before a schema write', async () => {
  const migration=require('../migrations/20250831205306-update-mentor-json-fields');
  const qi={describeTable:async()=>({discipline:{type:'VARCHAR(255)'}}),sequelize:{query:async()=>[[{invalidCount:1}]]},changeColumn:async()=>assert.fail('Unsafe column rewrite'),addColumn:async()=>assert.fail('Unexpected schema write')};
  await assert.rejects(migration.up(qi,require('sequelize')),/Reconcile non-JSON/);
});

test('login OPTIONS returns exact Vercel origin and blocks an unapproved origin', async t => {
  const app=require('express')();
  app.use(require('cors')(corsOptions({NODE_ENV:'production',FRONTEND_URL:'https://wisdom-iconnect.vercel.app/'})));
  app.use((err,req,res,next) => { void next;res.status(err.statusCode || 500).json({message:'Origin rejected'}); });
  const server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const url=`http://127.0.0.1:${server.address().port}/api/v1/auth/login`;
  const headers={Origin:'https://wisdom-iconnect.vercel.app','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,authorization'};
  const response=await fetch(url,{method:'OPTIONS',headers});
  assert.equal(response.status,204);
  assert.equal(response.headers.get('access-control-allow-origin'),headers.Origin);
  assert.equal(response.headers.get('access-control-allow-credentials'),null);
  const denied=await fetch(url,{method:'OPTIONS',headers:{...headers,Origin:'https://unapproved.example.invalid'}});
  assert.equal(denied.status,403);
  assert.equal(denied.headers.get('access-control-allow-origin'),null);
});

test('accountEligible accepts active verified users, admins, and approved accounts', () => {
  const { accountEligible } = require('../utils/security');
  assert.equal(accountEligible({ accountStatus: 'active', isVerified: true }), true);
  assert.equal(accountEligible({ accountStatus: 'active', isVerified: false, userType: 'admin' }), true);
  assert.equal(accountEligible({ accountStatus: 'active', isVerified: false, status: 'approved' }), true);
  assert.equal(accountEligible({ accountStatus: 'suspended', isVerified: true }), false);
  assert.equal(accountEligible({ accountStatus: 'banned', isVerified: true }), false);
  assert.equal(accountEligible({ accountStatus: 'active', isVerified: false, userType: 'mentor', status: 'pending' }), false);
});

