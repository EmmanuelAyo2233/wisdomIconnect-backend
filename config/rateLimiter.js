/**
 * Lightweight In-Memory Rate Limiter Middleware for Auth Endpoints
 */

const requestCounts = new Map();

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of requestCounts.entries()) {
    if (now > data.resetTime) {
      requestCounts.delete(ip);
    }
  }
}, 10 * 60 * 1000);

const rateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
  const max = options.max || 10; // max requests per window
  const message = options.message || "Too many requests from this IP, please try again after 15 minutes.";

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const data = requestCounts.get(ip);
    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + windowMs;
      return next();
    }

    data.count += 1;
    if (data.count > max) {
      return res.status(429).json({
        status: "fail",
        message
      });
    }

    next();
  };
};

module.exports = rateLimiter;
