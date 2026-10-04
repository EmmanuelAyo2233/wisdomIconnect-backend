const { HttpError } = require("../utils/security");

function allowedOrigins(env = process.env) {
  const values = [env.FRONTEND_URL, ...(env.CORS_ORIGINS || "").split(",")];
  if (env.NODE_ENV !== "production") values.push("http://localhost:5173", "http://127.0.0.1:5173");
  return [...new Set(values.filter(value => value?.trim()).map(value => {
    const raw = value.trim().replace(/^["']|["']$/g, "");
    let url;
    try { url = new URL(raw); } catch { throw new Error("Invalid frontend/CORS origin configuration"); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash || (env.NODE_ENV === 'production' && url.protocol !== 'https:')) {
      throw new Error("Configure CORS with exact HTTPS origins without paths or wildcards");
    }
    return url.origin;
  }))];
}

function corsOptions(env = process.env) {
  const origins = allowedOrigins(env);
  return {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) return callback(null, true);
      return callback(new HttpError(403, "Origin not allowed"));
    },
    credentials: false,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Idempotency-Key"],
    maxAge: 600,
  };
}
module.exports = { allowedOrigins, corsOptions };
