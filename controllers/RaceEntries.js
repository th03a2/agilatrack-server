import Affiliations from "../models/Affiliations.js";
import Birds from "../models/Birds.js";
import Lofts from "../models/Lofts.js";
import RaceEntries from "../models/RaceEntries.js";
import Races from "../models/Races.js";
import {
  canAccessTenantClub,
  canManageTenantClub,
  denyTenantAccess,
  getAccessibleClubIds,
  isTenantSuperAdmin,
  normalizeTenantId,
} from "../middleware/tenantIsolation.js";
import { clearCacheByPrefix } from "../utils/cache.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const populateEntry = (query) =>
  query
    .populate({
      path: "race",
      select: "name code raceDate status departure club clubId booking results weather",
      populate: {
        path: "club",
        select: "name code abbr level location",
      },
    })
    .populate({
      path: "affiliation",
      select: "memberCode status membershipType roles racing user club primaryLoft",
      populate: [
        { path: "user", select: "fullName email mobile pid" },
        { path: "club", select: "name code abbr level location" },
      ],
    })
    .populate("loft", "name code coordinates address status")
    .populate("pigeonId", "bandNumber name nfcTagId rfidTagId qrCode status")
    .populate("fancierId", "fullName email mobile pid")
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

const BOOKING_OPEN_STATUSES = new Set(["booking_open", "open"]);
const RELEASE_READY_STATUSES = new Set([
  "basketed",
  "boarded",
  "boarding",
  "check_in",
]);

const normalizeText = (value = "") => String(value || "").trim();
const normalizeUpper = (value = "") => normalizeText(value).toUpperCase();

const getRaceClubId = (race = {}) => normalizeTenantId(race?.clubId || race?.club);

const getUserFullName = (user = {}) =>
  [user?.fullName?.fname, user?.fullName?.mname, user?.fullName?.lname]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const getArrivalSource = (value = "") => {
  const source = normalizeText(value).toLowerCase();

  if (["nfc", "rfid", "qr", "electronic_clock"].includes(source)) {
    return "electronic_clock";
  }

  if (source === "mobile") {
    return "mobile";
  }

  return "manual";
};

const getScanCodeQuery = (scanCode = "") => {
  const normalizedScanCode = normalizeUpper(scanCode);

  if (!normalizedScanCode) {
    return [];
  }

  return [
    { bandNumber: normalizedScanCode },
    { nfcTagId: normalizedScanCode },
    { rfidTagId: normalizedScanCode },
    { qrCode: normalizedScanCode },
  ];
};

const buildBirdSnapshot = (bird = {}) => ({
  bandNumber: normalizeUpper(bird.bandNumber),
  color: bird.color,
  hatchYear: bird.hatchYear,
  name: bird.name,
  sex: bird.sex || "unknown",
  strain: bird.strain || bird.breed,
});

const getBirdScanCode = (bird = {}) =>
  normalizeUpper(bird.nfcTagId || bird.rfidTagId || bird.qrCode || bird.bandNumber);

const ensureRaceBookingOpen = (race) => {
  if (!BOOKING_OPEN_STATUSES.has(race.status)) {
    throw new Error("Race booking is not open for this race.");
  }
};

const ensureRaceNotLocked = (race) => {
  if (race?.results?.lockedAt) {
    throw new Error("Race results are locked and can no longer be edited.");
  }
};

const findApprovedAffiliation = async ({ clubId, fancierId }) => {
  const affiliation = await Affiliations.findOne({
    club: clubId,
    deletedAt: { $exists: false },
    status: "approved",
    user: fancierId,
  });

  if (!affiliation) {
    throw new Error("Approved club membership is required for this race action.");
  }

  return affiliation;
};

const loadRaceForManagedAction = async (req, res, raceId) => {
  const race = await Races.findById(raceId);

  if (!race || race.deletedAt) {
    res.status(404).json({ error: "Race not found." });
    return null;
  }

  const clubId = getRaceClubId(race);

  if (!canManageTenantClub(req.auth, clubId)) {
    await denyTenantAccess(req, res, {
      attemptedClubId: clubId,
      reason: "Race operation attempted outside the authenticated user's managed club.",
    });
    return null;
  }

  return race;
};

