import crypto from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import Users from "../models/Users.js";

const AUTH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_UPLOAD_IMAGE_BYTES = 8 * 1024 * 1024;
const MULTIPART_HEADER_SEPARATOR = Buffer.from("\r\n\r\n");
const MULTIPART_LINE_BREAK = Buffer.from("\r\n");

const normalizeText = (value = "") => String(value || "").trim();
const normalizeFlag = (value = "") => normalizeText(value).toLowerCase();
const encodePathSegment = (value = "") =>
  normalizeFlag(value)
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "asset";
const getAuthTokenSecret = () =>
  normalizeText(process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET) ||
  "agilatrack-dev-secret";
const createStatusError = (message, status = 400) =>
  Object.assign(new Error(message), { status });
const fromBase64Url = (value) => Buffer.from(value, "base64url").toString("utf8");

const signTokenPayload = (payload) =>
  crypto
    .createHmac("sha256", getAuthTokenSecret())
    .update(payload)
    .digest("base64url");

const verifySessionToken = (token) => {
  const [encodedPayload = "", signature = ""] = String(token || "").split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signTokenPayload(encodedPayload);
  if (signature !== expectedSignature) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload));
    if (!parsed?.userId || !parsed?.issuedAt) return null;
    if (Date.now() - Number(parsed.issuedAt) > AUTH_TOKEN_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const getTokenFromRequest = (req) => {
  const rawHeader = normalizeText(req.headers.authorization);
  if (!rawHeader) return "";

  if (/^QTracy\s+/i.test(rawHeader)) {
    return rawHeader.replace(/^QTracy\s+/i, "").trim();
  }

  if (/^Bearer\s+/i.test(rawHeader)) {
    return rawHeader.replace(/^Bearer\s+/i, "").trim();
  }

  return rawHeader;
};

const getMultipartBoundary = (contentType = "") => {
  const match = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return String(match?.[1] || match?.[2] || "").trim();
};

const parseMultipartFormData = (req) => {
  const boundary = getMultipartBoundary(req.headers["content-type"]);
  const body = req.body;

  if (!boundary) {
    throw createStatusError("Upload boundary is missing.");
  }

  if (!Buffer.isBuffer(body) || !body.length) {
    throw createStatusError("Upload body is empty.");
  }

  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const fields = {};
  let file = null;
  let cursor = 0;

  while (cursor < body.length) {
    const boundaryIndex = body.indexOf(boundaryBuffer, cursor);

    if (boundaryIndex === -1) {
      break;
    }

    cursor = boundaryIndex + boundaryBuffer.length;

    if (body.slice(cursor, cursor + 2).toString("latin1") === "--") {
      break;
    }

    if (body.slice(cursor, cursor + 2).equals(MULTIPART_LINE_BREAK)) {
      cursor += 2;
    }

    const headersEnd = body.indexOf(MULTIPART_HEADER_SEPARATOR, cursor);

    if (headersEnd === -1) {
      break;
    }

    const headerText = body.slice(cursor, headersEnd).toString("utf8");
    const contentStart = headersEnd + MULTIPART_HEADER_SEPARATOR.length;
    const nextBoundaryIndex = body.indexOf(boundaryBuffer, contentStart);

    if (nextBoundaryIndex === -1) {
      break;
    }

    let contentEnd = nextBoundaryIndex;

    if (body.slice(contentEnd - 2, contentEnd).equals(MULTIPART_LINE_BREAK)) {
      contentEnd -= 2;
    }

    const content = body.slice(contentStart, contentEnd);
    const headers = Object.fromEntries(
      headerText
        .split("\r\n")
        .map((line) => line.split(/:\s+/, 2))
        .filter(([key]) => key)
        .map(([key, value]) => [String(key || "").toLowerCase(), String(value || "")]),
    );
    const disposition = String(headers["content-disposition"] || "");
    const fieldName = disposition.match(/name="([^"]+)"/i)?.[1] || "";
    const fileName = disposition.match(/filename="([^"]*)"/i)?.[1] || "";

    if (fieldName) {
      if (fileName) {
        file = {
          buffer: content,
          fieldName,
          fileName,
          mimeType: String(headers["content-type"] || "").toLowerCase(),
        };
      } else {
        fields[fieldName] = content.toString("utf8");
      }
    }

    cursor = nextBoundaryIndex;
  }

  return {
    fields,
    file,
  };
};

const validateUploadMimeType = (mimeType = "") => {
  const normalizedMimeType = normalizeFlag(mimeType);

  if (!ALLOWED_UPLOAD_MIME_TYPES.has(normalizedMimeType)) {
    throw createStatusError("Only JPG, JPEG, PNG, and WEBP images are allowed.");
  }

  return normalizedMimeType;
};

const validateUploadSize = (size = 0) => {
  if (Number(size || 0) > MAX_UPLOAD_IMAGE_BYTES) {
    throw createStatusError("Uploaded images must be 8 MB or smaller.");
  }
};

const refreshCloudinaryConfig = () => {
  const cloudName = normalizeText(process.env.CLOUDINARY_CLOUD_NAME);
  const apiKey = normalizeText(process.env.CLOUDINARY_API_KEY);
  const apiSecret = normalizeText(process.env.CLOUDINARY_API_SECRET);

  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return true;
};

