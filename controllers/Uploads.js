import { v2 as cloudinary } from "cloudinary";
import Users from "../models/Users.js";
import {
  getTokenFromRequest,
  normalizeFlag,
  normalizeText,
  verifySessionToken,
} from "../utils/auth.js";

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_UPLOAD_IMAGE_BYTES = 10 * 1024 * 1024;
const MULTIPART_HEADER_SEPARATOR = Buffer.from("\r\n\r\n");
const MULTIPART_LINE_BREAK = Buffer.from("\r\n");

const encodePathSegment = (value = "") =>
  normalizeFlag(value)
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "asset";
const createStatusError = (message, status = 400) =>
  Object.assign(new Error(message), { status });

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
    throw createStatusError("Uploaded images must be 10 MB or smaller.");
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
        error: "Cloudinary is not configured on the server.",
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
      "fancier-logo",
      "loft-logo",
      "operator-logo",
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
      user.profilePhoto = uploadResult.secure_url;
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

    // Handle fancier logo upload
    if (target === "fancier-logo") {
      const user = await findUploadUser(req, fallbackUserId);

      if (!user || user.isActive === false) {
        return res.status(401).json({
          error: "Invalid or expired session",
          message: "You need to be logged in before updating your logo.",
        });
      }

      if (!["member", "owner", "secretary", "operator", "admin"].includes(user.role)) {
        return res.status(403).json({
          error: "Access denied",
          message: "Only fanciers, club owners, secretaries, operators, and admins can upload logos.",
        });
      }

      const safeUserKey = encodePathSegment(user.email || user._id);
      const uploadResult = await uploadImageToCloudinary({
        folder: `users/${safeUserKey}`,
        publicId: "logo",
        source,
      });

      user.logoUrl = uploadResult.secure_url;
      user.logoPublicId = uploadResult.public_id;
      await user.save();

      return res.status(201).json(
        buildUploadResponse({
          assetType: "fancier-logo",
          imageUrl: uploadResult.secure_url,
          message: "Logo uploaded successfully",
          payload: {
            publicId: uploadResult.public_id,
            source: uploadResult.secure_url,
          },
          publicId: uploadResult.public_id,
          user: {
            id: String(user._id || ""),
            logoUrl: uploadResult.secure_url,
            logoPublicId: uploadResult.public_id,
          },
        }),
      );
    }

    // Handle loft logo upload
    if (target === "loft-logo") {
      const user = await findUploadUser(req, fallbackUserId);
      const loftId = normalizeText(fields.loftId);

      if (!user || user.isActive === false) {
        return res.status(401).json({
          error: "Invalid or expired session",
          message: "You need to be logged in before updating a loft logo.",
        });
      }

      if (!["member", "owner", "secretary", "operator", "admin"].includes(user.role)) {
        return res.status(403).json({
          error: "Access denied",
          message: "Only fanciers, club owners, secretaries, operators, and admins can upload loft logos.",
        });
      }

      if (!loftId) {
        return res.status(400).json({
          error: "Loft ID is required",
          message: "Provide loftId to update loft logo.",
        });
      }

      const Lofts = (await import("../models/Lofts.js")).default;
      const loft = await Lofts.findById(loftId);

      if (!loft) {
        return res.status(404).json({
          error: "Loft not found",
          message: "The specified loft does not exist.",
        });
      }

      // Check if user owns or manages the loft
      if (loft.ownerId?.toString() !== user._id.toString() && 
          loft.manager?.toString() !== user._id.toString() &&
          user.role !== "admin") {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only upload logos for your own lofts.",
        });
      }

      const safeLoftKey = encodePathSegment(loft.code || loft._id);
      const uploadResult = await uploadImageToCloudinary({
        folder: `lofts/${safeLoftKey}`,
        publicId: "logo",
        source,
      });

      loft.logoUrl = uploadResult.secure_url;
      loft.logoPublicId = uploadResult.public_id;
      await loft.save();

      return res.status(201).json(
        buildUploadResponse({
          assetType: "loft-logo",
          imageUrl: uploadResult.secure_url,
          message: "Loft logo uploaded successfully",
          payload: {
            publicId: uploadResult.public_id,
            source: uploadResult.secure_url,
            loftId: loft._id,
          },
          publicId: uploadResult.public_id,
          user: {
            id: String(user._id || ""),
            loftId: loft._id,
            logoUrl: uploadResult.secure_url,
            logoPublicId: uploadResult.public_id,
          },
        }),
      );
    }

    // Handle operator logo upload
    if (target === "operator-logo") {
      const user = await findUploadUser(req, fallbackUserId);
      const clubId = normalizeText(fields.clubId);

      if (!user || user.isActive === false) {
        return res.status(401).json({
          error: "Invalid or expired session",
          message: "You need to be logged in before updating an operator logo.",
        });
      }

      if (!["operator", "admin"].includes(user.role)) {
        return res.status(403).json({
          error: "Access denied",
          message: "Only operators and admins can upload operator logos.",
        });
      }

      if (!clubId) {
        return res.status(400).json({
          error: "Club ID is required",
          message: "Provide clubId to update operator/provincial logo.",
        });
      }

      const club = await Clubs.findById(clubId);

      if (!club) {
        return res.status(404).json({
          error: "Club not found",
          message: "The specified club does not exist.",
        });
      }

      // Check if user is operator for this club or admin
      const isOperator = club.management.owner?.user?.toString() === user._id.toString() ||
                        club.management.secretary?.user?.toString() === user._id.toString() ||
                        club.members.some(memberId => memberId.toString() === user._id.toString());

      if (!isOperator && user.role !== "admin") {
        return res.status(403).json({
          error: "Access denied",
          message: "You can only upload logos for clubs you operate or manage.",
        });
      }

      const safeClubKey = encodePathSegment(club.code || club._id);
      const uploadResult = await uploadImageToCloudinary({
        folder: `clubs/${safeClubKey}`,
        publicId: "logo",
        source,
      });

      club.logo = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        version: uploadResult.version?.toString() || uploadResult.asset_id,
        updatedAt: new Date(),
      };
      await club.save();

      return res.status(201).json(
        buildUploadResponse({
          assetType: "operator-logo",
          imageUrl: uploadResult.secure_url,
          message: "Operator logo uploaded successfully",
          payload: {
            publicId: uploadResult.public_id,
            source: uploadResult.secure_url,
            clubId: club._id,
          },
          publicId: uploadResult.public_id,
          user: {
            id: String(user._id || ""),
            clubId: club._id,
            logoUrl: uploadResult.secure_url,
            logoPublicId: uploadResult.public_id,
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