const findRaceEntryByScan = async ({
  bandNumber = "",
  clubId = "",
  entryId = "",
  pigeonId = "",
  raceId = "",
  scanCode = "",
} = {}) => {
  if (entryId) {
    return RaceEntries.findOne({
      _id: entryId,
      deletedAt: { $exists: false },
      race: raceId,
    });
  }

  if (pigeonId) {
    const byPigeon = await RaceEntries.findOne({
      deletedAt: { $exists: false },
      pigeonId,
      race: raceId,
    });

    if (byPigeon) {
      return byPigeon;
    }
  }

  const scanQueries = [
    ...(bandNumber ? [{ bandNumber: normalizeUpper(bandNumber) }] : []),
    ...getScanCodeQuery(scanCode),
  ];
  const scannedBird = scanQueries.length
    ? await Birds.findOne({
        club: clubId,
        deletedAt: { $exists: false },
        $or: scanQueries,
      }).lean()
    : null;
  const matchedBandNumber = normalizeUpper(scannedBird?.bandNumber || bandNumber || scanCode);

  if (!matchedBandNumber) {
    return null;
  }

  return RaceEntries.findOne({
    deletedAt: { $exists: false },
    race: raceId,
    "bird.bandNumber": matchedBandNumber,
  });
};

const assertEntryMatchesRace = (entry, race) => {
  if (String(entry.race) !== String(race._id)) {
    throw new Error("Race entry does not belong to the selected race.");
  }
};

const scopeEntryQueryToTenant = async (req, res, dbQuery) => {
  const requestedRaceId = normalizeTenantId(dbQuery.race);

  if (requestedRaceId) {
    const race = await Races.findById(requestedRaceId).select("club").lean();

    if (!race) {
      dbQuery.race = requestedRaceId;
      return true;
    }

    if (!canAccessTenantClub(req.auth, race.club)) {
      await denyTenantAccess(req, res, {
        attemptedClubId: normalizeTenantId(race.club),
        reason: "Race entry list requested a race from another club.",
      });
      return false;
    }

    return true;
  }

  if (isTenantSuperAdmin(req.auth)) {
    return true;
  }

  const accessibleClubIds = getAccessibleClubIds(req.auth);
  const raceIds = accessibleClubIds.length
    ? (await Races.find({
        club: { $in: accessibleClubIds },
        deletedAt: { $exists: false },
      })
        .select("_id")
        .lean()).map((race) => race._id)
    : [];

  dbQuery.race = { $in: raceIds };
  return true;
};

const loadEntryRace = async (entry) => {
  const race = await Races.findById(entry.race);

  if (!race || race.deletedAt) {
    throw new Error("Race not found.");
  }

  return race;
};

const loadEntryAffiliation = async (entry) => {
  const affiliation = await Affiliations.findById(entry.affiliation).select("club user");

  if (!affiliation || affiliation.deletedAt) {
    throw new Error("Affiliation not found.");
  }

  return affiliation;
};

const assertEntryTenantAccess = async (req, res, entry, { manage = false } = {}) => {
  const [race, affiliation] = await Promise.all([
    loadEntryRace(entry),
    loadEntryAffiliation(entry),
  ]);
  const clubId = normalizeTenantId(race.club);
  const isOwnEntry = normalizeTenantId(affiliation.user) === normalizeTenantId(req.auth?.userId);
  const allowed = manage
    ? canManageTenantClub(req.auth, clubId)
    : isOwnEntry || canAccessTenantClub(req.auth, clubId);

  if (!allowed) {
    await denyTenantAccess(req, res, {
      attemptedClubId: clubId,
      reason: manage
        ? "Race entry action attempted outside the authenticated user's managed club."
        : "Race entry request targeted another club.",
    });
    return null;
  }

  return { affiliation, race };
};

