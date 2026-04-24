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
  if (typeof value !== "string") return "";

  const trimmed = value.trim();

  if (!trimmed) return "";

  const hasWrappedQuotes =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"));

  return hasWrappedQuotes ? trimmed.slice(1, -1).trim() : trimmed;
};

export const env = {
  PORT: cleanEnvValue(process.env.PORT) || "5000",
  MONGO_URI: cleanEnvValue(process.env.MONGO_URI),
  JWT_SECRET: cleanEnvValue(process.env.JWT_SECRET),
  CLIENT_URL: cleanEnvValue(process.env.CLIENT_URL) || "http://localhost:5173",
  CLOUDINARY_CLOUD_NAME: cleanEnvValue(process.env.CLOUDINARY_CLOUD_NAME),
  CLOUDINARY_API_KEY: cleanEnvValue(process.env.CLOUDINARY_API_KEY),
  CLOUDINARY_API_SECRET: cleanEnvValue(process.env.CLOUDINARY_API_SECRET),
};

export const requiredCloudinaryEnvKeys = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

export const getMissingEnvKeys = (keys = []) =>
  keys.filter((key) => !env[key]);

export const getMissingCloudinaryEnvKeys = () =>
  getMissingEnvKeys(requiredCloudinaryEnvKeys);

export const hasCloudinaryConfig = () =>
  getMissingCloudinaryEnvKeys().length === 0;
