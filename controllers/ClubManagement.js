import ClubManagement from "../models/ClubManagement.js";

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
    const payload = await populateManagement(
      ClubManagement.find(buildManagementQuery(req.query)),
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

    res.json({ success: "Club management member fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createManagementMember = async (req, res) => {
  try {
    const created = await ClubManagement.create(req.body);
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
    const payload = await populateManagement(
      ClubManagement.findByIdAndUpdate(req.params.id, req.body, {
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