export const findAll = async (req, res) => {
  try {
    const dbQuery = buildEntryQuery(req.query);
    const allowed = await scopeEntryQueryToTenant(req, res, dbQuery);

    if (!allowed) {
      return null;
    }

    const payload = await populateEntry(
      RaceEntries.find(dbQuery),
    )
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Race entries fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const entry = await RaceEntries.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({ error: "Race entry not found" });
    }

    const access = await assertEntryTenantAccess(req, res, entry);

    if (!access) {
      return null;
    }

    const payload = await populateEntry(
      RaceEntries.findById(req.params.id),
    ).lean({ virtuals: true });

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
    if (!canAccessTenantClub(req.auth, String(race.club || ""))) {
      return denyTenantAccess(req, res, {
        attemptedClubId: String(race.club || ""),
        reason: "Race entry booking targeted another club.",
      });
    }
    if (
      String(affiliation.user || "") !== String(req.auth?.userId || "") &&
      !canManageTenantClub(req.auth, String(race.club || ""))
    ) {
      return res.status(403).json({
        error: "You can only book race entries for your own affiliation.",
      });
    }
    if (String(loft.club) !== String(race.club)) {
      throw new Error("Loft club must match the race club.");
    }

    const created = await RaceEntries.create({
      ...req.body,
      clubId: race.club,
      createdBy: req.auth?.userId,
      fancierId: affiliation.user,
      loftSnapshot: req.body.loftSnapshot || buildLoftSnapshot(loft),
      raceId: race._id,
      departure: {
        ...req.body.departure,
        siteName: req.body.departure?.siteName || race.departure.siteName,
        coordinates: req.body.departure?.coordinates || race.departure.coordinates,
      },
      updatedBy: req.auth?.userId,
      status: "booked",
    });

    const payload = await populateEntry(RaceEntries.findById(created._id)).lean({
      virtuals: true,
    });

    res.status(201).json({ success: "Race entry booked successfully", payload });
    clearCacheByPrefix("dashboard:stats");
  } catch (error) {
    sendError(res, error);
  }
};

