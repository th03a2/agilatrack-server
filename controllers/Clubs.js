import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Clubs, {
  CLUB_LEVELS,
  CLUB_PARENT_LEVEL,
  CLUB_TYPES,
  getClubTypeFromLevel,
} from "../models/Clubs.js";
import {
  canAccessTenantClub,
  canManageTenantClub,
  denyTenantAccess,
  getAccessibleClubIds,
  isTenantSuperAdmin,
  normalizeTenantId,
  scopeQueryToTenant,
} from "../middleware/tenantIsolation.js";
import { listClubs } from "../services/clubService.js";
import { clearCacheByPrefix } from "../utils/cache.js";
import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.join(__dirname, "..", ".env");

const getCloudinaryConfig = () => ({
  cloudName: String(process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
  apiKey: String(process.env.CLOUDINARY_API_KEY || "").trim(),
  apiSecret: String(process.env.CLOUDINARY_API_SECRET || "").trim(),
});

const isCloudinaryConfigured = () =>
  Boolean(
    getCloudinaryConfig().cloudName &&
      getCloudinaryConfig().apiKey &&
      getCloudinaryConfig().apiSecret,
  );

const applyCloudinaryConfig = () => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret) return false;

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  return true;
};

const refreshCloudinaryConfig = () => {
  dotenv.config({ path: ENV_PATH, override: true, quiet: true });
  return applyCloudinaryConfig();
};

const encodePathSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const getCloudinaryErrorDetails = (error) => {
  const nestedError = error?.error && typeof error.error === "object" ? error.error : null;
  const rawMessage =
    nestedError?.message ||
    error?.message ||
    "Club logo upload failed";

  return {
    message: rawMessage,
    code: nestedError?.http_code || error?.http_code || null,
  };
};

refreshCloudinaryConfig();

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const normalizeStatus = (value = "") => String(value || "").trim().toLowerCase();

const isPublicClubDirectoryRequest = (req) =>
  ["directory", "guest", "public"].includes(
    normalizeStatus(req.query?.directory || req.query?.scope),
  );

const shouldScopeAuthenticatedClubDirectory = (req) =>
  Boolean(
    req.auth &&
      !isTenantSuperAdmin(req.auth) &&
      getAccessibleClubIds(req.auth).length &&
      !isPublicClubDirectoryRequest(req),
  );

const normalizeParent = (parent) => {
  if (parent === undefined) return undefined;
  if (parent === null || parent === "") return null;
  return parent;
};

const getParentRequirement = (level) => CLUB_PARENT_LEVEL[level];

const validateClubHierarchy = async (club, currentId = null) => {
  if (!CLUB_LEVELS.includes(club.level)) {
    throw new Error(`Invalid club level. Use: ${CLUB_LEVELS.join(", ")}.`);
  }

  const expectedParentLevel = getParentRequirement(club.level);
  const parent = normalizeParent(club.parent);

  if (!expectedParentLevel) {
    if (parent) throw new Error("National clubs must not have a parent.");
    return { ...club, parent: null };
  }

  if (!parent) {
    throw new Error(
      `${club.level} clubs must have a ${expectedParentLevel} parent.`,
    );
  }

  if (!mongoose.Types.ObjectId.isValid(parent)) {
    throw new Error("Parent club id is invalid.");
  }

  if (currentId && parent.toString() === currentId.toString()) {
    throw new Error("A club cannot be its own parent.");
  }

  const parentClub = await Clubs.findOne({
    _id: parent,
    deletedAt: { $exists: false },
  })
    .select("level")
    .lean();

  if (!parentClub) throw new Error("Parent club not found.");

  if (parentClub.level !== expectedParentLevel) {
    throw new Error(
      `${club.level} clubs must be under a ${expectedParentLevel} club.`,
    );
  }

  return { ...club, parent };
};

