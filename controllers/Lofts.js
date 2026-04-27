import {
  ensureOwnerOrClubManager,
  hasClubManagementAccess,
} from "../middleware/auth.js";
import Lofts from "../models/Lofts.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });
const SELF_LOFT_FIELDS = [
  "address",
  "capacity",
  "code",
  "coordinates",
  "name",
  "notes",
  "status",
];

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

const pickAllowedSelfLoftUpdates = (payload = {}) =>
  SELF_LOFT_FIELDS.reduce((accumulator, field) => {
    if (payload[field] !== undefined) {
      accumulator[field] = payload[field];
    }

    return accumulator;
  }, {});

export const findAll = async (req, res) => {
  try {
    const payload = await populateLoft(Lofts.find(buildLoftQuery(req.query)))
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

    res.json({ success: "Loft fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createLoft = async (req, res) => {
  try {
    const isManager = hasClubManagementAccess(req.auth);
    const managerId = req.body?.manager || req.auth.user._id;

    if (!isManager) {
      ensureOwnerOrClubManager(managerId, req.auth);
    }

    const created = await Lofts.create({
      ...req.body,
      manager: managerId,
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

    const isManager = hasClubManagementAccess(req.auth);
    ensureOwnerOrClubManager(loft.manager, req.auth);

    const nextPayload = isManager ? req.body : pickAllowedSelfLoftUpdates(req.body);

    if (!Object.keys(nextPayload || {}).length) {
      return res.status(400).json({ error: "No allowed loft fields were provided." });
    }

    loft.set(nextPayload);
    await loft.save();

    const payload = await populateLoft(Lofts.findById(loft._id)).lean();

    res.json({ success: "Loft updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteLoft = async (req, res) => {
  try {
    const loft = await Lofts.findById(req.params.id).select("manager");

    if (!loft) return res.status(404).json({ error: "Loft not found" });

    ensureOwnerOrClubManager(loft.manager, req.auth);

    const payload = await populateLoft(
      Lofts.findByIdAndUpdate(
        req.params.id,
        { deletedAt: new Date().toISOString(), status: "archived" },
        { new: true },
      ),
    ).lean();

    res.json({ success: "Loft archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
