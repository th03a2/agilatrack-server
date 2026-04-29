import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});

const cleanEnvValue = (value) => {
<<<<<<< Updated upstream
  if (typeof value !== "string") return "";

  const trimmed = value.trim();

  if (!trimmed) return "";
=======
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }
>>>>>>> Stashed changes

  const hasWrappedQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));

  return hasWrappedQuotes ? trimmed.slice(1, -1).trim() : trimmed;
};

const cleanListEnvValue = (value) =>
  cleanEnvValue(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(cleanEnvValue(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeEmailList = (value) =>
  cleanListEnvValue(value).map((entry) => entry.toLowerCase());

const NODE_ENV = cleanEnvValue(process.env.NODE_ENV) || "development";
<<<<<<< Updated upstream
=======
const configuredJwtSecret = cleanEnvValue(process.env.JWT_SECRET);
const configuredAuthTokenSecret = cleanEnvValue(process.env.AUTH_TOKEN_SECRET);
const sessionSecret =
  configuredAuthTokenSecret ||
  configuredJwtSecret ||
  "agilatrack-dev-secret";
>>>>>>> Stashed changes

export const env = {
  NODE_ENV,
  IS_PRODUCTION: NODE_ENV === "production",
  PORT: cleanEnvValue(process.env.PORT) || "5000",
  MONGO_URI: cleanEnvValue(process.env.MONGO_URI),
<<<<<<< Updated upstream
  JWT_SECRET: cleanEnvValue(process.env.JWT_SECRET),
  JWT_EXPIRES_IN: cleanEnvValue(process.env.JWT_EXPIRES_IN) || "12h",
  CLIENT_URL: cleanEnvValue(process.env.CLIENT_URL) || "http://localhost:5173",
  ALLOWED_ORIGINS: cleanListEnvValue(process.env.ALLOWED_ORIGINS),
  TEAM_ADMIN_EMAILS: normalizeEmailList(process.env.TEAM_ADMIN_EMAILS),
  REQUEST_BODY_LIMIT: cleanEnvValue(process.env.REQUEST_BODY_LIMIT) || "1mb",
  RATE_LIMIT_WINDOW_MS: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  RATE_LIMIT_MAX_REQUESTS: parseInteger(process.env.RATE_LIMIT_MAX_REQUESTS, 300),
  AUTH_RATE_LIMIT_MAX_REQUESTS: parseInteger(
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    10,
  ),
  MAX_UPLOAD_FILE_SIZE_MB: parseInteger(process.env.MAX_UPLOAD_FILE_SIZE_MB, 5),
  MONGO_MAX_POOL_SIZE: parseInteger(process.env.MONGO_MAX_POOL_SIZE, 20),
  MONGO_SERVER_SELECTION_TIMEOUT_MS: parseInteger(
    process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    10000,
=======
  JWT_SECRET: configuredJwtSecret || sessionSecret,
  AUTH_TOKEN_SECRET: sessionSecret,
  CLIENT_URL: cleanEnvValue(process.env.CLIENT_URL) || "http://localhost:5173",
  ALLOWED_ORIGINS: cleanListEnvValue(process.env.ALLOWED_ORIGINS),
  TEAM_ADMIN_EMAILS: normalizeEmailList(process.env.TEAM_ADMIN_EMAILS),
  REQUEST_BODY_LIMIT: cleanEnvValue(process.env.REQUEST_BODY_LIMIT) || "15mb",
  RATE_LIMIT_WINDOW_MS: parseInteger(
    process.env.RATE_LIMIT_WINDOW_MS,
    15 * 60 * 1000,
  ),
  RATE_LIMIT_MAX_REQUESTS: parseInteger(
    process.env.RATE_LIMIT_MAX_REQUESTS,
    1000,
  ),
  AUTH_RATE_LIMIT_MAX_REQUESTS: parseInteger(
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS,
    30,
  ),
  MAX_UPLOAD_FILE_SIZE_MB: parseInteger(
    process.env.MAX_UPLOAD_FILE_SIZE_MB,
    10,
  ),
  MONGO_MAX_POOL_SIZE: parseInteger(process.env.MONGO_MAX_POOL_SIZE, 20),
  MONGO_SERVER_SELECTION_TIMEOUT_MS: parseInteger(
    process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    5000,
>>>>>>> Stashed changes
  ),
  MONGO_SOCKET_TIMEOUT_MS: parseInteger(
    process.env.MONGO_SOCKET_TIMEOUT_MS,
    45000,
  ),
<<<<<<< Updated upstream
  EMAIL_HOST: cleanEnvValue(process.env.EMAIL_HOST),
  EMAIL_PORT: cleanEnvValue(process.env.EMAIL_PORT) || "587",
  EMAIL_USER: cleanEnvValue(process.env.EMAIL_USER),
  EMAIL_PASS: cleanEnvValue(process.env.EMAIL_PASS),
  EMAIL_FROM: cleanEnvValue(process.env.EMAIL_FROM),
=======
>>>>>>> Stashed changes
  CLOUDINARY_CLOUD_NAME: cleanEnvValue(process.env.CLOUDINARY_CLOUD_NAME),
  CLOUDINARY_API_KEY: cleanEnvValue(process.env.CLOUDINARY_API_KEY),
  CLOUDINARY_API_SECRET: cleanEnvValue(process.env.CLOUDINARY_API_SECRET),
};

env.MAX_UPLOAD_FILE_SIZE_BYTES = env.MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024;

<<<<<<< Updated upstream
export const requiredEmailEnvKeys = [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_USER",
  "EMAIL_PASS",
  "EMAIL_FROM",
];

=======
>>>>>>> Stashed changes
export const requiredCloudinaryEnvKeys = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

export const getMissingEnvKeys = (keys = []) =>
  keys.filter((key) => !env[key]);

export const getMissingCloudinaryEnvKeys = () =>
  getMissingEnvKeys(requiredCloudinaryEnvKeys);

<<<<<<< Updated upstream
export const getMissingEmailEnvKeys = () =>
  getMissingEnvKeys(requiredEmailEnvKeys);

export const hasCloudinaryConfig = () =>
  getMissingCloudinaryEnvKeys().length === 0;

export const hasEmailConfig = () => getMissingEmailEnvKeys().length === 0;

export const validateCriticalEnv = () => {
  const missing = getMissingEnvKeys(["MONGO_URI", "JWT_SECRET"]);
=======
export const hasCloudinaryConfig = () =>
  getMissingCloudinaryEnvKeys().length === 0;

export const validateCriticalEnv = () => {
  const missing = getMissingEnvKeys(["MONGO_URI"]);
>>>>>>> Stashed changes

  if (missing.length) {
    throw new Error(
      `Missing required environment variables in server/.env: ${missing.join(", ")}.`,
    );
  }
<<<<<<< Updated upstream

  if (String(env.JWT_SECRET).length < 32) {
    throw new Error(
      "JWT_SECRET in server/.env must be at least 32 characters long.",
    );
  }
=======
>>>>>>> Stashed changes
};
