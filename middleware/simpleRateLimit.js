/**
 * Simple rate limiting middleware for API endpoints
 * Uses in-memory storage for rate limiting
 */

const rateLimitStore = new Map();

/**
 * Simple rate limiter middleware
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max - Maximum requests per window (default: 100)
 * @param {string} options.message - Error message (default: "Too many requests")
 */
export function simpleRateLimit(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = "Too many requests, please try again later."
  } = options;

  return (req, res, next) => {
    // Use IP address and user ID for rate limiting
    const key = `${req.ip || 'unknown'}_${req.auth?.userId || 'anonymous'}`;
    const now = Date.now();
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    if (!entry) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
        requests: []
      };
      rateLimitStore.set(key, entry);
    }

    // Reset if window has expired
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + windowMs;
      entry.requests = [];
    }

    // Increment request count
    entry.count++;
    entry.requests.push(now);

    // Clean old requests and keep only recent ones
    entry.requests = entry.requests.filter(time => now - time < windowMs);

    // Check if limit exceeded
    if (entry.requests.length > max) {
      const resetIn = Math.ceil((entry.resetTime - now) / 1000);
      
      return res.status(429).json({
        error: message,
        retryAfter: resetIn,
        limit: max,
        windowMs
      });
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': Math.max(0, max - entry.requests.length),
      'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
    });

    next();
  };
}

/**
 * Cleanup function to remove expired entries
 * Should be called periodically to prevent memory leaks
 */
export function cleanupRateLimitStore() {
  const now = Date.now();
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Auto-cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
