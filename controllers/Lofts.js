import Lofts from "../models/Lofts.js";

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
