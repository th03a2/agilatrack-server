import Lofts from "../models/Lofts.js";
import {
  canAccessClubWorkspace,
  canManageClubWorkspace,
  hasPermission,
} from "../middleware/sessionAuth.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populateLoft = (query) =>
  query
    .populate("club", "name code abbr level location")
    .populate("manager", "fullName email mobile pid");

const buildLoftQuery = (query = {}) => {
  const {
    club,
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

  if (club) dbQuery.club = club;
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

const getAccessibleClubIds = (auth = {}) =>
  Array.from(
    new Set(
      (Array.isArray(auth.affiliations) ? auth.affiliations : [])
        .map((affiliation) =>
          affiliation?.club && typeof affiliation.club === "object"
            ? String(affiliation.club?._id || "")
            : String(affiliation?.club || ""),
        )
        .filter(Boolean),
    ),
  );

const canViewLoft = (auth = {}, loft = {}) => {
  const loftClubId =
    loft?.club && typeof loft.club === "object"
      ? String(loft.club?._id || "")
      : String(loft?.club || "");
  const loftManagerId =
    loft?.manager && typeof loft.manager === "object"
      ? String(loft.manager?._id || "")
      : String(loft?.manager || "");

  return (
    String(auth.userId || "") === loftManagerId ||
    hasPermission(auth, "admin:manage") ||
    canAccessClubWorkspace(auth, loftClubId)
  );
};

export const findAll = async (req, res) => {
  try {
    const dbQuery = buildLoftQuery(req.query);
    const requestedClubId = String(req.query?.club || "").trim();

    if (requestedClubId) {
      if (!canAccessClubWorkspace(req.auth, requestedClubId)) {
        return res.status(403).json({
          error: "You do not have access to this club's loft records.",
        });
      }
    } else if (!hasPermission(req.auth, "admin:manage")) {
      const accessibleClubIds = getAccessibleClubIds(req.auth);

      if (!accessibleClubIds.length) {
        return res.status(403).json({
          error: "You do not have access to loft records.",
        });
      }

      dbQuery.club = { $in: accessibleClubIds };
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
      return res.status(403).json({
        error: "You do not have access to this loft record.",
      });
    }

    res.json({ success: "Loft fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createLoft = async (req, res) => {
  try {
    const targetClubId = String(req.body?.club || "").trim();
    const requestedManagerId = String(req.body?.manager || req.auth?.userId || "").trim();

    if (!targetClubId) {
      return res.status(400).json({ error: "Club is required." });
    }

    if (!canAccessClubWorkspace(req.auth, targetClubId)) {
      return res.status(403).json({
        error: "You do not have access to create loft records for this club.",
      });
    }

    if (
      !canManageClubWorkspace(req.auth, targetClubId) &&
      String(req.auth?.userId || "") !== requestedManagerId
    ) {
      return res.status(403).json({
        error: "You can only create a loft record for your own account.",
      });
    }

    const created = await Lofts.create(req.body);
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
    const isOwnLoft = String(loft.manager || "") === String(req.auth?.userId || "");
    const nextManagerId = String(req.body?.manager || loft.manager || "").trim();

    if (!canManageClub && !isOwnLoft) {
      return res.status(403).json({
        error: "You do not have permission to update this loft record.",
      });
    }

    if (!canManageClub && nextManagerId !== String(req.auth?.userId || "")) {
      return res.status(403).json({
        error: "You can only keep this loft assigned to your own account.",
      });
    }

    loft.set(req.body);
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

    if (String(loft.manager || "") === String(req.auth?.userId || "")) {
      return res.status(403).json({
        error: "You cannot archive your own loft record.",
      });
    }

    if (
      !hasPermission(req.auth, "admin:manage") &&
      !canManageClubWorkspace(req.auth, String(loft.club || ""))
    ) {
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
