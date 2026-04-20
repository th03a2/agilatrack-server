import Officers from "../models/Officers.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populateOfficer = (query) =>
  query
    .populate("user", "fullName email mobile pid isMale")
    .populate("club", "name code abbr level location");

const buildOfficerQuery = (query = {}) => {
  const { user, club, authorization } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (user) dbQuery.user = user;
  if (club) dbQuery.club = club;
  if (authorization) {
    dbQuery.authorization = { $regex: authorization, $options: "i" };
  }

  return dbQuery;
};

export const findAll = async (req, res) => {
  try {
    const payload = await populateOfficer(Officers.find(buildOfficerQuery(req.query)))
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: "Officers fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateOfficer(Officers.findById(req.params.id)).lean();

    if (!payload) return res.status(404).json({ error: "Officer not found" });

    res.json({ success: "Officer fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createOfficer = async (req, res) => {
  try {
    const created = await Officers.create(req.body);
    const payload = await populateOfficer(Officers.findById(created._id)).lean();

    res.status(201).json({ success: "Officer created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateOfficer = async (req, res) => {
  try {
    const payload = await populateOfficer(
      Officers.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true,
      }),
    ).lean();

    if (!payload) return res.status(404).json({ error: "Officer not found" });

    res.json({ success: "Officer updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteOfficer = async (req, res) => {
  try {
    const payload = await populateOfficer(
      Officers.findByIdAndUpdate(
        req.params.id,
        { deletedAt: new Date().toISOString() },
        { new: true },
      ),
    ).lean();

    if (!payload) return res.status(404).json({ error: "Officer not found" });

    res.json({ success: "Officer archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
