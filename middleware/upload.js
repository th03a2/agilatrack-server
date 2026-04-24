import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary, {
  configureCloudinary,
  getCloudinaryStatus,
} from "../config/cloudinary.js";
import { AppError } from "../utils/appError.js";

const allowedFormats = ["jpg", "jpeg", "png", "webp"];
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const folderMap = {
  "profile-photo": "profile-photos",
  "valid-id": "valid-ids",
  "club-logo": "club-logos",
  "bird-image": "bird-images",
  "announcement-banner": "announcement-banners",
};

const ensureCloudinaryReady = () => {
  const status = configureCloudinary();

  if (!status.configured) {
    throw new AppError(503, "Cloudinary is not configured on the server.", {
      hint: "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env.",
      missing: status.missing,
    });
  }
};

const validateImageFile = (file) => {
  const mimeType = String(file?.mimetype || "").toLowerCase();

  if (!allowedMimeTypes.has(mimeType)) {
    throw new AppError(400, "Only JPG, JPEG, PNG, and WEBP images are allowed.");
  }
};

const createStorage = (variant = "general") =>
  new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      ensureCloudinaryReady();
      validateImageFile(file);

      return {
        folder: `agilatrack/${folderMap[variant] || "general"}`,
        allowed_formats: allowedFormats,
        resource_type: "image",
      };
    },
  });

const imageFileFilter = (req, file, callback) => {
  try {
    ensureCloudinaryReady();
    validateImageFile(file);
    callback(null, true);
  } catch (error) {
    callback(error);
  }
};

export const ensureCloudinaryConfigured = (req, res, next) => {
  try {
    const status = getCloudinaryStatus();

    if (!status.configured) {
      throw new AppError(503, "Cloudinary is not configured on the server.", {
        hint: "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env.",
        missing: status.missing,
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const createUploadMiddleware = (variant) =>
  multer({
    storage: createStorage(variant),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: 5 * 1024 * 1024,
    },
  });
