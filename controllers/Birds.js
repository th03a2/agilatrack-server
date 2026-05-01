import Birds, {
  BIRD_IMAGE_FIELDS,
  BIRD_PHOTO_TYPES,
  buildBirdImageMap,
  buildBirdPhotosFromImageMap,
  createEmptyBirdImageMap,
  getMissingRequiredBirdImages,
} from "../models/Birds.js";
import { v2 as cloudinary } from "cloudinary";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });
const createStatusError = (message, status = 400) =>
  Object.assign(new Error(message), { status });

const encodePathSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const ALLOWED_BIRD_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);
const MAX_BIRD_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;
const MULTIPART_HEADER_SEPARATOR = Buffer.from("\r\n\r\n");
const MULTIPART_LINE_BREAK = Buffer.from("\r\n");
const birdImageFieldByType = Object.fromEntries(
  BIRD_IMAGE_FIELDS.map((field) => [field.type, field.key]),
);

const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );

if (isCloudinaryConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

const populateBird = (query) =>
  query
    .select("-healthRecords")
    .populate("club", "name code abbr level location")
    .populate("owner", "fullName email mobile pid")
    .populate({
      path: "affiliation",
      select: "memberCode status membershipType roles user club primaryLoft",
      populate: [
        { path: "user", select: "fullName email mobile pid" },
        { path: "club", select: "name code abbr level location" },
      ],
    })
    .populate("loft", "name code coordinates address status")
    .populate("breeder", "fullName email mobile pid")
    .populate("parents.sire.bird", "bandNumber name sex color strain status")
    .populate("parents.dam.bird", "bandNumber name sex color strain status");

const buildBirdQuery = (query = {}) => {
  const {
    affiliation,
    bandNumber,
    breeder,
    club,
    color,
    loft,
    name,
    owner,
    sex,
    species,
    status,
    strain,
  } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (affiliation) dbQuery.affiliation = affiliation;
  if (bandNumber) dbQuery.bandNumber = { $regex: bandNumber, $options: "i" };
  if (breeder) dbQuery.breeder = breeder;
  if (club) dbQuery.club = club;
  if (color) dbQuery.color = { $regex: color, $options: "i" };
  if (loft) dbQuery.loft = loft;
  if (name) dbQuery.name = { $regex: name, $options: "i" };
  if (owner) dbQuery.owner = owner;
  if (sex) dbQuery.sex = sex;
  if (species) dbQuery.species = species;
  if (status) dbQuery.status = status;
  if (strain) dbQuery.strain = { $regex: strain, $options: "i" };

  return dbQuery;
};

const extractBirdImageOverrides = (payload = {}) => {
  const overrides = {};

  if (payload?.images && typeof payload.images === "object") {
    BIRD_IMAGE_FIELDS.forEach(({ key }) => {
      if (Object.prototype.hasOwnProperty.call(payload.images, key)) {
        overrides[key] = String(payload.images[key] || "").trim();
      }
    });
  }

  if (Array.isArray(payload?.photos)) {
    payload.photos.forEach((photo) => {
      if (!photo || typeof photo !== "object") {
        return;
      }

      const type = String(photo.type || "").trim();
      const key = birdImageFieldByType[type];

      if (!key) {
        return;
      }

      overrides[key] = String(photo.source || "").trim();
    });
  }

  if (typeof payload?.birdImage === "string") {
    overrides.mainPhoto = payload.birdImage.trim();
  }

  return overrides;
};

const buildBirdPayloadInput = (payload = {}, existingBird = null) => {
  const baseImages = existingBird
    ? buildBirdImageMap(existingBird.toObject ? existingBird.toObject() : existingBird)
    : createEmptyBirdImageMap();
  const imageOverrides = extractBirdImageOverrides(payload);
  const imageMap = {
    ...baseImages,
    ...imageOverrides,
  };
  const { birdImage: _legacyBirdImage, images: _images, photos: _photos, ...rest } = payload || {};

  return {
    imageMap,
    payloadInput: {
      ...rest,
      photos: buildBirdPhotosFromImageMap(imageMap),
    },
  };
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

const validateBirdUploadMimeType = (mimeType = "") => {
  const normalizedMimeType = String(mimeType || "").trim().toLowerCase();

  if (!ALLOWED_BIRD_UPLOAD_MIME_TYPES.has(normalizedMimeType)) {
    throw createStatusError("Only JPG, JPEG, PNG, and WEBP bird images are allowed.");
  }

  return normalizedMimeType;
};

const validateBirdUploadSize = (size = 0) => {
  if (Number(size || 0) > MAX_BIRD_IMAGE_UPLOAD_BYTES) {
    throw createStatusError("Bird verification images must be 5 MB or smaller.");
  }
};

const getBase64SourceMimeType = (source = "") =>
  String(source || "").match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/i)?.[1] || "";

const getBase64PayloadBytes = (source = "") => {
  const base64Payload = String(source || "").split(",", 2)[1] || "";

  return base64Payload ? Buffer.byteLength(base64Payload, "base64") : 0;
};

const uploadBirdImageToCloudinary = async ({
  bandNumber,
  label,
  mimeType,
  ownerEmail,
  source,
  type,
}) => {
  if (!BIRD_PHOTO_TYPES.includes(type)) {
    throw createStatusError(
      `Bird photo type must be one of: ${BIRD_PHOTO_TYPES.join(", ")}.`,
    );
  }

  const safeOwnerEmail = encodePathSegment(ownerEmail);
  const safeBandNumber = encodePathSegment(bandNumber);
  const safeType = encodePathSegment(type);
  const uploadResult = await cloudinary.uploader.upload(source, {
    folder: `agilatrack/birds/${safeOwnerEmail}/${safeBandNumber}`,
    public_id: safeType,
    resource_type: "image",
    overwrite: true,
    invalidate: true,
  });

  return {
    type,
    label: label || type,
    source: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    ownerKey: safeOwnerEmail,
    mimeType: uploadResult.format ? `image/${uploadResult.format}` : mimeType || undefined,
  };
};

export const findAll = async (req, res) => {
  try {
    const payload = await populateBird(Birds.find(buildBirdQuery(req.query)))
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Birds fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateBird(Birds.findById(req.params.id)).lean({
      virtuals: true,
    });

    if (!payload) return res.status(404).json({ error: "Bird not found" });

    res.json({ success: "Bird fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createBird = async (req, res) => {
  try {
    const { imageMap, payloadInput: nextPayloadInput } = buildBirdPayloadInput(req.body);
    const missingImages = getMissingRequiredBirdImages(imageMap);

    if (missingImages.length > 0) {
      return res.status(400).json({
        error: "Missing required pigeon verification photos.",
        details: {
          missing: missingImages,
        },
      });
    }

    const payloadInput = {
      ...nextPayloadInput,
      approvalStatus: "pending",
      approval: {
        ...(req.body?.approval || {}),
        requestedAt: new Date(),
        approvedAt: undefined,
        approvedBy: undefined,
        rejectedAt: undefined,
        rejectedBy: undefined,
      },
    };
    const created = await Birds.create(payloadInput);
    const payload = await populateBird(Birds.findById(created._id)).lean({
      virtuals: true,
    });

    res.status(201).json({ success: "Bird created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const uploadBirdPhoto = async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(500).json({
        error: "Cloudinary is not configured",
        message:
          "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env.",
      });
    }

    const source = String(req.body?.source || "").trim();
    const type = String(req.body?.type || "profile").trim();
    const label = String(req.body?.label || "").trim();
    const bandNumber = String(req.body?.bandNumber || "bird").trim();
    const ownerEmail = String(req.body?.ownerEmail || "").trim().toLowerCase();

    if (!source.startsWith("data:image/")) {
      return res.status(400).json({
        error: "Invalid image payload",
        message: "Bird photo upload expects a base64 image data URL.",
      });
    }

    const mimeType = validateBirdUploadMimeType(getBase64SourceMimeType(source));
    validateBirdUploadSize(getBase64PayloadBytes(source));
    const payload = await uploadBirdImageToCloudinary({
      bandNumber,
      label,
      mimeType,
      ownerEmail,
      source,
      type,
    });

    return res.status(201).json({
      success: "Bird photo uploaded successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error, error?.status || 500);
  }
};

export const uploadBirdImageAsset = async (req, res) => {
  try {
    if (!isCloudinaryConfigured()) {
      return res.status(500).json({
        error: "Cloudinary is not configured",
        message:
          "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env.",
      });
    }

    const { fields, file } = parseMultipartFormData(req);

    if (!file?.buffer?.length) {
      return res.status(400).json({
        error: "Bird image file is required",
        message: "Attach a JPG, JPEG, PNG, or WEBP pigeon image using the image field.",
      });
    }

    if (file.fieldName !== "image") {
      return res.status(400).json({
        error: "Invalid bird image field",
        message: "Bird image upload expects the file field to be named image.",
      });
    }

    const mimeType = validateBirdUploadMimeType(file.mimeType);
    validateBirdUploadSize(file.buffer.length);

    const payload = await uploadBirdImageToCloudinary({
      bandNumber: String(fields.bandNumber || "bird").trim(),
      label: String(fields.label || "").trim(),
      mimeType,
      ownerEmail: String(fields.ownerEmail || "").trim().toLowerCase(),
      source: `data:${mimeType};base64,${file.buffer.toString("base64")}`,
      type: String(fields.type || "profile").trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Bird photo uploaded successfully",
      assetType: "bird-image",
      imageUrl: payload.source,
      publicId: payload.publicId,
      payload,
    });
  } catch (error) {
    sendError(res, error, error?.status || 500);
  }
};

export const updateBird = async (req, res) => {
  try {
    const bird = await Birds.findById(req.params.id);
    if (!bird) return res.status(404).json({ error: "Bird not found" });

    const approvalOnlyUpdate =
      Object.keys(req.body || {}).length > 0 &&
      Object.keys(req.body || {}).every((key) =>
        ["approvalStatus", "approval"].includes(key),
      );

    if (approvalOnlyUpdate) {
      bird.set(req.body);
    } else {
      const { imageMap, payloadInput } = buildBirdPayloadInput(req.body, bird);
      const missingImages = getMissingRequiredBirdImages(imageMap);

      if (missingImages.length > 0) {
        return res.status(400).json({
          error: "Missing required pigeon verification photos.",
          details: {
            missing: missingImages,
          },
        });
      }

      bird.set({
        ...payloadInput,
        approvalStatus: "pending",
        approval: {
          ...(bird.approval?.toObject?.() || bird.approval || {}),
          requestedAt: new Date(),
          approvedAt: undefined,
          approvedBy: undefined,
          rejectedAt: undefined,
          rejectedBy: undefined,
        },
      });
    }
    await bird.save();

    const payload = await populateBird(Birds.findById(bird._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Bird updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateBirdApproval = async (req, res) => {
  try {
    const bird = await Birds.findById(req.params.id);
    if (!bird) return res.status(404).json({ error: "Bird not found" });

    bird.set({
      approvalStatus: req.body?.approvalStatus || "pending",
      approval: {
        ...(bird.approval?.toObject?.() || bird.approval || {}),
        ...(req.body?.approval || {}),
      },
    });
    await bird.save();

    const payload = await populateBird(Birds.findById(bird._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Bird approval updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteBird = async (req, res) => {
  try {
    const payload = await populateBird(
      Birds.findByIdAndUpdate(
        req.params.id,
        { deletedAt: new Date().toISOString(), status: "archived" },
        { new: true },
      ),
    ).lean({ virtuals: true });

    if (!payload) return res.status(404).json({ error: "Bird not found" });

    res.json({ success: "Bird archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