export const bookRacePigeons = async (req, res) => {
  try {
    const race = await ensureActiveRace(req.params.raceId);
    ensureRaceBookingOpen(race);

    const clubId = getRaceClubId(race);

    if (!canAccessTenantClub(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Race booking targeted another club.",
      });
    }

    const requestedFancierId = normalizeText(req.body?.fancierId || req.body?.ownerId);
    const fancierId =
      requestedFancierId && canManageTenantClub(req.auth, clubId)
        ? requestedFancierId
        : normalizeText(req.auth?.userId);
    const affiliation = req.body?.affiliation || req.body?.affiliationId
      ? await Affiliations.findById(req.body.affiliation || req.body.affiliationId)
      : await findApprovedAffiliation({ clubId, fancierId });

    if (!affiliation || affiliation.deletedAt || affiliation.status !== "approved") {
      return res.status(400).json({
        error: "Approved club membership is required before booking pigeons.",
      });
    }

    if (String(affiliation.club || "") !== clubId) {
      return res.status(400).json({ error: "Affiliation club must match the race club." });
    }

    if (
      String(affiliation.user || "") !== normalizeText(req.auth?.userId) &&
      !canManageTenantClub(req.auth, clubId)
    ) {
      return res.status(403).json({
        error: "You can only book race entries for your own membership.",
      });
    }

    const requestedPigeonIds = [
      ...(Array.isArray(req.body?.pigeonIds) ? req.body.pigeonIds : []),
      req.body?.pigeonId,
    ]
      .map(normalizeText)
      .filter(Boolean);
    const requestedBandNumbers = [
      ...(Array.isArray(req.body?.bandNumbers) ? req.body.bandNumbers : []),
      req.body?.bandNumber,
      req.body?.scanCode,
    ]
      .map(normalizeUpper)
      .filter(Boolean);

    if (!requestedPigeonIds.length && !requestedBandNumbers.length) {
      return res.status(400).json({
        error: "Select at least one pigeon or band number to book.",
      });
    }

    const pigeonQuery = {
      club: clubId,
      deletedAt: { $exists: false },
      status: { $in: ["active", "training"] },
      ...(requestedPigeonIds.length || requestedBandNumbers.length
        ? {
            $or: [
              ...(requestedPigeonIds.length ? [{ _id: { $in: requestedPigeonIds } }] : []),
              ...(requestedBandNumbers.length ? [{ bandNumber: { $in: requestedBandNumbers } }] : []),
            ],
          }
        : {}),
    };

    if (!canManageTenantClub(req.auth, clubId)) {
      pigeonQuery.ownerId = req.auth.userId;
    } else if (normalizeText(req.body?.ownerId || req.body?.fancierId)) {
      pigeonQuery.ownerId = fancierId;
    }

    const birds = await Birds.find(pigeonQuery).lean();

    if (!birds.length) {
      return res.status(404).json({
        error: "No eligible pigeons were found for this race booking.",
      });
    }

    const createdEntries = [];

    for (const bird of birds) {
      const duplicate = await RaceEntries.findOne({
        deletedAt: { $exists: false },
        race: race._id,
        "bird.bandNumber": normalizeUpper(bird.bandNumber),
      })
        .select("_id")
        .lean();

      if (duplicate?._id) {
        continue;
      }

      const loftId = normalizeText(req.body?.loft || req.body?.loftId || bird.loft || affiliation.primaryLoft);
      const loft = loftId ? await Lofts.findById(loftId) : null;

      if (!loft || loft.deletedAt) {
        return res.status(400).json({
          error: `A valid loft is required before booking ${bird.bandNumber}.`,
        });
      }

      if (String(loft.club || "") !== clubId) {
        return res.status(400).json({
          error: `Loft for ${bird.bandNumber} must belong to the race club.`,
        });
      }

      const entry = await RaceEntries.create({
        affiliation: affiliation._id,
        bird: buildBirdSnapshot(bird),
        booking: {
          bookedAt: new Date(),
          bookingCode: getBirdScanCode(bird),
          channel: "online",
          remarks: normalizeText(req.body?.remarks),
        },
        clubId,
        createdBy: req.auth?.userId,
        departure: {
          coordinates: race.departure?.coordinates,
          siteName: race.departure?.siteName,
        },
        fancierId: affiliation.user,
        loft: loft._id,
        loftSnapshot: buildLoftSnapshot(loft),
        pigeonId: bird._id,
        race: race._id,
        raceId: race._id,
        status: "booked",
        updatedBy: req.auth?.userId,
      });

      createdEntries.push(entry);
    }

    if (!createdEntries.length) {
      return res.status(409).json({
        error: "The selected pigeons are already booked for this race.",
      });
    }

    const payload = await populateEntry(
      RaceEntries.find({ _id: { $in: createdEntries.map((entry) => entry._id) } }),
    ).lean({ virtuals: true });

    clearCacheByPrefix("dashboard:stats");

    return res.status(201).json({
      success: "Race booking completed successfully",
      message: "Race booking completed successfully",
      payload,
    });
  } catch (error) {
    return sendError(res, error, error?.status || 400);
  }
};

