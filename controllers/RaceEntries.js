import {
  ensureOwnerOrClubManager,
  hasOperationalAccess,
} from "../middleware/auth.js";
import Affiliations from "../models/Affiliations.js";
import Lofts from "../models/Lofts.js";
import RaceEntries from "../models/RaceEntries.js";
import Races from "../models/Races.js";
import { AppError } from "../utils/appError.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });
const SELF_ENTRY_FIELDS = ["bird", "booking", "loft", "loftSnapshot"];

const populateEntry = (query) =>
  query
    .populate("race", "name code raceDate status departure club")
    .populate({
      path: "affiliation",
      select: "memberCode status membershipType roles racing user club primaryLoft",
      populate: [
        { path: "user", select: "fullName email mobile pid" },
        { path: "club", select: "name code abbr level location" },
      ],
    })
    .populate("loft", "name code coordinates address status")
    .populate("transport.handler", "fullName email mobile pid")
    .populate("transport.transporter", "fullName email mobile pid")
    .populate("transport.releaseSiteArrival.receivedBy", "fullName email mobile pid")
    .populate("liberation.liberator", "fullName email mobile pid")
    .populate("liberation.witnesses.user", "fullName email mobile pid");

const buildEntryQuery = (query = {}) => {
  const { race, affiliation, loft, status, bandNumber, bookingCode } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (race) dbQuery.race = race;
  if (affiliation) dbQuery.affiliation = affiliation;
  if (loft) dbQuery.loft = loft;
  if (status) dbQuery.status = status;
  if (bandNumber) dbQuery["bird.bandNumber"] = { $regex: bandNumber, $options: "i" };
  if (bookingCode) dbQuery["booking.bookingCode"] = { $regex: bookingCode, $options: "i" };

  return dbQuery;
};

const ensureApprovedAffiliation = async (affiliationId) => {
  const affiliation = await Affiliations.findById(affiliationId);

  if (!affiliation || affiliation.deletedAt) {
    throw new Error("Affiliation not found.");
  }

  if (affiliation.status !== "approved") {
    throw new Error("Only approved affiliations can book race entries.");
  }

  return affiliation;
};

const ensureActiveRace = async (raceId) => {
  const race = await Races.findById(raceId);

  if (!race || race.deletedAt) {
    throw new Error("Race not found.");
  }

  if (["completed", "cancelled"].includes(race.status)) {
    throw new Error("Race is no longer accepting entry updates.");
  }

  return race;
};

const buildLoftSnapshot = (loft) => ({
  code: loft.code,
  name: loft.name,
  coordinates: loft.coordinates,
});

const assertEntryMatchesRace = (entry, race) => {
  if (String(entry.race) !== String(race._id)) {
    throw new Error("Race entry does not belong to the selected race.");
  }
};

const getAllowedAffiliationIds = (auth) =>
  new Set((auth?.affiliations || []).map((affiliation) => String(affiliation._id)));

const ensureRaceEntryAccess = (
  affiliationId,
  auth,
  message = "You do not have permission to access this race entry.",
) => {
  if (hasOperationalAccess(auth)) {
    return;
  }

  if (getAllowedAffiliationIds(auth).has(String(affiliationId || ""))) {
    return;
  }

  throw new AppError(403, message);
};

const pickAllowedSelfEntryUpdates = (payload = {}) =>
  SELF_ENTRY_FIELDS.reduce((accumulator, field) => {
    if (payload[field] !== undefined) {
      accumulator[field] = payload[field];
    }

    return accumulator;
  }, {});

