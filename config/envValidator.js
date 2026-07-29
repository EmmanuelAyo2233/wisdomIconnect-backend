/**
 * Environment Variable Validator
 * Runs on server startup to verify required environment configuration.
 */

const validateEnv = () => {
  const required = ['DB_HOST', 'DB_NAME', 'DB_USERNAME'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`⚠️ [ENV WARNING] Missing critical environment variables: ${missing.join(', ')}`);
    console.warn(`   Please ensure these are defined in your .env or server environment.`);
  }

  if (!process.env.SECRET_KEY) {
    console.warn('⚠️ [ENV WARNING] SECRET_KEY is not explicitly set in .env. Using default fallback for development.');
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    console.warn('⚠️ [ENV INFO] PAYSTACK_SECRET_KEY is using default test key. Set your key in .env for production.');
  }

  if (!process.env.BACKEND_URL) {
    console.warn('ℹ️ [ENV INFO] BACKEND_URL is not set. Image URLs will fallback to request host header.');
  }

  console.log('✅ Environment configuration validated.');
};

module.exports = validateEnv;
