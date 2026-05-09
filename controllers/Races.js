import Races, { normalizeRaceCategory } from "../models/Races.js";
import {
  canAccessTenantClub,
  canManageTenantClub,
  denyTenantAccess,
  getPrimaryTenantClubId,
  normalizeTenantId,
  scopeQueryToTenant,
} from "../middleware/tenantIsolation.js";
import { listRaces, populateRace } from "../services/raceService.js";
import { clearCacheByPrefix } from "../utils/cache.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const buildRaceQuery = (query = {}) => {
  const {
    club,
    clubId,
    organizer,
    status,
    code,
    category,
    dateFrom,
    dateTo,
    region,
    province,
    municipality,
  } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (club || clubId) dbQuery.club = club || clubId;
  if (organizer) dbQuery.organizer = organizer;
  if (status) dbQuery.status = status;
  if (code) dbQuery.code = { $regex: code, $options: "i" };
  if (category) dbQuery.category = normalizeRaceCategory(category);
  if (region) dbQuery["departure.address.region"] = region;
  if (province) dbQuery["departure.address.province"] = province;
  if (municipality) dbQuery["departure.address.municipality"] = municipality;

  if (dateFrom || dateTo) {
    dbQuery.raceDate = {};
    if (dateFrom) dbQuery.raceDate.$gte = new Date(dateFrom);
    if (dateTo) dbQuery.raceDate.$lte = new Date(dateTo);
  }

  return dbQuery;
};

export const findAll = async (req, res) => {
  try {
    const filter = buildRaceQuery(req.query);
    const allowed = await scopeQueryToTenant(req, res, filter, {
      field: "club",
      requestedClubId: req.query?.club || req.query?.clubId,
    });

    if (!allowed) {
      return null;
    }

    const result = await listRaces({
      filter,
      query: req.query,
    });
    const payload = result.data;

    res.json({
      success: "Races fetched successfully",
      message: "Races fetched successfully",
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

export const findOne = async (req, res) => {
  try {
    const payload = await populateRace(Races.findById(req.params.id)).lean();

    if (!payload) return res.status(404).json({ error: "Race not found" });

    if (!canAccessTenantClub(req.auth, normalizeTenantId(payload.club))) {
      return denyTenantAccess(req, res, {
        attemptedClubId: normalizeTenantId(payload.club),
        reason: "Race detail request targeted another club.",
      });
    }

    res.json({ success: "Race fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createRace = async (req, res) => {
  try {
    const targetClubId = normalizeTenantId(req.body?.club) || getPrimaryTenantClubId(req.auth);

    if (!canManageTenantClub(req.auth, targetClubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: targetClubId,
        reason: "Race creation attempted outside the authenticated user's tenant.",
      });
    }

    const created = await Races.create({
      ...req.body,
      club: targetClubId,
      clubId: targetClubId,
      createdBy: req.auth?.userId,
      organizer: req.body?.organizer || req.auth?.userId,
      updatedBy: req.auth?.userId,
    });
    const payload = await populateRace(Races.findById(created._id)).lean();
    clearCacheByPrefix("races:list");
    clearCacheByPrefix("dashboard:stats");

    res.status(201).json({ success: "Race created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateRace = async (req, res) => {
  try {
    const race = await Races.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found" });

    const currentClubId = normalizeTenantId(race.club);
    const nextClubId = normalizeTenantId(req.body?.club) || currentClubId;

    if (!canManageTenantClub(req.auth, currentClubId) || !canManageTenantClub(req.auth, nextClubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: nextClubId || currentClubId,
        reason: "Race update attempted outside the authenticated user's tenant.",
      });
    }

    race.set({
      ...req.body,
      club: currentClubId,
      clubId: currentClubId,
      updatedBy: req.auth?.userId,
    });
    await race.save();

    const payload = await populateRace(Races.findById(race._id)).lean();
    clearCacheByPrefix("races:list");
    clearCacheByPrefix("dashboard:stats");

    res.json({ success: "Race updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteRace = async (req, res) => {
  try {
    const race = await Races.findById(req.params.id).select("club").lean();

    if (!race) return res.status(404).json({ error: "Race not found" });

    const clubId = normalizeTenantId(race.club);

    if (!canManageTenantClub(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Race archive attempted outside the authenticated user's tenant.",
      });
    }

    const payload = await populateRace(
      Races.findByIdAndUpdate(
        req.params.id,
        {
          deletedAt: new Date().toISOString(),
          status: "cancelled",
        },
        { new: true },
      ),
    ).lean();

    if (!payload) return res.status(404).json({ error: "Race not found" });
    clearCacheByPrefix("races:list");
    clearCacheByPrefix("dashboard:stats");

    res.json({ success: "Race archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
