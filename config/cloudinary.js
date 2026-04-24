import { v2 as cloudinary } from "cloudinary";
import {
  env,
  getMissingCloudinaryEnvKeys,
  hasCloudinaryConfig,
} from "./env.js";

let isConfigured = false;

export const getCloudinaryStatus = () => {
  const missing = getMissingCloudinaryEnvKeys();

  return {
    configured: missing.length === 0,
    missing,
  };
};

export const configureCloudinary = () => {
  const status = getCloudinaryStatus();

  if (!status.configured) {
    isConfigured = false;
    return status;
  }

  if (!isConfigured) {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    isConfigured = true;
  }

  return status;
};

configureCloudinary();

export const isCloudinaryConfigured = () =>
  hasCloudinaryConfig() && isConfigured;

export default cloudinary;
