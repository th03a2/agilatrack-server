import Birds from "../models/Birds.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populateBird = (query) =>
  query
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
    .populate("breeder", "fullName email mobile pid")
    .populate("parents.sire.pigeon", "bandNumber name sex color strain status")
    .populate("parents.dam.pigeon", "bandNumber name sex color strain status")
    .populate("healthRecords.administeredBy", "fullName email mobile pid");

const buildBirdQuery = (query = {}) => {
  const {
    affiliation,
    bandNumber,
    breeder,
    club,
    color,
    loft,
    name,
    owner,
    sex,
    status,
    strain,
  } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (affiliation) dbQuery.affiliation = affiliation;
  if (bandNumber) dbQuery.bandNumber = { $regex: bandNumber, $options: "i" };
  if (breeder) dbQuery.breeder = breeder;
  if (club) dbQuery.club = club;
  if (color) dbQuery.color = { $regex: color, $options: "i" };
  if (loft) dbQuery.loft = loft;
  if (name) dbQuery.name = { $regex: name, $options: "i" };
  if (owner) dbQuery.owner = owner;
  if (sex) dbQuery.sex = sex;
  if (status) dbQuery.status = status;
  if (strain) dbQuery.strain = { $regex: strain, $options: "i" };

  return dbQuery;
};

export const findAll = async (req, res) => {
  try {
    const payload = await populateBird(Birds.find(buildBirdQuery(req.query)))
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Birds fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateBird(Birds.findById(req.params.id)).lean({
      virtuals: true,
    });

    if (!payload) return res.status(404).json({ error: "Bird not found" });

    res.json({ success: "Bird fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createBird = async (req, res) => {
  try {
    const created = await Birds.create(req.body);
    const payload = await populateBird(Birds.findById(created._id)).lean({
      virtuals: true,
    });

    res.status(201).json({ success: "Bird created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateBird = async (req, res) => {
  try {
    const bird = await Birds.findById(req.params.id);
    if (!bird) return res.status(404).json({ error: "Bird not found" });

    bird.set(req.body);
    await bird.save();

    const payload = await populateBird(Birds.findById(bird._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Bird updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteBird = async (req, res) => {
  try {
    const payload = await populateBird(
      Birds.findByIdAndUpdate(
        req.params.id,
        { deletedAt: new Date().toISOString(), status: "archived" },
        { new: true },
      ),
    ).lean({ virtuals: true });

    if (!payload) return res.status(404).json({ error: "Bird not found" });

    res.json({ success: "Bird archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
