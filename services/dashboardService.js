import Affiliations from "../models/Affiliations.js";
import Birds from "../models/Birds.js";
import RaceEntries from "../models/RaceEntries.js";
import Races from "../models/Races.js";
import { makeCacheKey, remember } from "../utils/cache.js";

const UPCOMING_STATUSES = ["draft", "booking_open", "booking_closed", "check_in", "boarding"];

const getStartOfMonth = () => {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  return startOfMonth;
};

const buildScopeFilter = (clubId = "") =>
  clubId
    ? {
        club: clubId,
      }
    : {};

export const getDashboardStats = async ({ clubId = "" } = {}) => {
  const normalizedClubId = String(clubId || "").trim();
  const cacheKey = makeCacheKey("dashboard:stats", { clubId: normalizedClubId });

  return remember(cacheKey, async () => {
    const now = new Date();
    const startOfMonth = getStartOfMonth();
    const scopedClubFilter = buildScopeFilter(normalizedClubId);
    const raceScope = {
      ...scopedClubFilter,
      deletedAt: { $exists: false },
    };
    const upcomingRaceFilter = {
      ...raceScope,
      raceDate: { $gte: now },
      status: { $in: UPCOMING_STATUSES },
    };

    const [
      totalMembers,
      newMembersThisMonth,
      activeBirds,
      birdsRegisteredThisMonth,
      upcomingRaces,
      upcomingTrainings,
      pendingClubApplications,
      totalBirds,
      upcomingRaceRows,
    ] = await Promise.all([
      Affiliations.countDocuments({
        ...scopedClubFilter,
        deletedAt: { $exists: false },
        status: "approved",
      }),
      Affiliations.countDocuments({
        ...scopedClubFilter,
        deletedAt: { $exists: false },
        status: "approved",
        createdAt: { $gte: startOfMonth },
      }),
      Birds.countDocuments({
        ...scopedClubFilter,
        deletedAt: { $exists: false },
        status: { $in: ["active", "training", "breeding"] },
      }),
      Birds.countDocuments({
        ...scopedClubFilter,
        createdAt: { $gte: startOfMonth },
        deletedAt: { $exists: false },
      }),
      Races.countDocuments({
        ...upcomingRaceFilter,
        category: { $ne: "training" },
      }),
      Races.countDocuments({
        ...upcomingRaceFilter,
        category: "training",
      }),
      Affiliations.countDocuments({
        ...scopedClubFilter,
        deletedAt: { $exists: false },
        status: "pending",
      }),
      Birds.countDocuments({
        ...scopedClubFilter,
        deletedAt: { $exists: false },
      }),
      Races.find(upcomingRaceFilter).select("_id name code raceDate category status").lean(),
    ]);

    const upcomingRaceIds = upcomingRaceRows.map((race) => race._id);
    const scopedRaceIds = normalizedClubId
      ? (await Races.find(raceScope).select("_id").lean()).map((race) => race._id)
      : [];
    const [bookingRows, bookingsCount] = await Promise.all([
      upcomingRaceIds.length
        ? RaceEntries.aggregate([
          {
            $match: {
              deletedAt: { $exists: false },
              race: { $in: upcomingRaceIds },
            },
          },
          {
            $group: {
              _id: "$race",
              bookingsCount: { $sum: 1 },
              participants: { $addToSet: "$affiliation" },
            },
          },
        ])
        : [],
      RaceEntries.countDocuments({
        deletedAt: { $exists: false },
        ...(normalizedClubId ? { race: { $in: scopedRaceIds } } : {}),
      }),
    ]);
    const bookingMap = new Map(
      bookingRows.map((row) => [
        String(row._id),
        {
          bookingsCount: row.bookingsCount || 0,
          participantCount: Array.isArray(row.participants) ? row.participants.length : 0,
        },
      ]),
    );
    const bookedParticipantsByUpcomingRace = upcomingRaceRows.map((race) => {
      const counts = bookingMap.get(String(race._id)) || {
        bookingsCount: 0,
        participantCount: 0,
      };

      return {
        _id: String(race._id),
        bookingsCount: counts.bookingsCount,
        category: race.category,
        code: race.code,
        name: race.name,
        participantCount: counts.participantCount,
        raceDate: race.raceDate,
        status: race.status,
      };
    });

    return {
      activeBirds,
      birdsRegisteredThisMonth,
      bookedParticipantsByUpcomingRace,
      bookingsCount,
      newMembersThisMonth,
      pendingClubApplications,
      totalBirds,
      totalMembers,
      upcomingRaces,
      upcomingTrainings,
    };
  });
};

export default {
  getDashboardStats,
};