export const scanBasketing = async (req, res) => {
  try {
    const race = await loadRaceForManagedAction(req, res, req.params.raceId);
    if (!race) return null;

    ensureRaceNotLocked(race);

    const clubId = getRaceClubId(race);
    const entry = await findRaceEntryByScan({
      bandNumber: req.body?.bandNumber,
      clubId,
      entryId: req.body?.entryId,
      pigeonId: req.body?.pigeonId,
      raceId: race._id,
      scanCode: req.body?.scanCode || req.body?.nfcTagId || req.body?.rfidTagId || req.body?.qrCode,
    });

    if (!entry) {
      return res.status(404).json({
        error: "No booked race entry matched the scanned pigeon.",
      });
    }

    if (["boarded", "basketed", "departed", "arrived"].includes(entry.status)) {
      return res.status(409).json({
        error: "This pigeon has already been basketed or processed for this race.",
        payload: await populateEntry(RaceEntries.findById(entry._id)).lean({ virtuals: true }),
      });
    }

    const basketedAt = req.body?.basketedAt ? new Date(req.body.basketedAt) : new Date();

    entry.checkIn = {
      ...(entry.checkIn?.toObject?.() || entry.checkIn || {}),
      checkedInAt: entry.checkIn?.checkedInAt || basketedAt,
      checkedInBy: req.auth?.userId,
      status: "checked_in",
    };
    entry.boarding = {
      ...(entry.boarding?.toObject?.() || entry.boarding || {}),
      basketedAt,
      basketedBy: req.auth?.userId,
      boardingPassNumber:
        normalizeUpper(req.body?.boardingPassNumber) ||
        entry.boarding?.boardingPassNumber ||
        `BP-${String(Date.now()).slice(-6)}`,
      compartmentNumber: normalizeUpper(req.body?.compartmentNumber || entry.boarding?.compartmentNumber || "A1"),
      crateNumber:
        normalizeUpper(req.body?.basketNumber || req.body?.crateNumber || entry.boarding?.crateNumber) ||
        `BASKET-${String(Date.now()).slice(-4)}`,
      scanCode: normalizeUpper(
        req.body?.scanCode || req.body?.nfcTagId || req.body?.rfidTagId || req.body?.qrCode || entry.booking?.bookingCode,
      ),
      sequenceNumber: Number(req.body?.sequenceNumber || entry.boarding?.sequenceNumber || 1),
      sealNumber: normalizeUpper(req.body?.sealNumber || entry.boarding?.sealNumber),
    };
    entry.status = "boarded";
    entry.updatedBy = req.auth?.userId;
    await entry.save();

    race.status = "boarding";
    race.updatedBy = req.auth?.userId;
    await race.save();

    const payload = await populateEntry(RaceEntries.findById(entry._id)).lean({
      virtuals: true,
    });

    clearCacheByPrefix("dashboard:stats");

    return res.json({
      success: "Basketing scan recorded successfully",
      message: "Basketing scan recorded successfully",
      payload,
    });
  } catch (error) {
    return sendError(res, error, error?.status || 400);
  }
};

export const liberateRace = async (req, res) => {
  try {
    const race = await loadRaceForManagedAction(req, res, req.params.raceId);
    if (!race) return null;

    ensureRaceNotLocked(race);

    const clubId = getRaceClubId(race);
    const liberatedAt = req.body?.liberationDateTime
      ? new Date(req.body.liberationDateTime)
      : new Date();

    race.departure = {
      ...(race.departure?.toObject?.() || race.departure || {}),
      departedAt: liberatedAt,
      siteName: req.body?.liberationPoint || race.departure?.siteName,
    };
    race.weather = {
      ...(race.weather?.toObject?.() || race.weather || {}),
      notes: normalizeText(req.body?.weatherNote || req.body?.delayReason || race.weather?.notes),
    };
    race.status = "departed";
    race.updatedBy = req.auth?.userId;
    await race.save();

    await RaceEntries.updateMany(
      {
        deletedAt: { $exists: false },
        race: race._id,
        status: { $in: ["basketed", "boarded"] },
      },
      {
        $set: {
          "departure.coordinates": race.departure.coordinates,
          "departure.departedAt": liberatedAt,
          "departure.siteName": race.departure.siteName,
          "liberation.liberator": req.auth?.userId,
          "liberation.releasedByName": getUserFullName(req.auth?.user),
          "liberation.remarks": normalizeText(req.body?.weatherNote || req.body?.remarks),
          "liberation.verifiedAt": liberatedAt,
          clubId,
          status: "departed",
          updatedBy: req.auth?.userId,
        },
      },
    );

    const payload = await populateEntry(
      RaceEntries.find({
        deletedAt: { $exists: false },
        race: race._id,
      }),
    )
      .sort({ "bird.bandNumber": 1 })
      .lean({ virtuals: true });

    clearCacheByPrefix("dashboard:stats");
    clearCacheByPrefix("races:list");

    return res.json({
      success: "Race liberation recorded successfully",
      message: "Race liberation recorded successfully",
      payload: {
        entries: payload,
        liberation: {
          liberationDateTime: liberatedAt,
          liberationPoint: race.departure?.siteName,
          releasedBy: req.auth?.userId,
          status: "Liberated",
          weatherNote: race.weather?.notes || "",
        },
        race,
      },
    });
  } catch (error) {
    return sendError(res, error, error?.status || 400);
  }
};

