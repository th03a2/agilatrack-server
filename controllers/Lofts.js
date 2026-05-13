import Lofts from "../models/Lofts.js";
import {
  canAccessClubWorkspace,
  canManageClubWorkspace,
  hasPermission,
  hasRoleBucket,
} from "../middleware/sessionAuth.js";
import {
  denyTenantAccess,
  getAccessibleClubIds as getTenantAccessibleClubIds,
  isTenantSuperAdmin,
} from "../middleware/tenantIsolation.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const resolveId = (value = "") =>
  value && typeof value === "object"
    ? String(value._id || value.id || value.toString?.() || "").trim()
    : String(value || "").trim();

const getApprovedAffiliations = (auth = {}) =>
  (Array.isArray(auth.affiliations) ? auth.affiliations : []).filter(
    (affiliation) =>
      affiliation?.status === "approved" &&
      !affiliation?.deletedAt &&
      resolveId(affiliation?.club),
  );

const getApprovedAffiliationForClub = (auth = {}, clubId = "") =>
  getApprovedAffiliations(auth).find(
    (affiliation) => resolveId(affiliation?.club) === String(clubId || ""),
  );

const isGuestLoftUser = (auth = {}) =>
  hasRoleBucket(auth, "guest") &&
  !hasPermission(auth, "records:self") &&
  !hasPermission(auth, "club:manage") &&
  !isTenantSuperAdmin(auth);

const applySelfLoftScope = (dbQuery, auth = {}) => {
  dbQuery.$or = [
    { manager: auth.userId },
    { ownerId: auth.userId },
  ];
};

const applyClubLoftScope = (dbQuery, auth = {}, accessibleClubIds = []) => {
  const manageableClubIds = accessibleClubIds.filter((clubId) =>
    canManageClubWorkspace(auth, clubId),
  );

  if (!manageableClubIds.length) {
    dbQuery.club = { $in: accessibleClubIds };
    applySelfLoftScope(dbQuery, auth);
    return;
  }

  if (manageableClubIds.length === accessibleClubIds.length) {
    dbQuery.club = { $in: accessibleClubIds };
    return;
  }

  const selfScopedClubIds = accessibleClubIds.filter(
    (clubId) => !manageableClubIds.includes(clubId),
  );

  dbQuery.$or = [
    { club: { $in: manageableClubIds } },
    { club: { $in: selfScopedClubIds }, manager: auth.userId },
    { club: { $in: selfScopedClubIds }, ownerId: auth.userId },
  ];
};

const populateLoft = (query) =>
  query
    .populate("club", "name code abbr level location")
    .populate("manager", "fullName email mobile pid")
    .populate("ownerId", "fullName email mobile pid");

const buildLoftQuery = (query = {}) => {
  const {
    club,
    clubId,
    manager,
    code,
    status,
    region,
    regionCode,
    province,
    provinceCode,
    municipality,
    municipalityCode,
    barangayCode,
  } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (club || clubId) dbQuery.club = club || clubId;
  if (manager) dbQuery.manager = manager;
  if (code) dbQuery.code = { $regex: code, $options: "i" };
  if (status) dbQuery.status = status;
  if (region) dbQuery["address.region"] = region;
  if (regionCode) dbQuery["address.regionCode"] = regionCode;
  if (province) dbQuery["address.province"] = province;
  if (provinceCode) dbQuery["address.provinceCode"] = provinceCode;
  if (municipality) dbQuery["address.municipality"] = municipality;
  if (municipalityCode) dbQuery["address.municipalityCode"] = municipalityCode;
  if (barangayCode) dbQuery["address.barangayCode"] = barangayCode;

  return dbQuery;
};

const canViewLoft = (auth = {}, loft = {}) => {
  const loftClubId =
    loft?.club && typeof loft.club === "object"
      ? String(loft.club?._id || "")
      : String(loft?.club || "");
  const loftManagerId =
    loft?.manager && typeof loft.manager === "object"
      ? String(loft.manager?._id || "")
      : String(loft?.manager || "");
  const loftOwnerId =
    loft?.ownerId && typeof loft.ownerId === "object"
      ? String(loft.ownerId?._id || "")
      : String(loft?.ownerId || "");

  return (
    String(auth.userId || "") === loftManagerId ||
    String(auth.userId || "") === loftOwnerId ||
    isTenantSuperAdmin(auth) ||
    canManageClubWorkspace(auth, loftClubId)
  );
};

