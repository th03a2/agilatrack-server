import Pigeons from "../models/Pigeons.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populatePigeon = (query) =>
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

const buildPigeonQuery = (query = {}) => {
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
    const payload = await populatePigeon(
      Pigeons.find(buildPigeonQuery(req.query)),
    )
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Pigeons fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populatePigeon(Pigeons.findById(req.params.id)).lean({
      virtuals: true,
    });

    if (!payload) return res.status(404).json({ error: "Pigeon not found" });

    res.json({ success: "Pigeon fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createPigeon = async (req, res) => {
  try {
    const created = await Pigeons.create(req.body);
    const payload = await populatePigeon(Pigeons.findById(created._id)).lean({
      virtuals: true,
    });

    res.status(201).json({ success: "Pigeon created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updatePigeon = async (req, res) => {
  try {
    const pigeon = await Pigeons.findById(req.params.id);
    if (!pigeon) return res.status(404).json({ error: "Pigeon not found" });

    pigeon.set(req.body);
    await pigeon.save();

    const payload = await populatePigeon(Pigeons.findById(pigeon._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Pigeon updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deletePigeon = async (req, res) => {
  try {
    const payload = await populatePigeon(
      Pigeons.findByIdAndUpdate(
        req.params.id,
        { deletedAt: new Date().toISOString(), status: "archived" },
        { new: true },
      ),
    ).lean({ virtuals: true });

    if (!payload) return res.status(404).json({ error: "Pigeon not found" });

    res.json({ success: "Pigeon archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