const findUploadUser = async (req, fallbackUserId = "") => {
  const token = getTokenFromRequest(req);
  const session = verifySessionToken(token);
  const userId = normalizeText(session?.userId || fallbackUserId);

  if (!userId) {
    return null;
  }

  return Users.findById(userId);
};

const buildUploadResponse = ({
  assetType,
  imageUrl,
  message,
  payload,
  publicId,
  user,
}) => ({
  assetType,
  imageUrl,
  message,
  payload,
  publicId,
  success: true,
  user,
});

const uploadImageToCloudinary = async ({ folder, publicId, source }) =>
  cloudinary.uploader.upload(source, {
    folder,
    public_id: publicId,
    resource_type: "image",
    overwrite: true,
    invalidate: true,
  });

function buildGenericAssetPublicId(prefix = "asset") {
  return `${encodePathSegment(prefix)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const uploadAsset = async (req, res) => {
  try {
    if (!refreshCloudinaryConfig()) {
      return res.status(500).json({
        error: "Cloudinary is not configured",
        message:
          "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env.",
      });
    }

    const target = normalizeFlag(req.params.target);
    const supportedTargets = new Set([
      "announcement-banner",
      "club-logo",
      "profile-photo",
      "valid-id",
    ]);

    if (!supportedTargets.has(target)) {
      return res.status(404).json({
        error: "Unsupported upload target",
        message: `Upload target "${target}" is not available.`,
      });
    }

    const { fields, file } = parseMultipartFormData(req);

    if (!file?.buffer?.length) {
      return res.status(400).json({
        error: "Image file is required",
        message: "Attach a JPG, JPEG, PNG, or WEBP file using the image field.",
      });
    }

    if (file.fieldName !== "image") {
      return res.status(400).json({
        error: "Invalid upload field",
        message: "Image upload expects the file field to be named image.",
      });
    }

    const mimeType = validateUploadMimeType(file.mimeType);
    validateUploadSize(file.buffer.length);

    const source = `data:${mimeType};base64,${file.buffer.toString("base64")}`;
    const fallbackUserId = normalizeText(fields.userId);

    if (target === "profile-photo") {
      const user = await findUploadUser(req, fallbackUserId);

      if (!user || user.isActive === false) {
        return res.status(401).json({
          error: "Invalid or expired session",
          message: "You need to be logged in before updating your profile photo.",
        });
      }

      const safeUserKey = encodePathSegment(user.email || user._id);
      const uploadResult = await uploadImageToCloudinary({
        folder: `users/${safeUserKey}`,
        publicId: "profile",
        source,
      });

      user.pid = uploadResult.version
        ? String(uploadResult.version)
        : uploadResult.asset_id;
      user.files = {
        ...(user.files?.toObject?.() || user.files || {}),
        profile: user.pid,
      };
      user.profile = {
        ...(user.profile?.toObject?.() || user.profile || {}),
        at: new Date(),
      };
      await user.save();

      return res.status(201).json(
        buildUploadResponse({
          assetType: "profile-photo",
          imageUrl: uploadResult.secure_url,
          message: "Profile photo uploaded successfully",
          payload: {
            publicId: uploadResult.public_id,
            source: uploadResult.secure_url,
          },
          publicId: uploadResult.public_id,
          user: {
            id: String(user._id || ""),
            pid: normalizeText(user.pid),
            profilePhoto: uploadResult.secure_url,
          },
        }),
      );
    }

    if (target === "valid-id") {
      const user = await findUploadUser(req, fallbackUserId);

      if (!user || user.isActive === false) {
        return res.status(401).json({
          error: "Invalid or expired session",
          message: "You need to be logged in before uploading a valid ID.",
        });
      }

      const safeUserKey = encodePathSegment(user.email || user._id);
      const uploadResult = await uploadImageToCloudinary({
        folder: `users/${safeUserKey}`,
        publicId: "valid-id",
        source,
      });

      user.files = {
        ...(user.files?.toObject?.() || user.files || {}),
        application: uploadResult.public_id,
      };
      await user.save();

      return res.status(201).json(
        buildUploadResponse({
          assetType: "valid-id",
          imageUrl: uploadResult.secure_url,
          message: "Valid ID uploaded successfully",
          payload: {
            publicId: uploadResult.public_id,
            source: uploadResult.secure_url,
          },
          publicId: uploadResult.public_id,
          user: {
            id: String(user._id || ""),
            validIdImage: uploadResult.secure_url,
          },
        }),
      );
    }

    const uploadResult = await uploadImageToCloudinary({
      folder:
        target === "club-logo"
          ? "agilatrack/clubs/uploads"
          : "agilatrack/communications/banners",
      publicId: buildGenericAssetPublicId(target),
      source,
    });

    return res.status(201).json(
      buildUploadResponse({
        assetType: target,
        imageUrl: uploadResult.secure_url,
        message:
          target === "club-logo"
            ? "Club logo uploaded successfully"
            : "Announcement banner uploaded successfully",
        payload: {
          publicId: uploadResult.public_id,
          source: uploadResult.secure_url,
        },
        publicId: uploadResult.public_id,
      }),
    );
  } catch (error) {
    return res.status(error?.status || 500).json({
      error: error.message || "Upload failed",
    });
  }
};
