import { env } from "./env.js";

const normalizeOrigin = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\/+$/, "");

const allowedOrigins = new Set(
  [
    env.CLIENT_URL,
    ...env.ALLOWED_ORIGINS,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
  ]
    .map(normalizeOrigin)
    .filter(Boolean),
);

export const getAllowedOrigins = () => [...allowedOrigins];

export const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);

    if (allowedOrigins.has(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    callback(
      new Error(
        `Origin "${origin}" is not allowed by CORS. Add it to CLIENT_URL or ALLOWED_ORIGINS in server/.env.`,
      ),
    );
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Device-Id"],
  credentials: false,
  optionsSuccessStatus: 204,
};
