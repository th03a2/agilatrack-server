import Crates from "../models/Crates.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populateCrate = (query) =>
  query
    .populate("club", "name code abbr level location")
    .populate("loft", "name code coordinates address status")
    .populate("handler", "fullName email mobile pid")
    .populate("conditionChecks.checkedBy", "fullName email mobile pid");

const buildCrateQuery = (query = {}) => {
  const { club, code, handler, loft, nfcTag, sealNumber, status, type } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (club) dbQuery.club = club;
  if (code) dbQuery.code = { $regex: code, $options: "i" };
  if (handler) dbQuery.handler = handler;
  if (loft) dbQuery.loft = loft;
  if (nfcTag) dbQuery.nfcTag = { $regex: nfcTag, $options: "i" };
  if (sealNumber) dbQuery.sealNumber = { $regex: sealNumber, $options: "i" };
  if (status) dbQuery.status = status;
  if (type) dbQuery.type = type;

  return dbQuery;
};

export const findAll = async (req, res) => {
  try {
    const payload = await populateCrate(Crates.find(buildCrateQuery(req.query)))
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Crates fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateCrate(Crates.findById(req.params.id)).lean({
      virtuals: true,
    });

    if (!payload) return res.status(404).json({ error: "Crate not found" });

    res.json({ success: "Crate fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createCrate = async (req, res) => {
  try {
    const created = await Crates.create(req.body);
    const payload = await populateCrate(Crates.findById(created._id)).lean({
      virtuals: true,
    });

    res.status(201).json({ success: "Crate created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateCrate = async (req, res) => {
  try {
    const crate = await Crates.findById(req.params.id);
    if (!crate) return res.status(404).json({ error: "Crate not found" });

    crate.set(req.body);
    await crate.save();

    const payload = await populateCrate(Crates.findById(crate._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Crate updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteCrate = async (req, res) => {
  try {
    const payload = await populateCrate(
      Crates.findByIdAndUpdate(
        req.params.id,
        { deletedAt: new Date().toISOString(), status: "archived" },
        { new: true },
      ),
    ).lean({ virtuals: true });

    if (!payload) return res.status(404).json({ error: "Crate not found" });

    res.json({ success: "Crate archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