export const findAll = async (req, res) => {
  try {
    const {
      level,
      type,
      parent,
      code,
      region,
      regionCode,
      province,
      provinceCode,
      municipality,
      municipalityCode,
      barangayCode,
    } = req.query;
    const query = { deletedAt: { $exists: false } };

    if (level) query.level = level;
    if (type) query.type = type;
    if (parent) query.parent = parent;
    if (code) query.code = { $regex: code, $options: "i" };
    if (region) query["location.region"] = region;
    if (regionCode) query["location.regionCode"] = regionCode;
    if (province) query["location.province"] = province;
    if (provinceCode) query["location.provinceCode"] = provinceCode;
    if (municipality) query["location.municipality"] = municipality;
    if (municipalityCode) query["location.municipalityCode"] = municipalityCode;
    if (barangayCode) query["location.barangayCode"] = barangayCode;

    if (shouldScopeAuthenticatedClubDirectory(req)) {
      const requestedClubId = normalizeTenantId(req.query?.club || req.query?.clubId || req.query?.id);

      if (requestedClubId) {
        if (!canAccessTenantClub(req.auth, requestedClubId)) {
          return denyTenantAccess(req, res, {
            attemptedClubId: requestedClubId,
            reason: "Authenticated club directory request targeted another club.",
          });
        }

        query._id = requestedClubId;
      } else {
        query._id = { $in: getAccessibleClubIds(req.auth) };
      }
    }

    const result = await listClubs({
      filter: query,
      query: req.query,
    });
    const payload = result.data;

    res.json({
      success: "Clubs fetched successfully",
      message: "Clubs fetched successfully",
      data: payload,
      payload,
      page: result.page,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const findLevels = async (req, res) => {
  res.json({
    success: "Club hierarchy levels fetched successfully",
    payload: {
      levels: CLUB_LEVELS,
      types: CLUB_TYPES,
      parentLevel: CLUB_PARENT_LEVEL,
      pyramid: ["national", "regional", "provincial", "municipality"],
      typeByLevel: Object.fromEntries(
        CLUB_LEVELS.map((level) => [level, getClubTypeFromLevel(level)]),
      ),
    },
  });
};

export const findOne = async (req, res) => {
  try {
    if (
      shouldScopeAuthenticatedClubDirectory(req) &&
      !canAccessTenantClub(req.auth, req.params.id)
    ) {
      return denyTenantAccess(req, res, {
        attemptedClubId: req.params.id,
        reason: "Authenticated club detail request targeted another club.",
      });
    }

    const payload = await Clubs.findById(req.params.id)
      .populate("parent", "name level location")
      .lean();

    if (!payload) return res.status(404).json({ error: "Club not found" });

    res.json({ success: "Club fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createClub = async (req, res) => {
  try {
    if (!isTenantSuperAdmin(req.auth)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: req.body?._id || req.body?.parent,
        reason: "Only super admins can create new club tenants.",
      });
    }

    const club = await validateClubHierarchy({
      ...req.body,
      isActive: false,
      status: "pending",
    });
    const payload = await Clubs.create(club);
    clearCacheByPrefix("clubs:list");
    res.status(201).json({ success: "Club created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateClub = async (req, res) => {
  try {
    if (!canManageTenantClub(req.auth, req.params.id)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: req.params.id,
        reason: "Club update attempted outside the authenticated user's tenant.",
      });
    }

    const payload = await Clubs.findById(req.params.id);
    if (!payload) return res.status(404).json({ error: "Club not found" });

    payload.set(req.body);
    const nextStatus = normalizeStatus(payload.status);

    if (nextStatus === "approved") {
      payload.isActive = true;
    } else if (["declined", "pending"].includes(nextStatus)) {
      payload.isActive = false;
    }

    const club = await validateClubHierarchy(
      payload.toObject(),
      req.params.id,
    );
    payload.parent = club.parent;
    await payload.save();
    clearCacheByPrefix("clubs:list");

    res.json({ success: "Club updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteClub = async (req, res) => {
  try {
    if (!canManageTenantClub(req.auth, req.params.id)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: req.params.id,
        reason: "Club archive attempted outside the authenticated user's tenant.",
      });
    }

    const payload = await Clubs.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date().toISOString() },
      { new: true },
    );
    if (!payload) return res.status(404).json({ error: "Club not found" });
    clearCacheByPrefix("clubs:list");

    res.json({ success: "Club deleted successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

const buildClubTree = async (club) => {
  const children = await Clubs.find({
    parent: club._id,
    deletedAt: { $exists: false },
  })
    .sort({ level: 1, name: 1 })
    .lean();

  const nested = await Promise.all(children.map(buildClubTree));
  return { ...club, children: nested };
};

export const findChildren = async (req, res) => {
  try {
    if (
      shouldScopeAuthenticatedClubDirectory(req) &&
      !canAccessTenantClub(req.auth, req.params.id)
    ) {
      return denyTenantAccess(req, res, {
        attemptedClubId: req.params.id,
        reason: "Club children request targeted another club.",
      });
    }

    const club = await Clubs.findById(req.params.id).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });

    const payload = await Clubs.find({
      parent: req.params.id,
      deletedAt: { $exists: false },
    })
      .sort({ name: 1 })
      .lean();

    res.json({ success: "Club children fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const uploadClubLogo = async (req, res) => {
  try {
    if (!canManageTenantClub(req.auth, req.params.id)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: req.params.id,
        reason: "Club logo update attempted outside the authenticated user's tenant.",
      });
    }

    const cloudinaryReady = refreshCloudinaryConfig();
    if (!cloudinaryReady || !isCloudinaryConfigured()) {
      return res.status(500).json({
        error: "Cloudinary is not configured",
        message:
          "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env.",
      });
    }

    const club = await Clubs.findById(req.params.id).select(
      "_id code abbr name logo",
    );
    if (!club) {
      return res.status(404).json({ error: "Club not found" });
    }

    const source = String(req.body?.source || "").trim();
    if (!source.startsWith("data:image/")) {
      return res.status(400).json({
        error: "Invalid image payload",
        message: "Club logo upload expects a base64 image data URL.",
      });
    }

    const safeCode = encodePathSegment(club.code || club.abbr || club.name);
    const uploadResult = await cloudinary.uploader.upload(source, {
      folder: `clubs/${safeCode}`,
      public_id: "logo",
      resource_type: "image",
      overwrite: true,
      invalidate: true,
    });

    const logo = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      version: uploadResult.version ? String(uploadResult.version) : "",
      updatedAt: new Date(),
    };

    const payload = await Clubs.findByIdAndUpdate(
      req.params.id,
      { $set: { logo } },
      {
        new: true,
        runValidators: false,
      },
    );
    clearCacheByPrefix("clubs:list");

    return res.status(201).json({
      success: "Club logo uploaded successfully",
      payload,
    });
  } catch (error) {
    const details = getCloudinaryErrorDetails(error);

    return res.status(500).json({
      error: details.message,
      code: details.code,
    });
  }
};

export const findPyramid = async (req, res) => {
  try {
    if (shouldScopeAuthenticatedClubDirectory(req)) {
      const scopedQuery = { deletedAt: { $exists: false } };
      const allowed = await scopeQueryToTenant(req, res, scopedQuery, { field: "_id" });

      if (!allowed) {
        return null;
      }

      const payload = await Clubs.find(scopedQuery).sort({ name: 1 }).lean();

      return res.json({ success: "Club pyramid fetched successfully", payload });
    }

    const roots = await Clubs.find({
      level: "national",
      deletedAt: { $exists: false },
    })
      .sort({ name: 1 })
      .lean();

    const payload = await Promise.all(roots.map(buildClubTree));
    res.json({ success: "Club pyramid fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findTree = async (req, res) => {
  try {
    if (
      shouldScopeAuthenticatedClubDirectory(req) &&
      !canAccessTenantClub(req.auth, req.params.id)
    ) {
      return denyTenantAccess(req, res, {
        attemptedClubId: req.params.id,
        reason: "Club tree request targeted another club.",
      });
    }

    const club = await Clubs.findById(req.params.id).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });

    const payload = await buildClubTree(club);
    res.json({ success: "Club tree fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

// Public endpoint for landing page stats
export const findPublicClubs = async (req, res) => {
  try {
    const publicClubs = await Clubs.find({ 
      deletedAt: { $exists: false },
      isActive: true
    })
    .select("name level location contactInfo")
    .lean()
    .limit(100); // Limit for performance and security

    res.json({ success: "Public clubs fetched successfully", payload: publicClubs });
  } catch (error) {
    sendError(res, error);
  }
};
