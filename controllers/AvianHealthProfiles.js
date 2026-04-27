import AvianHealthProfiles from "../models/AvianHealthProfiles.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populateProfile = (query) =>
  query
    .populate("bird", "bandNumber name sex color strain hatchYear status")
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
    .populate("records.administeredBy", "fullName email mobile pid");

const buildProfileQuery = (query = {}) => {
  const { affiliation, bird, club, loft, owner } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (affiliation) dbQuery.affiliation = affiliation;
  if (bird) dbQuery.bird = bird;
  if (club) dbQuery.club = club;
  if (loft) dbQuery.loft = loft;
  if (owner) dbQuery.owner = owner;

  return dbQuery;
};

export const findAll = async (req, res) => {
  try {
    const payload = await populateProfile(
      AvianHealthProfiles.find(buildProfileQuery(req.query)),
    )
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Avian health profiles fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateProfile(
      AvianHealthProfiles.findById(req.params.id),
    ).lean({ virtuals: true });

    if (!payload) {
      return res.status(404).json({ error: "Avian health profile not found" });
    }

    res.json({ success: "Avian health profile fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createProfile = async (req, res) => {
  try {
    const created = await AvianHealthProfiles.create(req.body);
    const payload = await populateProfile(
      AvianHealthProfiles.findById(created._id),
    ).lean({ virtuals: true });

    res.status(201).json({
      success: "Avian health profile created successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateProfile = async (req, res) => {
  try {
    const profile = await AvianHealthProfiles.findById(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: "Avian health profile not found" });
    }

    profile.set(req.body);
    await profile.save();

    const payload = await populateProfile(
      AvianHealthProfiles.findById(profile._id),
    ).lean({ virtuals: true });

    res.json({
      success: "Avian health profile updated successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteProfile = async (req, res) => {
  try {
    const payload = await populateProfile(
      AvianHealthProfiles.findByIdAndUpdate(
        req.params.id,
        { deletedAt: new Date().toISOString() },
        { new: true },
      ),
    ).lean({ virtuals: true });

    if (!payload) {
      return res.status(404).json({ error: "Avian health profile not found" });
    }

    res.json({
      success: "Avian health profile archived successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};
