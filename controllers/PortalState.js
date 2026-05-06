import mongoose from "mongoose";
import PortalStates from "../models/PortalState.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const normalizeText = (value = "") => String(value || "").trim();

const buildQuery = (query = {}) => {
  const dbQuery = { deletedAt: { $exists: false } };
  const { club, domain, entityId, entityType, module } = query;

  if (domain) dbQuery.domain = normalizeText(domain).toLowerCase();
  if (module) dbQuery.module = normalizeText(module).toLowerCase();
  if (entityType) dbQuery.entityType = normalizeText(entityType).toLowerCase();
  if (entityId) dbQuery.entityId = normalizeText(entityId);

  if (club && mongoose.Types.ObjectId.isValid(club)) {
    dbQuery.club = club;
  }

  return dbQuery;
};

export const findAll = async (req, res) => {
  try {
    const payload = await PortalStates.find(buildQuery(req.query))
      .populate("club", "name code abbr level location")
      .populate("updatedBy", "fullName email mobile")
      .sort({ updatedAt: -1, createdAt: -1 })
      .lean({ virtuals: true });

    res.json({
      success: "Portal state records fetched successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const upsertOne = async (req, res) => {
  try {
    const domain = normalizeText(req.params.domain).toLowerCase();
    const module = normalizeText(req.params.module).toLowerCase();
    const entityType = normalizeText(req.params.entityType).toLowerCase();
    const entityId = normalizeText(req.params.entityId);

    if (!domain || !module || !entityType || !entityId) {
      throw new Error("Domain, module, entity type, and entity id are required.");
    }

    const update = {
      club:
        req.body.club && mongoose.Types.ObjectId.isValid(req.body.club)
          ? req.body.club
          : undefined,
      data:
        req.body.data && typeof req.body.data === "object" ? req.body.data : {},
      deletedAt: undefined,
      domain,
      entityId,
      entityType,
      meta:
        req.body.meta && typeof req.body.meta === "object" ? req.body.meta : {},
      module,
      updatedBy:
        req.auth?.userId && mongoose.Types.ObjectId.isValid(req.auth.userId)
          ? req.auth.userId
          : undefined,
    };

    const payload = await PortalStates.findOneAndUpdate(
      { deletedAt: { $exists: false }, domain, entityId, entityType, module },
      update,
      {
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
        upsert: true,
      },
    )
      .populate("club", "name code abbr level location")
      .populate("updatedBy", "fullName email mobile");

    res.json({
      success: "Portal state record saved successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteOne = async (req, res) => {
  try {
    const domain = normalizeText(req.params.domain).toLowerCase();
    const module = normalizeText(req.params.module).toLowerCase();
    const entityType = normalizeText(req.params.entityType).toLowerCase();
    const entityId = normalizeText(req.params.entityId);

    const payload = await PortalStates.findOneAndUpdate(
      { deletedAt: { $exists: false }, domain, entityId, entityType, module },
      { deletedAt: new Date().toISOString() },
      { new: true },
    ).lean({ virtuals: true });

    if (!payload) {
      return res.status(404).json({ error: "Portal state record not found" });
    }

    res.json({
      success: "Portal state record archived successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};
