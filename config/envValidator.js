module.exports = function validateEnv() {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USERNAME', 'SECRET_KEY', 'FRONTEND_URL', 'BACKEND_URL'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  if (process.env.SECRET_KEY.length < 32) throw new Error('SECRET_KEY must contain at least 32 random characters');
  if (process.env.NODE_ENV === 'production') {
    for (const key of ['FRONTEND_URL', 'BACKEND_URL']) {
      const val = (process.env[key] || '').trim().replace(/^["']|["']$/g, '');
      if (new URL(val).protocol !== 'https:') throw new Error(`${key} must use HTTPS`);
    }
  }
  if (process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_MODE) require('./paystack').paymentMode();
  require('./cors').allowedOrigins();
  if (process.env.TRUST_PROXY_HOPS && (!/^\d+$/.test(process.env.TRUST_PROXY_HOPS) || Number(process.env.TRUST_PROXY_HOPS) > 5)) {
    throw new Error('Set TRUST_PROXY_HOPS to the exact trusted proxy count (0-5)');
  }
};