export const findAll = async (req, res) => {
  try {
    const query = buildEntryQuery(req.query);

    if (!hasOperationalAccess(req.auth)) {
      query.affiliation = { $in: [...getAllowedAffiliationIds(req.auth)] };
    }

    const payload = await populateEntry(RaceEntries.find(query))
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Race entries fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateEntry(
      RaceEntries.findById(req.params.id),
    ).lean({ virtuals: true });

    if (!payload) {
      return res.status(404).json({ error: "Race entry not found" });
    }

    ensureRaceEntryAccess(payload.affiliation?._id, req.auth);

    res.json({ success: "Race entry fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const bookEntry = async (req, res) => {
  try {
    const { race: raceId, affiliation: affiliationId, loft: loftId } = req.body;
    const [race, affiliation, loft] = await Promise.all([
      ensureActiveRace(raceId),
      ensureApprovedAffiliation(affiliationId),
      Lofts.findById(loftId),
    ]);

    if (!loft || loft.deletedAt) throw new Error("Loft not found.");
    if (String(affiliation.club) !== String(race.club)) {
      throw new Error("Affiliation club must match the race club.");
    }
    if (String(loft.club) !== String(race.club)) {
      throw new Error("Loft club must match the race club.");
    }

    ensureOwnerOrClubManager(
      affiliation.user,
      req.auth,
      "You do not have permission to book entries for this affiliation.",
    );

    const created = await RaceEntries.create({
      ...req.body,
      loftSnapshot: req.body.loftSnapshot || buildLoftSnapshot(loft),
      departure: {
        ...req.body.departure,
        siteName: req.body.departure?.siteName || race.departure.siteName,
        coordinates: req.body.departure?.coordinates || race.departure.coordinates,
      },
      status: "booked",
    });

    const payload = await populateEntry(RaceEntries.findById(created._id)).lean({
      virtuals: true,
    });

    res.status(201).json({ success: "Race entry booked successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const checkInEntry = async (req, res) => {
  try {
    const entry = await RaceEntries.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Race entry not found" });

    const race = await ensureActiveRace(entry.race);
    assertEntryMatchesRace(entry, race);

    entry.checkIn = {
      ...(entry.checkIn || {}),
      ...req.body,
      status: req.body.status || "checked_in",
      checkedInAt: req.body.checkedInAt || new Date(),
    };
    entry.status = "checked_in";
    await entry.save();

    const payload = await populateEntry(RaceEntries.findById(entry._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Race entry checked in successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const boardEntry = async (req, res) => {
  try {
    const entry = await RaceEntries.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Race entry not found" });

    await ensureActiveRace(entry.race);

    if (entry.checkIn?.status !== "checked_in") {
      throw new Error("Race entry must be checked in before boarding.");
    }

    entry.boarding = {
      ...(entry.boarding || {}),
      ...req.body,
    };
    entry.status = "boarded";
    await entry.save();

    const payload = await populateEntry(RaceEntries.findById(entry._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Race entry boarded successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const departEntry = async (req, res) => {
  try {
    const entry = await RaceEntries.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Race entry not found" });

    const race = await ensureActiveRace(entry.race);
    const { transport, liberation, ...departureBody } = req.body;

    if (entry.status !== "boarded") {
      throw new Error("Race entry must be boarded before departure.");
    }

    entry.departure = {
      ...(entry.departure || {}),
      ...departureBody,
      siteName: departureBody.siteName || race.departure.siteName,
      departedAt: departureBody.departedAt || race.departure.departedAt || new Date(),
      coordinates: departureBody.coordinates || race.departure.coordinates,
    };
    if (transport) entry.transport = { ...(entry.transport || {}), ...transport };
    if (liberation) {
      entry.liberation = { ...(entry.liberation || {}), ...liberation };
    }
    entry.status = "departed";
    await entry.save();

    const payload = await populateEntry(RaceEntries.findById(entry._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Race entry departed successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const recordArrival = async (req, res) => {
  try {
    const entry = await RaceEntries.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Race entry not found" });

    await ensureActiveRace(entry.race);

    entry.arrival = {
      ...(entry.arrival || {}),
      ...req.body,
      arrivedAt: req.body.arrivedAt || new Date(),
    };
    entry.status = "arrived";
    await entry.save();
    await RaceEntries.recalculateRanks(entry.race);

    const payload = await populateEntry(RaceEntries.findById(entry._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Race entry arrival recorded successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateEntry = async (req, res) => {
  try {
    const entry = await RaceEntries.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Race entry not found" });

    ensureRaceEntryAccess(entry.affiliation, req.auth);

    const nextPayload = hasOperationalAccess(req.auth)
      ? req.body
      : pickAllowedSelfEntryUpdates(req.body);

    if (!Object.keys(nextPayload || {}).length) {
      return res.status(400).json({ error: "No allowed race entry fields were provided." });
    }

    entry.set(nextPayload);
    await entry.save();

    const payload = await populateEntry(RaceEntries.findById(entry._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Race entry updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteEntry = async (req, res) => {
  try {
    const entry = await RaceEntries.findById(req.params.id).select("affiliation");

    if (!entry) {
      return res.status(404).json({ error: "Race entry not found" });
    }

    ensureRaceEntryAccess(entry.affiliation, req.auth);

    const payload = await populateEntry(
      RaceEntries.findByIdAndUpdate(
        req.params.id,
        {
          deletedAt: new Date().toISOString(),
          status: "scratched",
        },
        { new: true },
      ),
    ).lean({ virtuals: true });

    res.json({ success: "Race entry archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
