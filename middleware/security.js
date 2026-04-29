<<<<<<< Updated upstream
import rateLimit from "express-rate-limit";
import helmet from "helmet";
=======
>>>>>>> Stashed changes
import { env } from "../config/env.js";

const toWindowMs = (value) => Math.max(Number(value) || 0, 1000);
const toMax = (value, fallback) => Math.max(Number(value) || fallback, 1);

<<<<<<< Updated upstream
const buildLimiter = ({ max, message, windowMs }) =>
  rateLimit({
    legacyHeaders: false,
    max,
    message: {
      error: message,
    },
    standardHeaders: true,
    windowMs,
  });

export const helmetMiddleware = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
});

export const apiLimiter = buildLimiter({
=======
const createRateLimiter = ({ keyPrefix, max, message, windowMs }) => {
  const hits = new Map();
  let requestCounter = 0;

  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip || "unknown"}`;
    const current = hits.get(key);

    let entry = current;
    if (!entry || entry.resetAt <= now) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
      };
      hits.set(key, entry);
    }

    entry.count += 1;

    const remaining = Math.max(max - entry.count, 0);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    requestCounter += 1;
    if (requestCounter % 250 === 0) {
      for (const [cachedKey, cachedEntry] of hits.entries()) {
        if (cachedEntry.resetAt <= now) {
          hits.delete(cachedKey);
        }
      }
    }

    if (entry.count > max) {
      res.status(429).json({
        error: message,
      });
      return;
    }

    next();
  };
};

export const helmetMiddleware = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=()",
  );
  next();
};

export const apiLimiter = createRateLimiter({
  keyPrefix: "api",
>>>>>>> Stashed changes
  max: toMax(env.RATE_LIMIT_MAX_REQUESTS, env.IS_PRODUCTION ? 300 : 1000),
  message: "Too many requests. Please try again later.",
  windowMs: toWindowMs(env.RATE_LIMIT_WINDOW_MS),
});

<<<<<<< Updated upstream
export const authLimiter = buildLimiter({
=======
export const authLimiter = createRateLimiter({
  keyPrefix: "auth",
>>>>>>> Stashed changes
  max: toMax(
    env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    env.IS_PRODUCTION ? 10 : 30,
  ),
  message: "Too many authentication attempts. Please try again later.",
  windowMs: toWindowMs(env.RATE_LIMIT_WINDOW_MS),
});