export const findAll = async (req, res) => {
  try {
    const dbQuery = buildLoftQuery(req.query);
    const requestedClubId = String(req.query?.club || req.query?.clubId || "").trim();

    if (requestedClubId) {
      if (!canAccessClubWorkspace(req.auth, requestedClubId)) {
        return denyTenantAccess(req, res, {
          attemptedClubId: requestedClubId,
          message: "You do not have access to this club's loft records.",
          reason: "Loft list requested another club.",
        });
      }

      if (!canManageClubWorkspace(req.auth, requestedClubId)) {
        applySelfLoftScope(dbQuery, req.auth);
      }
    } else if (!isTenantSuperAdmin(req.auth)) {
      const accessibleClubIds = getTenantAccessibleClubIds(req.auth);

      if (!accessibleClubIds.length) {
        return res.status(403).json({
          error: "You do not have access to loft records.",
        });
      }

      applyClubLoftScope(dbQuery, req.auth, accessibleClubIds);
    }

    const payload = await populateLoft(Lofts.find(dbQuery))
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: "Lofts fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateLoft(Lofts.findById(req.params.id)).lean();

    if (!payload) return res.status(404).json({ error: "Loft not found" });
    if (!canViewLoft(req.auth, payload)) {
      return denyTenantAccess(req, res, {
        attemptedClubId:
          payload?.club && typeof payload.club === "object" ? payload.club?._id : payload?.club,
        message: "You do not have access to this loft record.",
        reason: "Loft detail requested another club.",
      });
    }

    res.json({ success: "Loft fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createLoft = async (req, res) => {
  try {
    const requestedClubId = String(req.body?.clubId || req.body?.club || "").trim();
    const approvedAffiliations = getApprovedAffiliations(req.auth);
    const derivedClubId =
      requestedClubId ||
      (approvedAffiliations.length === 1 ? resolveId(approvedAffiliations[0].club) : "");
    const canManageTargetClub = derivedClubId
      ? canManageClubWorkspace(req.auth, derivedClubId)
      : false;
    const requestedManagerId = String(req.body?.manager || req.body?.ownerId || "").trim();
    const currentUserId = String(req.auth?.userId || "").trim();

    if (!approvedAffiliations.length && !isTenantSuperAdmin(req.auth)) {
      return res.status(403).json({
        error: isGuestLoftUser(req.auth)
          ? "You need an approved membership before creating a loft."
          : "Approved club membership is required.",
      });
    }

    if (!derivedClubId) {
      return res.status(400).json({ error: "Approved club membership is required." });
    }

    if (!canAccessClubWorkspace(req.auth, derivedClubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: derivedClubId,
        message: "You do not have permission to manage this loft.",
        reason: "Loft creation attempted outside tenant.",
      });
    }

    if (!canManageTargetClub && !getApprovedAffiliationForClub(req.auth, derivedClubId)) {
      return res.status(403).json({
        error: "Approved club membership is required.",
      });
    }

    if (!canManageTargetClub && requestedManagerId && requestedManagerId !== currentUserId) {
      return res.status(403).json({
        error: "You do not have permission to manage this loft.",
      });
    }

    const assignedManagerId =
      canManageTargetClub && requestedManagerId ? requestedManagerId : currentUserId;

    const created = await Lofts.create({
      ...req.body,
      club: derivedClubId,
      clubId: derivedClubId,
      createdBy: req.auth?.userId,
      manager: assignedManagerId,
      ownerId: assignedManagerId,
      updatedBy: req.auth?.userId,
    });
    const payload = await populateLoft(Lofts.findById(created._id)).lean();

    res.status(201).json({ success: "Loft created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateLoft = async (req, res) => {
  try {
    const loft = await Lofts.findById(req.params.id);
    if (!loft) return res.status(404).json({ error: "Loft not found" });

    const clubId = String(loft.club || req.body?.club || "").trim();
    const canManageClub = canManageClubWorkspace(req.auth, clubId);
    const isOwnLoft =
      String(loft.manager || "") === String(req.auth?.userId || "") ||
      String(loft.ownerId || "") === String(req.auth?.userId || "");
    const nextManagerId = String(req.body?.manager || loft.manager || "").trim();

    if (!canManageClub && !isOwnLoft) {
      return res.status(403).json({
        error: "You do not have permission to manage this loft.",
      });
    }

    if (!canManageClub && nextManagerId !== String(req.auth?.userId || "")) {
      return res.status(403).json({
        error: "You do not have permission to manage this loft.",
      });
    }

    loft.set({
      ...req.body,
      club: clubId,
      clubId,
      ownerId: nextManagerId,
      manager: nextManagerId,
      updatedBy: req.auth?.userId,
    });
    await loft.save();

    const payload = await populateLoft(Lofts.findById(loft._id)).lean();

    res.json({ success: "Loft updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteLoft = async (req, res) => {
  try {
    const loft = await Lofts.findById(req.params.id);
    if (!loft) return res.status(404).json({ error: "Loft not found" });

    if (
      String(loft.manager || loft.ownerId || "") === String(req.auth?.userId || "") &&
      loft.status === "active"
    ) {
      return res.status(403).json({
        error: "You cannot archive your own active loft because it may break your club account and race distance records.",
      });
    }

    if (!canManageClubWorkspace(req.auth, String(loft.club || ""))) {
      return res.status(403).json({
        error: "You do not have permission to archive this loft record.",
      });
    }

    const payload = await populateLoft(
      Lofts.findByIdAndUpdate(
        req.params.id,
        { deletedAt: new Date().toISOString(), status: "archived" },
        { new: true },
      ),
    ).lean();

    if (!payload) return res.status(404).json({ error: "Loft not found" });

    res.json({ success: "Loft archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
