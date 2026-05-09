import ClubManagement from "../models/ClubManagement.js";
import {
  canAccessTenantClub,
  canManageTenantClub,
  denyTenantAccess,
  getPrimaryTenantClubId,
  normalizeTenantId,
  scopeQueryToTenant,
} from "../middleware/tenantIsolation.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populateManagement = (query) =>
  query
    .populate("user", "fullName email mobile pid isMale")
    .populate("club", "name code abbr level location");

const buildManagementQuery = (query = {}) => {
  const { user, club, title, authorization } = query;
  const dbQuery = { deletedAt: { $exists: false } };
  const titleFilter = title || authorization;

  if (user) dbQuery.user = user;
  if (club) dbQuery.club = club;
  if (titleFilter) {
    dbQuery.title = { $regex: titleFilter, $options: "i" };
  }

  return dbQuery;
};

export const findAll = async (req, res) => {
  try {
    const dbQuery = buildManagementQuery(req.query);
    const allowed = await scopeQueryToTenant(req, res, dbQuery, {
      field: "club",
      requestedClubId: req.query?.club || req.query?.clubId,
    });

    if (!allowed) {
      return null;
    }

    const payload = await populateManagement(
      ClubManagement.find(dbQuery),
    )
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: "Club management members fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateManagement(
      ClubManagement.findById(req.params.id),
    ).lean();

    if (!payload) {
      return res.status(404).json({ error: "Club management member not found" });
    }

    if (!canAccessTenantClub(req.auth, normalizeTenantId(payload.club))) {
      return denyTenantAccess(req, res, {
        attemptedClubId: normalizeTenantId(payload.club),
        reason: "Club management record request targeted another club.",
      });
    }

    res.json({ success: "Club management member fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createManagementMember = async (req, res) => {
  try {
    const targetClubId = normalizeTenantId(req.body?.club) || getPrimaryTenantClubId(req.auth);

    if (!canManageTenantClub(req.auth, targetClubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: targetClubId,
        reason: "Club management creation attempted outside the authenticated user's tenant.",
      });
    }

    const created = await ClubManagement.create({
      ...req.body,
      club: targetClubId,
    });
    const payload = await populateManagement(
      ClubManagement.findById(created._id),
    ).lean();

    res
      .status(201)
      .json({ success: "Club management member created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateManagementMember = async (req, res) => {
  try {
    const currentRecord = await ClubManagement.findById(req.params.id).select("club").lean();

    if (!currentRecord) {
      return res.status(404).json({ error: "Club management member not found" });
    }

    const currentClubId = normalizeTenantId(currentRecord.club);
    const nextClubId = normalizeTenantId(req.body?.club) || currentClubId;

    if (!canManageTenantClub(req.auth, currentClubId) || !canManageTenantClub(req.auth, nextClubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: nextClubId || currentClubId,
        reason: "Club management update attempted outside the authenticated user's tenant.",
      });
    }

    const payload = await populateManagement(
      ClubManagement.findByIdAndUpdate(req.params.id, {
        ...req.body,
        club: currentClubId,
      }, {
        new: true,
        runValidators: true,
      }),
    ).lean();

    if (!payload) {
      return res.status(404).json({ error: "Club management member not found" });
    }

    res.json({ success: "Club management member updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteManagementMember = async (req, res) => {
  try {
    const currentRecord = await ClubManagement.findById(req.params.id).select("club").lean();

    if (!currentRecord) {
      return res.status(404).json({ error: "Club management member not found" });
    }

    const clubId = normalizeTenantId(currentRecord.club);

    if (!canManageTenantClub(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Club management archive attempted outside the authenticated user's tenant.",
      });
    }

    const payload = await populateManagement(
      ClubManagement.findByIdAndUpdate(
        req.params.id,
        { deletedAt: new Date().toISOString() },
        { new: true },
      ),
    ).lean();

    if (!payload) {
      return res.status(404).json({ error: "Club management member not found" });
    }

    res.json({ success: "Club management member archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
