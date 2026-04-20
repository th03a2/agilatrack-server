import mongoose from "mongoose";
import Clubs, { CLUB_LEVELS, CLUB_PARENT_LEVEL } from "../models/Clubs.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const normalizeParent = (parent) => {
  if (parent === undefined) return undefined;
  if (parent === null || parent === "") return null;
  return parent;
};

const getParentRequirement = (level) => CLUB_PARENT_LEVEL[level];

const validateClubHierarchy = async (club, currentId = null) => {
  if (!CLUB_LEVELS.includes(club.level)) {
    throw new Error(`Invalid club level. Use: ${CLUB_LEVELS.join(", ")}.`);
  }

  const expectedParentLevel = getParentRequirement(club.level);
  const parent = normalizeParent(club.parent);

  if (!expectedParentLevel) {
    if (parent) throw new Error("National clubs must not have a parent.");
    return { ...club, parent: null };
  }

  if (!parent) {
    throw new Error(
      `${club.level} clubs must have a ${expectedParentLevel} parent.`,
    );
  }

  if (!mongoose.Types.ObjectId.isValid(parent)) {
    throw new Error("Parent club id is invalid.");
  }

  if (currentId && parent.toString() === currentId.toString()) {
    throw new Error("A club cannot be its own parent.");
  }

  const parentClub = await Clubs.findOne({
    _id: parent,
    deletedAt: { $exists: false },
  })
    .select("level")
    .lean();

  if (!parentClub) throw new Error("Parent club not found.");

  if (parentClub.level !== expectedParentLevel) {
    throw new Error(
      `${club.level} clubs must be under a ${expectedParentLevel} club.`,
    );
  }

  return { ...club, parent };
};

export const findAll = async (req, res) => {
  try {
    const {
      level,
      parent,
      code,
      region,
      regionCode,
      province,
      provinceCode,
      municipality,
      municipalityCode,
      barangayCode,
    } = req.query;
    const query = { deletedAt: { $exists: false } };

    if (level) query.level = level;
    if (parent) query.parent = parent;
    if (code) query.code = { $regex: code, $options: "i" };
    if (region) query["location.region"] = region;
    if (regionCode) query["location.regionCode"] = regionCode;
    if (province) query["location.province"] = province;
    if (provinceCode) query["location.provinceCode"] = provinceCode;
    if (municipality) query["location.municipality"] = municipality;
    if (municipalityCode) query["location.municipalityCode"] = municipalityCode;
    if (barangayCode) query["location.barangayCode"] = barangayCode;

    const payload = await Clubs.find(query)
      .populate("parent", "name level location")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: "Clubs fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findLevels = async (req, res) => {
  res.json({
    success: "Club hierarchy levels fetched successfully",
    payload: {
      levels: CLUB_LEVELS,
      parentLevel: CLUB_PARENT_LEVEL,
      pyramid: ["national", "regional", "provincial", "municipality"],
    },
  });
};

export const findOne = async (req, res) => {
  try {
    const payload = await Clubs.findById(req.params.id)
      .populate("parent", "name level location")
      .lean();

    if (!payload) return res.status(404).json({ error: "Club not found" });

    res.json({ success: "Club fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createClub = async (req, res) => {
  try {
    const club = await validateClubHierarchy(req.body);
    const payload = await Clubs.create(club);
    res.status(201).json({ success: "Club created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateClub = async (req, res) => {
  try {
    const payload = await Clubs.findById(req.params.id);
    if (!payload) return res.status(404).json({ error: "Club not found" });

    payload.set(req.body);

    const club = await validateClubHierarchy(
      payload.toObject(),
      req.params.id,
    );
    payload.parent = club.parent;
    await payload.save();

    res.json({ success: "Club updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteClub = async (req, res) => {
  try {
    const payload = await Clubs.findByIdAndUpdate(
      req.params.id,
      { deletedAt: new Date().toISOString() },
      { new: true },
    );
    if (!payload) return res.status(404).json({ error: "Club not found" });

    res.json({ success: "Club deleted successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

const buildClubTree = async (club) => {
  const children = await Clubs.find({
    parent: club._id,
    deletedAt: { $exists: false },
  })
    .sort({ level: 1, name: 1 })
    .lean();

  const nested = await Promise.all(children.map(buildClubTree));
  return { ...club, children: nested };
};

export const findChildren = async (req, res) => {
  try {
    const club = await Clubs.findById(req.params.id).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });

    const payload = await Clubs.find({
      parent: req.params.id,
      deletedAt: { $exists: false },
    })
      .sort({ name: 1 })
      .lean();

    res.json({ success: "Club children fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findPyramid = async (req, res) => {
  try {
    const roots = await Clubs.find({
      level: "national",
      deletedAt: { $exists: false },
    })
      .sort({ name: 1 })
      .lean();

    const payload = await Promise.all(roots.map(buildClubTree));
    res.json({ success: "Club pyramid fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findTree = async (req, res) => {
  try {
    const club = await Clubs.findById(req.params.id).lean();
    if (!club) return res.status(404).json({ error: "Club not found" });

    const payload = await buildClubTree(club);
    res.json({ success: "Club tree fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