export const recordRaceArrivalByRace = async (req, res) => {
  try {
    const race = await loadRaceForManagedAction(req, res, req.params.raceId);
    if (!race) return null;

    ensureRaceNotLocked(race);

    if (!race.departure?.departedAt) {
      return res.status(400).json({
        error: "Arrival encoding is blocked until the race is liberated.",
      });
    }

    const clubId = getRaceClubId(race);
    const entry = await findRaceEntryByScan({
      bandNumber: req.body?.bandNumber,
      clubId,
      entryId: req.body?.entryId,
      pigeonId: req.body?.pigeonId,
      raceId: race._id,
      scanCode: req.body?.scanCode || req.body?.nfcTagId || req.body?.rfidTagId || req.body?.qrCode,
    });

    if (!entry) {
      return res.status(404).json({ error: "No liberated race entry matched this arrival." });
    }

    if (entry.arrival?.arrivedAt) {
      return res.status(409).json({
        error: "Duplicate arrival detected for this race entry.",
        payload: await populateEntry(RaceEntries.findById(entry._id)).lean({ virtuals: true }),
      });
    }

    entry.departure = {
      ...(entry.departure?.toObject?.() || entry.departure || {}),
      coordinates: entry.departure?.coordinates || race.departure.coordinates,
      departedAt: entry.departure?.departedAt || race.departure.departedAt,
      siteName: entry.departure?.siteName || race.departure.siteName,
    };
    entry.arrival = {
      ...(entry.arrival?.toObject?.() || entry.arrival || {}),
      arrivedAt: req.body?.arrivalTime ? new Date(req.body.arrivalTime) : new Date(),
      clockedBy: req.auth?.userId,
      remarks: normalizeText(req.body?.remarks),
      source: getArrivalSource(req.body?.source),
    };
    entry.status = "arrived";
    entry.updatedBy = req.auth?.userId;
    await entry.save();
    await RaceEntries.recalculateRanks(entry.race);

    const payload = await populateEntry(RaceEntries.findById(entry._id)).lean({
      virtuals: true,
    });

    clearCacheByPrefix("dashboard:stats");

    return res.json({
      success: "Race arrival recorded successfully",
      message: "Race arrival recorded successfully",
      payload,
    });
  } catch (error) {
    return sendError(res, error, error?.status || 400);
  }
};

export const getRaceResults = async (req, res) => {
  try {
    const race = await Races.findById(req.params.raceId).select("club clubId results").lean();

    if (!race) {
      return res.status(404).json({ error: "Race not found." });
    }

    const clubId = getRaceClubId(race);

    if (!canAccessTenantClub(req.auth, clubId)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Race results request targeted another club.",
      });
    }

    const payload = await populateEntry(
      RaceEntries.find({
        deletedAt: { $exists: false },
        race: req.params.raceId,
      }),
    ).lean({ virtuals: true });
    const rankedPayload = payload.sort((left, right) => {
      const leftRank = left.result?.rank || Number.MAX_SAFE_INTEGER;
      const rightRank = right.result?.rank || Number.MAX_SAFE_INTEGER;

      if (leftRank !== rightRank) return leftRank - rightRank;

      return new Date(left.arrival?.arrivedAt || 0).getTime() -
        new Date(right.arrival?.arrivedAt || 0).getTime();
    });

    return res.json({
      success: "Race results fetched successfully",
      message: "Race results fetched successfully",
      payload: {
        entries: rankedPayload,
        speedUnit: race.results?.speedUnit || "meters_per_minute",
      },
    });
  } catch (error) {
    return sendError(res, error, error?.status || 400);
  }
};

