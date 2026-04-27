import Birds from "../models/Birds.js";
import { v2 as cloudinary } from "cloudinary";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const encodePathSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

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
    const payloadInput = {
      ...req.body,
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

    return res.status(201).json({
      success: "Bird photo uploaded successfully",
      payload: {
        type,
        label: label || type,
        source: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        ownerKey: safeOwnerEmail,
        mimeType: uploadResult.format
          ? `image/${uploadResult.format}`
          : undefined,
      },
    });
  } catch (error) {
    sendError(res, error, 500);
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
      bird.set({
        ...req.body,
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
