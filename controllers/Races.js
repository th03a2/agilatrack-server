import Races, { normalizeRaceCategory } from "../models/Races.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populateRace = (query) =>
  query
    .populate({
      path: "club",
      select: "name code abbr level type location parent",
      populate: {
        path: "parent",
        select: "name code abbr level type location",
      },
    })
    .populate("organizer", "fullName email mobile pid");

const buildRaceQuery = (query = {}) => {
  const {
    club,
    organizer,
    status,
    code,
    category,
    dateFrom,
    dateTo,
    region,
    province,
    municipality,
  } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (club) dbQuery.club = club;
  if (organizer) dbQuery.organizer = organizer;
  if (status) dbQuery.status = status;
  if (code) dbQuery.code = { $regex: code, $options: "i" };
  if (category) dbQuery.category = normalizeRaceCategory(category);
  if (region) dbQuery["departure.address.region"] = region;
  if (province) dbQuery["departure.address.province"] = province;
  if (municipality) dbQuery["departure.address.municipality"] = municipality;

  if (dateFrom || dateTo) {
    dbQuery.raceDate = {};
    if (dateFrom) dbQuery.raceDate.$gte = new Date(dateFrom);
    if (dateTo) dbQuery.raceDate.$lte = new Date(dateTo);
  }

  return dbQuery;
};

export const findAll = async (req, res) => {
  try {
    const payload = await populateRace(Races.find(buildRaceQuery(req.query)))
      .sort({ raceDate: -1, createdAt: -1 })
      .lean();

    res.json({ success: "Races fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateRace(Races.findById(req.params.id)).lean();

    if (!payload) return res.status(404).json({ error: "Race not found" });

    res.json({ success: "Race fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createRace = async (req, res) => {
  try {
    const created = await Races.create(req.body);
    const payload = await populateRace(Races.findById(created._id)).lean();

    res.status(201).json({ success: "Race created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateRace = async (req, res) => {
  try {
    const race = await Races.findById(req.params.id);
    if (!race) return res.status(404).json({ error: "Race not found" });

    race.set(req.body);
    await race.save();

    const payload = await populateRace(Races.findById(race._id)).lean();

    res.json({ success: "Race updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteRace = async (req, res) => {
  try {
    const payload = await populateRace(
      Races.findByIdAndUpdate(
        req.params.id,
        {
          deletedAt: new Date().toISOString(),
          status: "cancelled",
        },
        { new: true },
      ),
    ).lean();

    if (!payload) return res.status(404).json({ error: "Race not found" });

    res.json({ success: "Race archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
