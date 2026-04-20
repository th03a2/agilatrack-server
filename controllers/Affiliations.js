import Affiliations from "../models/Affiliations.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populateAffiliation = (query) =>
  query
    .populate("user", "fullName email mobile pid isMale")
    .populate("club", "name code abbr level location")
    .populate("primaryLoft", "name code coordinates address status")
    .populate("lofts", "name code coordinates address status");

const buildAffiliationQuery = (query = {}) => {
  const {
    user,
    club,
    status,
    mobile,
    memberCode,
    membershipType,
    role,
    primaryLoft,
  } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (user) dbQuery.user = user;
  if (club) dbQuery.club = club;
  if (status) dbQuery.status = status;
  if (mobile) dbQuery.mobile = { $regex: mobile, $options: "i" };
  if (memberCode) dbQuery.memberCode = { $regex: memberCode, $options: "i" };
  if (membershipType) dbQuery.membershipType = membershipType;
  if (role) dbQuery.roles = role;
  if (primaryLoft) dbQuery.primaryLoft = primaryLoft;

  return dbQuery;
};

export const findAll = async (req, res) => {
  try {
    const payload = await populateAffiliation(
      Affiliations.find(buildAffiliationQuery(req.query)),
    )
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Affiliations fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateAffiliation(
      Affiliations.findById(req.params.id),
    ).lean({ virtuals: true });

    if (!payload) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    res.json({ success: "Affiliation fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createAffiliation = async (req, res) => {
  try {
    const created = await Affiliations.create(req.body);
    const payload = await populateAffiliation(
      Affiliations.findById(created._id),
    ).lean({ virtuals: true });

    res.status(201).json({
      success: "Affiliation created successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateAffiliation = async (req, res) => {
  try {
    const affiliation = await Affiliations.findById(req.params.id);

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    affiliation.set(req.body);
    await affiliation.save();

    const payload = await populateAffiliation(
      Affiliations.findById(affiliation._id),
    ).lean({ virtuals: true });

    res.json({ success: "Affiliation updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteAffiliation = async (req, res) => {
  try {
    const payload = await populateAffiliation(
      Affiliations.findByIdAndUpdate(
        req.params.id,
        {
          deletedAt: new Date().toISOString(),
          status: "deactivated",
        },
        { new: true },
      ),
    ).lean({ virtuals: true });

    if (!payload) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    res.json({ success: "Affiliation archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
