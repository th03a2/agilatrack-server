import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "../config/env.js";

const toWindowMs = (value) => Math.max(Number(value) || 0, 1000);
const toMax = (value, fallback) => Math.max(Number(value) || fallback, 1);

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
  max: toMax(env.RATE_LIMIT_MAX_REQUESTS, env.IS_PRODUCTION ? 300 : 1000),
  message: "Too many requests. Please try again later.",
  windowMs: toWindowMs(env.RATE_LIMIT_WINDOW_MS),
});

export const authLimiter = buildLimiter({
  max: toMax(
    env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    env.IS_PRODUCTION ? 10 : 30,
  ),
  message: "Too many authentication attempts. Please try again later.",
  windowMs: toWindowMs(env.RATE_LIMIT_WINDOW_MS),
});
