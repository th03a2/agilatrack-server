import Affiliations from "../models/Affiliations.js";
import Clubs from "../models/Clubs.js";
import Crates from "../models/Crates.js";
import Pigeons from "../models/Pigeons.js";
import RaceEntries from "../models/RaceEntries.js";
import Races from "../models/Races.js";
import Users from "../models/Users.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : "";

const formatDateTime = (value) =>
  value
    ? new Date(value).toISOString()
    : null;

const buildFullName = (fullName = {}, fallback = "Unknown user") => {
  const value = [
    fullName.title,
    fullName.fname,
    fullName.mname,
    fullName.lname,
    fullName.suffix,
    fullName.postnominal,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return value || fallback;
};

const buildClubName = (club = {}, fallback = "No club linked") =>
  club?.name || club?.abbr || club?.code || fallback;

const buildClubLocation = (location = {}) =>
  [
    location?.municipality,
    location?.province,
    location?.region,
  ]
    .filter(Boolean)
    .join(", ");

const formatStatus = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, " ");

const createReference = (prefix, value) =>
  `${prefix}-${String(value || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8)
    .toUpperCase() || "00000000"}`;

const estimatedPrizeByRank = {
  1: 5000,
  2: 3000,
  3: 2000,
};

export const findPayments = async (req, res) => {
  try {
    const [pendingProfiles, pendingAffiliations] = await Promise.all([
      Users.find({
        isActive: true,
        $or: [
          { "profile.status": "pending" },
          { "profile.status": "denied" },
          { "profile.status": { $exists: false } },
        ],
      })
        .select("fullName email mobile profile validIdImage createdAt isEmailVerified")
        .sort({ createdAt: -1 })
        .lean({ virtuals: true }),
      Affiliations.find({
        deletedAt: { $exists: false },
        status: "pending",
      })
        .populate("user", "fullName email mobile validIdImage profile")
        .populate("club", "name code abbr level location")
        .sort({ createdAt: -1 })
        .lean({ virtuals: true }),
    ]);

    const profileRows = pendingProfiles.map((user) => ({
      _id: `profile-${user._id}`,
      amount: 0,
      club: null,
      notes: user.validIdImage
        ? "Valid ID uploaded. Waiting for profile review."
        : "Valid ID not uploaded yet.",
      owner: {
        email: user.email || "",
        mobile: user.mobile || "",
        name: buildFullName(user.fullName, user.email || "Unknown user"),
      },
      reference: createReference("PROFILE", user._id),
      source: "profile_verification",
      status: formatStatus(user.profile?.status || "pending"),
      submittedAt: formatDateTime(user.createdAt),
      submittedLabel: formatDate(user.createdAt),
      verification: user.isEmailVerified ? "email_verified" : "email_pending",
    }));

    const affiliationRows = pendingAffiliations.map((affiliation) => ({
      _id: `affiliation-${affiliation._id}`,
      amount: 0,
      club: {
        _id: affiliation.club?._id || "",
        level: affiliation.club?.level || "",
        location: buildClubLocation(affiliation.club?.location),
        name: buildClubName(affiliation.club),
      },
      notes:
        affiliation.application?.reasonForJoining ||
        "Pending membership and payment-verification review.",
      owner: {
        email: affiliation.user?.email || "",
        mobile: affiliation.mobile || affiliation.user?.mobile || "",
        name: buildFullName(
          affiliation.user?.fullName,
          affiliation.user?.email || "Unknown user",
        ),
      },
      reference: createReference("AFF", affiliation._id),
      source: "membership_request",
      status: formatStatus(affiliation.status || "pending"),
      submittedAt: formatDateTime(
        affiliation.approval?.requestedAt || affiliation.createdAt,
      ),
      submittedLabel: formatDate(
        affiliation.approval?.requestedAt || affiliation.createdAt,
      ),
      verification: affiliation.application?.validIdImage
        ? "valid_id_uploaded"
        : "valid_id_pending",
    }));

    const payload = [...profileRows, ...affiliationRows].sort(
      (left, right) =>
        new Date(right.submittedAt || 0).getTime() -
        new Date(left.submittedAt || 0).getTime(),
    );

    res.json({
      success: "Payment verification queue fetched successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const findPayouts = async (req, res) => {
  try {
    const entries = await RaceEntries.find({
      deletedAt: { $exists: false },
      "result.rank": { $gt: 0 },
    })
      .populate("race", "name code raceDate status club")
      .populate({
        path: "affiliation",
        select: "user club",
        populate: [
          { path: "user", select: "fullName email mobile" },
          { path: "club", select: "name code abbr level location" },
        ],
      })
      .sort({ "result.rank": 1, createdAt: -1 })
      .lean({ virtuals: true });

    const payload = entries.map((entry) => {
      const rank = Number(entry.result?.rank || 0);
      const amount =
        estimatedPrizeByRank[rank] ||
        (rank > 0 ? Math.max(500, 1500 - rank * 25) : 0);

      return {
        _id: entry._id,
        amount,
        bird: {
          bandNumber: entry.bird?.bandNumber || "",
          name: entry.bird?.name || entry.bird?.bandNumber || "Unnamed bird",
        },
        club: {
          _id: entry.affiliation?.club?._id || "",
          name: buildClubName(entry.affiliation?.club),
        },
        owner: {
          email: entry.affiliation?.user?.email || "",
          mobile: entry.affiliation?.user?.mobile || "",
          name: buildFullName(
            entry.affiliation?.user?.fullName,
            entry.affiliation?.user?.email || "Unknown user",
          ),
        },
        payoutReference: `${entry.race?.code || "RACE"}-RANK-${rank || "NA"}`,
        payoutStatus:
          entry.race?.status === "completed" ? "ready" : "awaiting_publish",
        race: {
          _id: entry.race?._id || "",
          code: entry.race?.code || "",
          name: entry.race?.name || "Unknown race",
          raceDate: formatDateTime(entry.race?.raceDate),
          status: entry.race?.status || "draft",
        },
        rank,
        recordedAt: formatDateTime(entry.arrival?.arrivedAt),
      };
    });

    res.json({
      success: "Payout candidates fetched successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const findProducts = async (req, res) => {
  try {
    const [crates, pigeons] = await Promise.all([
      Crates.find({ deletedAt: { $exists: false } })
        .populate("club", "name code abbr level location")
        .populate("loft", "name code")
        .sort({ createdAt: -1 })
        .lean({ virtuals: true }),
      Pigeons.find({ deletedAt: { $exists: false } })
        .populate("club", "name code abbr level location")
        .populate("loft", "name code")
        .populate("owner", "fullName email mobile")
        .sort({ createdAt: -1 })
        .lean({ virtuals: true }),
    ]);

    const crateItems = crates.map((crate) => ({
      _id: `crate-${crate._id}`,
      category: "transport_equipment",
      club: {
        _id: crate.club?._id || "",
        name: buildClubName(crate.club),
      },
      inventoryCount:
        typeof crate.availableSlots === "number"
          ? crate.availableSlots
          : Math.max((crate.capacity || 0) - (crate.occupiedSlots || 0), 0),
      name: crate.name || crate.code || "Unnamed crate",
      reference: crate.code || createReference("CRATE", crate._id),
      source: "crate_inventory",
      status: crate.status || "available",
      subtitle: crate.loft?.name || crate.loft?.code || "No loft linked",
    }));

    const pigeonItems = pigeons.map((pigeon) => ({
      _id: `pigeon-${pigeon._id}`,
      category: "registered_bird",
      club: {
        _id: pigeon.club?._id || "",
        name: buildClubName(pigeon.club),
      },
      inventoryCount: 1,
      name: pigeon.name || pigeon.bandNumber || "Unnamed pigeon",
      owner: {
        email: pigeon.owner?.email || "",
        mobile: pigeon.owner?.mobile || "",
        name: buildFullName(
          pigeon.owner?.fullName,
          pigeon.owner?.email || "Unknown owner",
        ),
      },
      reference: pigeon.bandNumber || createReference("BIRD", pigeon._id),
      source: "pigeon_registry",
      status: pigeon.status || "active",
      subtitle: pigeon.loft?.name || pigeon.loft?.code || "No loft linked",
    }));

    const payload = [...crateItems, ...pigeonItems];

    res.json({
      success: "Product proxy catalog fetched successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOrders = async (req, res) => {
  try {
    const entries = await RaceEntries.find({
      deletedAt: { $exists: false },
    })
      .populate("race", "name code raceDate status")
      .populate({
        path: "affiliation",
        select: "user club",
        populate: [
          { path: "user", select: "fullName email mobile" },
          { path: "club", select: "name code abbr level location" },
        ],
      })
      .sort({ "booking.bookedAt": -1, createdAt: -1 })
      .lean({ virtuals: true });

    const payload = entries.map((entry) => ({
      _id: entry._id,
      bookedAt: formatDateTime(entry.booking?.bookedAt),
      club: {
        _id: entry.affiliation?.club?._id || "",
        name: buildClubName(entry.affiliation?.club),
      },
      customer: {
        email: entry.affiliation?.user?.email || "",
        mobile: entry.affiliation?.user?.mobile || "",
        name: buildFullName(
          entry.affiliation?.user?.fullName,
          entry.affiliation?.user?.email || "Unknown customer",
        ),
      },
      item: {
        bandNumber: entry.bird?.bandNumber || "",
        name: entry.bird?.name || entry.bird?.bandNumber || "Unnamed bird",
      },
      orderReference:
        entry.booking?.bookingCode || createReference("ORDER", entry._id),
      race: {
        _id: entry.race?._id || "",
        code: entry.race?.code || "",
        name: entry.race?.name || "Unknown race",
        status: entry.race?.status || "draft",
      },
      status: entry.status || "booked",
    }));

    res.json({
      success: "Order proxy feed fetched successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const findSellers = async (req, res) => {
  try {
    const clubs = await Clubs.find({
      deletedAt: { $exists: false },
    })
      .sort({ createdAt: -1 })
      .lean();

    const payload = clubs.map((club) => ({
      _id: club._id,
      contactEmail: club.email || "",
      contactPerson: club.contactPerson || "",
      contactPhone: club.contactNumber || "",
      level: club.level || "national",
      location: buildClubLocation(club.location),
      name: buildClubName(club),
      sellerStatus:
        club.isActive === false
          ? "inactive"
          : formatStatus(club.status || "active"),
      type: club.clubType || "Mixed",
    }));

    res.json({
      success: "Seller directory fetched successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const findShipments = async (req, res) => {
  try {
    const [races, entries] = await Promise.all([
      Races.find({ deletedAt: { $exists: false } })
        .populate("club", "name code abbr level location")
        .sort({ raceDate: -1, createdAt: -1 })
        .lean(),
      RaceEntries.find({ deletedAt: { $exists: false } })
        .select("race status booking departure arrival")
        .lean({ virtuals: true }),
    ]);

    const entryCountByRace = new Map();

    entries.forEach((entry) => {
      const raceId = String(entry.race || "");

      if (!raceId) {
        return;
      }

      const currentValue = entryCountByRace.get(raceId) || {
        arrived: 0,
        boarded: 0,
        booked: 0,
        departed: 0,
      };

      if (entry.status === "boarded") currentValue.boarded += 1;
      if (entry.status === "departed") currentValue.departed += 1;
      if (entry.status === "arrived") currentValue.arrived += 1;
      if (entry.status === "booked") currentValue.booked += 1;

      entryCountByRace.set(raceId, currentValue);
    });

    const payload = races.map((race) => {
      const counts = entryCountByRace.get(String(race._id)) || {
        arrived: 0,
        boarded: 0,
        booked: 0,
        departed: 0,
      };

      return {
        _id: race._id,
        booked: counts.booked,
        club: {
          _id: race.club?._id || "",
          name: buildClubName(race.club),
        },
        departureSite: race.departure?.siteName || "Departure site pending",
        departed: counts.departed,
        raceCode: race.code || "",
        raceDate: formatDateTime(race.raceDate),
        raceName: race.name || "Unnamed race",
        raceStatus: race.status || "draft",
        received: counts.arrived,
        staged: counts.boarded,
      };
    });

    res.json({
      success: "Shipment readiness feed fetched successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const findSupport = async (req, res) => {
  try {
    const [clubs, pendingAffiliations, pendingProfiles, races] = await Promise.all([
      Clubs.find({ deletedAt: { $exists: false } })
        .select("name code abbr contactPerson email isActive status location")
        .lean(),
      Affiliations.find({
        deletedAt: { $exists: false },
        status: "pending",
      })
        .populate("user", "fullName email")
        .populate("club", "name code abbr")
        .lean({ virtuals: true }),
      Users.find({
        isActive: true,
        $or: [
          { "profile.status": "pending" },
          { "profile.status": { $exists: false } },
        ],
      })
        .select("fullName email profile createdAt")
        .lean({ virtuals: true }),
      Races.find({
        deletedAt: { $exists: false },
        status: { $in: ["draft", "cancelled"] },
      })
        .select("name code status raceDate")
        .lean(),
    ]);

    const payload = [];

    clubs
      .filter((club) => !club.contactPerson || !club.email)
      .forEach((club) => {
        payload.push({
          _id: `club-${club._id}`,
          detail: "Club contact person or email is still missing.",
          openedAt: null,
          severity: "amber",
          source: club.name || club.code || club.abbr || "Club",
          status: "open",
          title: "Directory needs seller support data",
        });
      });

    pendingAffiliations.forEach((affiliation) => {
      payload.push({
        _id: `affiliation-${affiliation._id}`,
        detail: `${buildFullName(
          affiliation.user?.fullName,
          affiliation.user?.email || "Unknown user",
        )} is still waiting for club approval.`,
        openedAt: formatDateTime(affiliation.createdAt),
        severity: "sky",
        source: buildClubName(affiliation.club),
        status: "pending",
        title: "Membership approval waiting",
      });
    });

    pendingProfiles.forEach((user) => {
      payload.push({
        _id: `profile-${user._id}`,
        detail: "Profile verification is still pending final review.",
        openedAt: formatDateTime(user.createdAt),
        severity: "amber",
        source: buildFullName(user.fullName, user.email || "Unknown user"),
        status: formatStatus(user.profile?.status || "pending"),
        title: "Profile review pending",
      });
    });

    races.forEach((race) => {
      payload.push({
        _id: `race-${race._id}`,
        detail: `${race.name || race.code || "Race"} is still ${formatStatus(
          race.status,
        )} on the backend.`,
        openedAt: formatDateTime(race.raceDate),
        severity: race.status === "cancelled" ? "rose" : "violet",
        source: race.code || "Race",
        status: formatStatus(race.status),
        title: "Race status needs attention",
      });
    });

    res.json({
      success: "Support watchlist fetched successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};
