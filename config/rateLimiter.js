/**
 * Rate Limiter Middleware for Auth Endpoints
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
  const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes default
  const max = options.max || 5; // default 5 attempts
  const message = options.message || "Too many attempts from this IP. Please try again after 15 minutes.";

  return (req, res, next) => {
    let rawIp = req.headers['x-forwarded-for'] || req.ip || req.socket.remoteAddress || '127.0.0.1';
    // If x-forwarded-for contains multiple IPs, take the first client IP
    if (typeof rawIp === 'string' && rawIp.includes(',')) {
      rawIp = rawIp.split(',')[0].trim();
    }
    const ip = String(rawIp).replace(/^::ffff:/, ''); // normalize IPv6 mapped IPv4

    const now = Date.now();

    if (!requestCounts.has(ip)) {
      requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
      console.log(`🔒 [RATE LIMIT] IP: ${ip} | Count: 1/${max}`);
      return next();
    }

    const data = requestCounts.get(ip);
    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + windowMs;
      console.log(`🔒 [RATE LIMIT RESET] IP: ${ip} | Count: 1/${max}`);
      return next();
    }

    data.count += 1;
    console.log(`🔒 [RATE LIMIT] IP: ${ip} | Count: ${data.count}/${max}`);

    if (data.count > max) {
      console.warn(`🛑 [RATE LIMIT EXCEEDED] IP: ${ip} blocked on request #${data.count}`);
      return res.status(429).json({
        status: "fail",
        message: `${message} (Attempt ${data.count}/${max})`
      });
    }

    next();
  };
};

module.exports = rateLimiter;