export const publishRaceResults = async (req, res) => {
  try {
    const race = await loadRaceForManagedAction(req, res, req.params.raceId);
    if (!race) return null;

    await RaceEntries.recalculateRanks(race._id);

    race.results = {
      ...(race.results?.toObject?.() || race.results || {}),
      publishedAt: new Date(),
      publishedBy: req.auth?.userId,
      speedUnit: "meters_per_minute",
    };
    race.status = "completed";
    race.updatedBy = req.auth?.userId;
    await race.save();

    clearCacheByPrefix("races:list");
    clearCacheByPrefix("dashboard:stats");

    return getRaceResults(req, res);
  } catch (error) {
    return sendError(res, error, error?.status || 400);
  }
};

export const lockRaceResults = async (req, res) => {
  try {
    const race = await loadRaceForManagedAction(req, res, req.params.raceId);
    if (!race) return null;

    race.results = {
      ...(race.results?.toObject?.() || race.results || {}),
      lockedAt: new Date(),
      lockedBy: req.auth?.userId,
      publishedAt: race.results?.publishedAt || new Date(),
      publishedBy: race.results?.publishedBy || req.auth?.userId,
      speedUnit: "meters_per_minute",
    };
    race.status = "completed";
    race.updatedBy = req.auth?.userId;
    await race.save();

    clearCacheByPrefix("races:list");
    clearCacheByPrefix("dashboard:stats");

    return getRaceResults(req, res);
  } catch (error) {
    return sendError(res, error, error?.status || 400);
  }
};

export const checkInEntry = async (req, res) => {
  try {
    const entry = await RaceEntries.findById(req.params.id);
    if (!entry) return res.status(404).json({ error: "Race entry not found" });

    const race = await ensureActiveRace(entry.race);
    assertEntryMatchesRace(entry, race);
    if (!canManageTenantClub(req.auth, String(race.club || ""))) {
      return denyTenantAccess(req, res, {
        attemptedClubId: String(race.club || ""),
        reason: "Race entry check-in attempted outside the authenticated user's tenant.",
      });
    }

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

    const race = await ensureActiveRace(entry.race);
    if (!canManageTenantClub(req.auth, String(race.club || ""))) {
      return denyTenantAccess(req, res, {
        attemptedClubId: String(race.club || ""),
        reason: "Race entry boarding attempted outside the authenticated user's tenant.",
      });
    }

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
    if (!canManageTenantClub(req.auth, String(race.club || ""))) {
      return denyTenantAccess(req, res, {
        attemptedClubId: String(race.club || ""),
        reason: "Race entry departure attempted outside the authenticated user's tenant.",
      });
    }

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

    const race = await ensureActiveRace(entry.race);
    if (!canManageTenantClub(req.auth, String(race.club || ""))) {
      return denyTenantAccess(req, res, {
        attemptedClubId: String(race.club || ""),
        reason: "Race entry arrival attempted outside the authenticated user's tenant.",
      });
    }

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

    const access = await assertEntryTenantAccess(req, res, entry);

    if (!access) {
      return null;
    }

    const nextBody = { ...req.body };

    if (!canManageTenantClub(req.auth, String(access.race.club || ""))) {
      delete nextBody.affiliation;
      delete nextBody.loft;
      delete nextBody.race;
    }

    entry.set(nextBody);
    await entry.save();

    const payload = await populateEntry(RaceEntries.findById(entry._id)).lean({
      virtuals: true,
    });

    res.json({ success: "Race entry updated successfully", payload });
    clearCacheByPrefix("dashboard:stats");
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteEntry = async (req, res) => {
  try {
    const entry = await RaceEntries.findById(req.params.id);

    if (!entry) {
      return res.status(404).json({ error: "Race entry not found" });
    }

    const access = await assertEntryTenantAccess(req, res, entry, { manage: true });

    if (!access) {
      return null;
    }

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

    if (!payload) {
      return res.status(404).json({ error: "Race entry not found" });
    }

    res.json({ success: "Race entry archived successfully", payload });
    clearCacheByPrefix("dashboard:stats");
  } catch (error) {
    sendError(res, error);
  }
};
