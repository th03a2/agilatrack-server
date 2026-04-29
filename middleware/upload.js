<<<<<<< Updated upstream
import multer from "multer";
import path from "node:path";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary, {
  configureCloudinary,
  getCloudinaryStatus,
} from "../config/cloudinary.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/appError.js";

const allowedFormats = ["jpg", "jpeg", "png", "webp"];
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

=======
import { configureCloudinary, getCloudinaryStatus } from "../config/cloudinary.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/appError.js";

>>>>>>> Stashed changes
const folderMap = {
  "profile-photo": "profile-photos",
  "valid-id": "valid-ids",
  "club-logo": "club-logos",
  "bird-image": "bird-images",
  "announcement-banner": "announcement-banners",
};

<<<<<<< Updated upstream
=======
const dataUrlPattern =
  /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/i;

const parseImagePayload = (source) => {
  const value = String(source || "").trim();
  const match = value.match(dataUrlPattern);

  if (!match) {
    throw new AppError(
      400,
      "Invalid image payload. Provide a JPG, JPEG, PNG, or WEBP base64 data URL.",
    );
  }

  const mimeType = match[1].toLowerCase();
  const extension = mimeType.split("/")[1] || "jpg";
  const base64Body = match[2].replace(/\s+/g, "");
  const sizeBytes = Buffer.byteLength(base64Body, "base64");

  if (sizeBytes > env.MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new AppError(400, "File too large.", {
      maximumFileSizeMb: env.MAX_UPLOAD_FILE_SIZE_MB,
    });
  }

  return {
    extension: extension === "jpeg" ? "jpg" : extension,
    mimeType,
    sizeBytes,
    source: value,
  };
};

>>>>>>> Stashed changes
const ensureCloudinaryReady = () => {
  const status = configureCloudinary();

  if (!status.configured) {
    throw new AppError(503, "Cloudinary is not configured on the server.", {
      hint: "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env.",
      missing: status.missing,
    });
  }
};

<<<<<<< Updated upstream
const validateImageFile = (file) => {
  const mimeType = String(file?.mimetype || "").toLowerCase();
  const extension = path.extname(String(file?.originalname || "")).toLowerCase();

  if (!allowedMimeTypes.has(mimeType)) {
    throw new AppError(400, "Only JPG, JPEG, PNG, and WEBP images are allowed.");
  }

  if (extension && !allowedExtensions.has(extension)) {
    throw new AppError(400, "Invalid image file extension.");
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

=======
>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
export const createUploadMiddleware = (variant) =>
  multer({
    storage: createStorage(variant),
    fileFilter: imageFileFilter,
    limits: {
      fileSize: env.MAX_UPLOAD_FILE_SIZE_BYTES,
    },
  });
=======
export const createUploadMiddleware = (variant) => (req, res, next) => {
  try {
    ensureCloudinaryReady();

    const parsed = parseImagePayload(req.body?.source);

    req.upload = {
      ...parsed,
      assetType: variant,
      birdId: String(req.body?.birdId || "").trim(),
      clubId: String(req.body?.clubId || "").trim(),
      folder: `agilatrack/${folderMap[variant] || "general"}`,
      label: String(req.body?.label || "").trim(),
      photoType: String(req.body?.photoType || "profile").trim().toLowerCase(),
      userId: String(req.body?.userId || "").trim(),
    };

    next();
  } catch (error) {
    next(error);
  }
};
>>>>>>> Stashed changes
