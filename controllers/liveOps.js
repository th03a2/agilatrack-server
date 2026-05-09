import mongoose from "mongoose";
import Affiliations from "../models/Affiliations.js";
import Birds from "../models/Birds.js";
import Clubs from "../models/Clubs.js";
import Crates from "../models/Crates.js";
import RaceEntries from "../models/RaceEntries.js";
import Races from "../models/Races.js";
import Users from "../models/Users.js";
import Wallets from "../models/Wallets.js";
import {
  isTenantSuperAdmin,
  resolveTenantClubId,
} from "../middleware/tenantIsolation.js";
import CommerceShopOrders from "../commerce/models/CommerceShopOrders.js";
import CommerceShopProducts from "../commerce/models/CommerceShopProducts.js";

const paymentTransactionTypes = new Set([
  "preload",
  "recharge_request",
  "bird_registration_fee",
  "race_fee",
]);

const payoutShareByRank = {
  1: 0.5,
  2: 0.25,
  3: 0.15,
  4: 0.06,
  5: 0.04,
};

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const normalizeText = (value = "") => String(value || "").trim();

const formatDateTimeLabel = (value) => {
  if (!value) return "Not set";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const formatName = (user = {}) => {
  const fullName = [
    user?.fullName?.fname,
    user?.fullName?.mname,
    user?.fullName?.lname,
    user?.fullName?.suffix,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return fullName || normalizeText(user?.name) || normalizeText(user?.email) || "Unknown user";
};

const buildLocationLabel = (value = {}) =>
  [
    value?.location?.municipality || value?.address?.municipality,
    value?.location?.province || value?.address?.province,
    value?.location?.region || value?.address?.region,
  ]
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(", ");

const buildClubSummary = (club = {}) => ({
  club: club?._id ? String(club._id) : "",
  level: normalizeText(club?.level),
  location: buildLocationLabel(club),
  name: normalizeText(club?.name) || normalizeText(club?.abbr) || "Club",
});

const buildOwnerSummary = (user = {}) => ({
  email: normalizeText(user?.email),
  mobile: normalizeText(user?.mobile),
  name: formatName(user),
  user: user?._id ? String(user._id) : "",
});

const buildRaceSummary = (race = {}) => ({
  code: normalizeText(race?.code),
  name: normalizeText(race?.name),
  race: race?._id ? String(race._id) : "",
  raceDate: race?.raceDate || null,
  status: normalizeText(race?.status),
});

const buildStatusFromConnection = (readyState) => {
  const baseState = {
    host: mongoose.connection.host || "",
    name: mongoose.connection.name || "",
    readyState,
  };

  if (readyState === 1) {
    return {
      ...baseState,
      connected: true,
      message: "MongoDB connection is live.",
      status: "connected",
    };
  }

  if (readyState === 2) {
    return {
      ...baseState,
      connected: false,
      message: "MongoDB is still connecting.",
      status: "connecting",
    };
  }

  if (readyState === 3) {
    return {
      ...baseState,
      connected: false,
      message: "MongoDB is disconnecting.",
      status: "disconnecting",
    };
  }

  return {
    ...baseState,
    connected: false,
    message: "MongoDB is disconnected.",
    status: "disconnected",
  };
};

const filterPayloadByClub = (payload = [], clubId = "") => {
  const normalizedClubId = normalizeText(clubId);

  if (!normalizedClubId) {
    return payload;
  }

  return payload.filter((record) => {
    const recordClubId =
      record?.club && typeof record.club === "object"
        ? normalizeText(record.club.club || record.club._id)
        : normalizeText(record?.club);

    return recordClubId === normalizedClubId;
  });
};

const buildWalletOwner = (wallet = {}) => wallet?.affiliation?.user || wallet?.user || {};

const populateWalletFeed = (query) =>
  query
    .populate("user", "fullName email mobile")
    .populate("club", "name code abbr level location")
    .populate({
      path: "affiliation",
      select: "memberCode status membershipType roles user club",
      populate: [
        { path: "user", select: "fullName email mobile" },
        { path: "club", select: "name code abbr level location" },
      ],
    })
    .populate("transactions.race", "name code raceDate status club entryFee")
    .populate("transactions.bird", "bandNumber name strain status")
    .lean({ virtuals: true });

const populateRaceEntryFeed = (query) =>
  query
    .populate({
      path: "race",
      select: "name code raceDate status entryFee departure club createdAt",
      populate: {
        path: "club",
        select: "name code abbr level location",
      },
    })
    .populate({
      path: "affiliation",
      select: "memberCode status membershipType roles user club",
      populate: [
        { path: "user", select: "fullName email mobile" },
        { path: "club", select: "name code abbr level location" },
      ],
    })
    .populate("loft", "name code")
    .lean({ virtuals: true });

const populateBirdFeed = (query) =>
  query
    .populate("club", "name code abbr level location")
    .populate("owner", "fullName email mobile")
    .populate("loft", "name code")
    .lean({ virtuals: true });

const populateCrateFeed = (query) =>
  query
    .populate("club", "name code abbr level location")
    .populate("loft", "name code")
    .populate("handler", "fullName email mobile")
    .lean({ virtuals: true });

export const getHealthPayload = () => {
  const database = buildStatusFromConnection(mongoose.connection.readyState);

  return {
    database,
    environment: process.env.NODE_ENV || "development",
    status: database.connected ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    version:
      process.env.APP_VERSION ||
      process.env.RENDER_GIT_COMMIT ||
      process.env.npm_package_version ||
      "1.0.0",
  };
};

export const getHealth = async (req, res) => {
  try {
    res.json({
      success: "Health status fetched successfully",
      payload: getHealthPayload(),
    });
  } catch (error) {
    sendError(res, error, 500);
  }
};

const resolveLiveOpsClubId = (req, res) =>
  resolveTenantClubId(req, res, {
    requestedClubId: req.query?.clubId || req.query?.club,
    requireClub: !isTenantSuperAdmin(req.auth),
  });

export const buildPaymentsPayload = async ({ clubId = "" } = {}) => {
  const [wallets, shopOrders] = await Promise.all([
    populateWalletFeed(
      Wallets.find({
        ...(clubId ? { club: clubId } : {}),
        deletedAt: { $exists: false },
      }).sort({ updatedAt: -1 }),
    ),
    CommerceShopOrders.find({
      ...(clubId ? { club: clubId } : {}),
      deletedAt: { $exists: false },
    })
      .populate("club", "name code abbr level location")
      .populate("buyer", "fullName email mobile")
      .sort({ updatedAt: -1 })
      .lean(),
  ]);

  const walletPayments = wallets
    .flatMap((wallet) => {
      const owner = buildOwnerSummary(buildWalletOwner(wallet));
      const club = buildClubSummary(wallet?.affiliation?.club || wallet?.club || {});

      return (wallet.transactions || [])
        .filter((transaction) => paymentTransactionTypes.has(transaction?.type))
        .map((transaction) => ({
          _id: `${wallet._id || "wallet"}:${transaction._id || "transaction"}`,
          amount: {
            amount: Number(transaction?.amount || 0),
            currency: wallet.currency || "PHP",
          },
          club,
          notes: normalizeText(transaction?.description),
          owner,
          reference:
            normalizeText(transaction?.gcashReference) ||
            normalizeText(transaction?.meta?.reference) ||
            normalizeText(transaction?.meta?.receiptNumber) ||
            `PAY-${String(transaction?._id || wallet?._id || "0000").slice(-8).toUpperCase()}`,
          source: normalizeText(transaction?.type) || "wallet transaction",
          status:
            normalizeText(transaction?.status) ||
            (transaction?.type === "recharge_request" ? "pending" : "completed"),
          submittedAt: transaction?.transactedAt || wallet.updatedAt || wallet.createdAt,
          submittedLabel: formatDateTimeLabel(
            transaction?.transactedAt || wallet.updatedAt || wallet.createdAt,
          ),
          verification: transaction?.requiresCall
            ? "call required"
            : normalizeText(transaction?.status) || "completed",
        }));
    });
  const shopPayments = shopOrders.map((order) => ({
    _id: `shop-order-${order._id}`,
    amount: {
      amount: Number(order.totalAmount || 0),
      currency: order.currency || "PHP",
    },
    club: buildClubSummary(order.club || {}),
    notes: `Club shop order ${order.orderNumber}`,
    owner: buildOwnerSummary(order.buyer || {}),
    reference: order.paymentReference || order.orderNumber,
    source: "club shop",
    status: order.paymentStatus || "pending",
    submittedAt: order.updatedAt || order.createdAt,
    submittedLabel: formatDateTimeLabel(order.updatedAt || order.createdAt),
    verification: order.paymentStatus === "paid" ? "completed" : "pending",
  }));

  const payload = [...walletPayments, ...shopPayments].sort(
    (left, right) =>
      new Date(right.submittedAt || 0).getTime() - new Date(left.submittedAt || 0).getTime(),
  );

  return filterPayloadByClub(payload, clubId);
};

export const findPayments = async (req, res) => {
  try {
    const clubId = await resolveLiveOpsClubId(req, res);

    if (clubId === null) {
      return null;
    }

    const payload = await buildPaymentsPayload({ clubId });

    res.json({ success: "Payments fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const buildPayoutsPayload = async ({ clubId = "" } = {}) => {
  const scopedRaceIds = clubId
    ? (await Races.find({
        club: clubId,
        deletedAt: { $exists: false },
      })
        .select("_id")
        .lean()).map((race) => race._id)
    : [];
  const entries = await populateRaceEntryFeed(
    RaceEntries.find({
      deletedAt: { $exists: false },
      ...(clubId ? { race: { $in: scopedRaceIds } } : {}),
      "result.rank": { $exists: true, $ne: null },
      "result.status": "qualified",
    }),
  );

  const qualifiedEntryCountByRace = entries.reduce((counts, entry) => {
    const raceId = String(entry?.race?._id || entry?.race || "");

    if (!raceId) {
      return counts;
    }

    counts.set(raceId, (counts.get(raceId) || 0) + 1);
    return counts;
  }, new Map());

  const payload = entries
    .map((entry) => {
      const raceId = String(entry?.race?._id || entry?.race || "");
      const rank = Number(entry?.result?.rank || 0);
      const qualifiedEntryCount = qualifiedEntryCountByRace.get(raceId) || 1;
      const prizePool =
        Number(entry?.race?.entryFee?.amount || 0) * qualifiedEntryCount;
      const payoutAmount = Number(
        ((prizePool || 0) * (payoutShareByRank[rank] || 0)).toFixed(2),
      );
      const race = buildRaceSummary(entry?.race || {});
      const owner = buildOwnerSummary(entry?.affiliation?.user || {});
      const club = buildClubSummary(entry?.affiliation?.club || entry?.race?.club || {});

      return {
        _id: entry?._id ? String(entry._id) : `${race.code || "RACE"}-${rank || 0}`,
        amount: {
          amount: payoutAmount,
          currency: entry?.race?.entryFee?.currency || "PHP",
        },
        bird: {
          bandNumber: normalizeText(entry?.bird?.bandNumber),
          name: normalizeText(entry?.bird?.name),
        },
        club,
        owner,
        payoutReference:
          race.code && rank
            ? `PAYOUT-${race.code}-${String(rank).padStart(2, "0")}`
            : `PAYOUT-${String(entry?._id || "0000").slice(-8).toUpperCase()}`,
        payoutStatus:
          entry?.race?.status === "completed"
            ? "ready"
            : entry?.status === "arrived"
              ? "review"
              : "pending",
        race,
        rank,
        recordedAt: entry?.arrival?.arrivedAt || entry?.updatedAt || entry?.createdAt,
      };
    })
    .sort((left, right) => {
      const dateRank =
        new Date(right.race?.raceDate || 0).getTime() - new Date(left.race?.raceDate || 0).getTime();

      if (dateRank !== 0) {
        return dateRank;
      }

      return (left.rank || 999) - (right.rank || 999);
    });

  return filterPayloadByClub(payload, clubId);
};

export const findPayouts = async (req, res) => {
  try {
    const clubId = await resolveLiveOpsClubId(req, res);

    if (clubId === null) {
      return null;
    }

    const payload = await buildPayoutsPayload({ clubId });

    res.json({ success: "Payouts fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const buildProductsPayload = async ({ clubId = "" } = {}) => {
  const [birds, crates, shopProducts] = await Promise.all([
    populateBirdFeed(
      Birds.find({
        ...(clubId ? { club: clubId } : {}),
        deletedAt: { $exists: false },
      }).sort({ createdAt: -1 }),
    ),
    populateCrateFeed(
      Crates.find({
        ...(clubId ? { club: clubId } : {}),
        deletedAt: { $exists: false },
      }).sort({ createdAt: -1 }),
    ),
    CommerceShopProducts.find({
      ...(clubId ? { club: clubId } : {}),
      deletedAt: { $exists: false },
    })
      .populate("club", "name code abbr level location")
      .populate("owner", "fullName email mobile")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const crateProducts = crates.map((crate) => ({
    _id: `crate-${crate._id || crate.code || "registry"}`,
    category: "crate",
    club: buildClubSummary(crate?.club || {}),
    inventoryCount:
      typeof crate.availableSlots === "number"
        ? crate.availableSlots
        : Math.max((crate.capacity || 0) - (crate.occupiedSlots || 0), 0),
    name: normalizeText(crate?.name) || `${normalizeText(crate?.code) || "Crate"} Unit`,
    owner: buildOwnerSummary(crate?.handler || {}),
    reference: normalizeText(crate?.code),
    source: "crate registry",
    status: normalizeText(crate?.status) || "active",
    subtitle: normalizeText(crate?.type) || "standard",
  }));

  const birdProducts = birds.map((bird) => ({
    _id: `bird-${bird._id || bird.bandNumber || "registry"}`,
    category: "pigeon",
    club: buildClubSummary(bird?.club || {}),
    inventoryCount: ["sold", "deceased", "archived"].includes(bird?.status) ? 0 : 1,
    name: normalizeText(bird?.name) || normalizeText(bird?.bandNumber) || "Registered pigeon",
    owner: buildOwnerSummary(bird?.owner || {}),
    reference: normalizeText(bird?.bandNumber),
    source: "pigeon registry",
    status: normalizeText(bird?.status) || "active",
    subtitle: normalizeText(bird?.strain) || normalizeText(bird?.species) || "pigeon",
  }));

  const shopProductRows = shopProducts.map((product) => ({
    _id: `shop-${product._id}`,
    category: product.category,
    club: buildClubSummary(product.club || {}),
    inventoryCount: Number(product.stockQuantity || 0),
    name: normalizeText(product.name) || "Club shop product",
    owner: buildOwnerSummary(product.owner || {}),
    reference: normalizeText(product.sku) || String(product._id || ""),
    revenue: Number(product.revenue || 0),
    salesCount: Number(product.salesCount || 0),
    source: "club shop",
    status: normalizeText(product.status) || "active",
    subtitle: normalizeText(product.productType),
  }));

  const payload = [...shopProductRows, ...crateProducts, ...birdProducts].sort((left, right) =>
    String(left.name || "").localeCompare(String(right.name || "")),
  );

  return filterPayloadByClub(payload, clubId);
};

export const findProducts = async (req, res) => {
  try {
    const clubId = await resolveLiveOpsClubId(req, res);

    if (clubId === null) {
      return null;
    }

    const payload = await buildProductsPayload({ clubId });

    res.json({ success: "Products fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const buildOrdersPayload = async ({ clubId = "" } = {}) => {
  const scopedRaceIds = clubId
    ? (await Races.find({
        club: clubId,
        deletedAt: { $exists: false },
      })
        .select("_id")
        .lean()).map((race) => race._id)
    : [];
  const [entries, shopOrders] = await Promise.all([
    populateRaceEntryFeed(
      RaceEntries.find({
        deletedAt: { $exists: false },
        ...(clubId ? { race: { $in: scopedRaceIds } } : {}),
      }).sort({ createdAt: -1 }),
    ),
    CommerceShopOrders.find({
      ...(clubId ? { club: clubId } : {}),
      deletedAt: { $exists: false },
    })
      .populate("club", "name code abbr level location")
      .populate("buyer", "fullName email mobile")
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const raceEntryOrders = entries.map((entry) => {
    const race = buildRaceSummary(entry?.race || {});
    const club = buildClubSummary(entry?.affiliation?.club || entry?.race?.club || {});

    return {
      _id: entry?._id ? String(entry._id) : "",
      bookedAt: entry?.booking?.bookedAt || entry?.createdAt,
      club,
      customer: buildOwnerSummary(entry?.affiliation?.user || {}),
      item: {
        bandNumber: normalizeText(entry?.bird?.bandNumber),
        category: "race entry",
        name: normalizeText(entry?.bird?.name) || normalizeText(entry?.bird?.bandNumber),
        quantity: 1,
        reference: normalizeText(entry?.booking?.bookingCode) || normalizeText(entry?._id),
      },
      orderReference:
        normalizeText(entry?.booking?.bookingCode) ||
        `ORD-${String(entry?._id || "0000").slice(-8).toUpperCase()}`,
      race,
      status:
        {
          arrived: "completed",
          boarded: "packed",
          booked: "booked",
          checked_in: "confirmed",
          departed: "shipped",
          disqualified: "review",
          dnf: "completed",
          no_show: "cancelled",
          scratched: "cancelled",
        }[entry?.status] || normalizeText(entry?.status) || "draft",
    };
  });

  const shopOrderRows = shopOrders.map((order) => {
    const firstItem = order.items?.[0] || {};

    return {
      _id: String(order._id || ""),
      bookedAt: order.createdAt,
      club: buildClubSummary(order.club || {}),
      customer: buildOwnerSummary(order.buyer || {}),
      item: {
        bandNumber: "",
        category: firstItem.category || "club shop",
        name: firstItem.productName || "Club shop order",
        quantity: Number(firstItem.quantity || order.items?.length || 1),
        reference: order.orderNumber,
      },
      orderReference: order.orderNumber,
      race: {},
      status: order.orderStatus || "pending",
      totalAmount: Number(order.totalAmount || 0),
    };
  });

  return filterPayloadByClub([...shopOrderRows, ...raceEntryOrders], clubId);
};

export const findOrders = async (req, res) => {
  try {
    const clubId = await resolveLiveOpsClubId(req, res);

    if (clubId === null) {
      return null;
    }

    const payload = await buildOrdersPayload({ clubId });

    res.json({ success: "Orders fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findSellers = async (req, res) => {
  try {
    const clubId = await resolveLiveOpsClubId(req, res);

    if (clubId === null) {
      return null;
    }

    const clubs = await Clubs.find({
      deletedAt: { $exists: false },
      ...(clubId ? { _id: clubId } : {}),
    })
      .sort({ createdAt: -1 })
      .lean();

    const payload = clubs.map((club) => ({
      _id: club?._id ? String(club._id) : "",
      contactEmail: normalizeText(club?.email),
      contactPerson: normalizeText(club?.contactPerson) || normalizeText(club?.name),
      contactPhone: normalizeText(club?.contactNumber),
      level: normalizeText(club?.level),
      location: buildLocationLabel(club),
      name: normalizeText(club?.name) || normalizeText(club?.abbr) || "Club seller",
      sellerStatus:
        club?.isActive === false ? "inactive" : normalizeText(club?.status) || "active",
      type: normalizeText(club?.clubType) || normalizeText(club?.type) || "club",
    }));

    res.json({ success: "Sellers fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findShipments = async (req, res) => {
  try {
    const clubId = await resolveLiveOpsClubId(req, res);

    if (clubId === null) {
      return null;
    }

    const races = await Races.find({
      deletedAt: { $exists: false },
      ...(clubId ? { club: clubId } : {}),
    })
      .populate("club", "name code abbr level location")
      .sort({ raceDate: -1, createdAt: -1 })
      .lean();
    const scopedRaceIds = new Set(races.map((race) => String(race._id || "")));
    const scopedRaceEntries = await RaceEntries.find({
      deletedAt: { $exists: false },
      ...(clubId ? { race: { $in: Array.from(scopedRaceIds) } } : {}),
    })
      .select("race status arrival booking createdAt")
      .lean();

    const entryStatsByRace = scopedRaceEntries.reduce((stats, entry) => {
      const raceId = String(entry?.race || "");

      if (!raceId) {
        return stats;
      }

      const currentStats = stats.get(raceId) || {
        booked: 0,
        departed: 0,
        received: 0,
        staged: 0,
      };

      currentStats.booked += 1;

      if (["checked_in", "boarded", "departed", "arrived"].includes(entry?.status)) {
        currentStats.staged += 1;
      }

      if (["departed", "arrived", "dnf", "disqualified"].includes(entry?.status)) {
        currentStats.departed += 1;
      }

      if (entry?.arrival?.arrivedAt || entry?.status === "arrived") {
        currentStats.received += 1;
      }

      stats.set(raceId, currentStats);
      return stats;
    }, new Map());

    const payload = races.map((race) => {
      const raceId = String(race?._id || "");
      const entryStats = entryStatsByRace.get(raceId) || {
        booked: 0,
        departed: 0,
        received: 0,
        staged: 0,
      };

      return {
        _id: raceId,
        booked: entryStats.booked,
        club: buildClubSummary(race?.club || {}),
        deliveredAt: race?.status === "completed" ? race?.updatedAt || race?.raceDate : null,
        departureSite: normalizeText(race?.departure?.siteName),
        departed: entryStats.departed,
        departedAt: race?.departure?.departedAt || null,
        race: buildRaceSummary(race),
        received: entryStats.received,
        scheduledAt:
          race?.boarding?.startsAt ||
          race?.checkIn?.startsAt ||
          race?.raceDate ||
          race?.createdAt,
        shipmentStatus:
          {
            boarding: "staging",
            booking_closed: "queued",
            booking_open: "scheduled",
            cancelled: "cancelled",
            check_in: "check in",
            completed: "delivered",
            departed: "in transit",
            draft: "draft",
          }[race?.status] || normalizeText(race?.status) || "draft",
        staged: entryStats.staged,
        trackingReference: race?.code ? `SHIP-${race.code}` : `SHIP-${raceId.slice(-8)}`,
      };
    });

    res.json({ success: "Shipments fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findSupport = async (req, res) => {
  try {
    const clubId = await resolveLiveOpsClubId(req, res);

    if (clubId === null) {
      return null;
    }

    const scopedUserIds = clubId
      ? (await Affiliations.find({
          club: clubId,
          deletedAt: { $exists: false },
        })
          .select("user")
          .lean()).map((affiliation) => affiliation.user)
      : [];

    const [
      pendingAffiliations,
      incompleteClubs,
      pendingProfiles,
      pendingBirdApprovals,
      wallets,
    ] = await Promise.all([
      Affiliations.find({
        ...(clubId ? { club: clubId } : {}),
        deletedAt: { $exists: false },
        status: "pending",
      })
        .populate("club", "name code abbr level location")
        .populate("user", "fullName email mobile")
        .sort({ createdAt: -1 })
        .lean(),
      Clubs.find({
        ...(clubId ? { _id: clubId } : {}),
        deletedAt: { $exists: false },
        $or: [
          { contactPerson: { $exists: false } },
          { contactPerson: "" },
          { email: { $exists: false } },
          { email: "" },
        ],
      })
        .sort({ createdAt: -1 })
        .lean(),
      Users.find({
        ...(clubId ? { _id: { $in: scopedUserIds } } : {}),
        isActive: true,
        "profile.status": "pending",
      })
        .select("fullName email profile createdAt")
        .sort({ createdAt: -1 })
        .lean(),
      Birds.find({
        ...(clubId ? { club: clubId } : {}),
        deletedAt: { $exists: false },
        approvalStatus: "pending",
      })
        .populate("club", "name code abbr")
        .sort({ createdAt: -1 })
        .lean(),
      populateWalletFeed(
        Wallets.find({
          ...(clubId ? { club: clubId } : {}),
          deletedAt: { $exists: false },
        }).sort({ updatedAt: -1 }),
      ),
    ]);

    const issues = [
      ...pendingAffiliations.slice(0, 12).map((affiliation) => ({
        _id: `affiliation-${affiliation._id}`,
        detail: `${formatName(affiliation?.user || {})} is waiting for club approval.`,
        openedAt: affiliation?.createdAt,
        severity: "amber",
        source:
          normalizeText(affiliation?.club?.name) ||
          normalizeText(affiliation?.club?.abbr) ||
          "Club membership",
        sourceType: "affiliation",
        status: normalizeText(affiliation?.status) || "pending",
        title: "Membership approval pending",
      })),
      ...incompleteClubs.slice(0, 12).map((club) => ({
        _id: `club-${club._id}`,
        detail: "Add contact person and email to unlock live seller and support workflows.",
        openedAt: club?.createdAt,
        severity: "amber",
        source: normalizeText(club?.name) || normalizeText(club?.abbr) || "Club",
        sourceType: "club",
        status: "open",
        title: "Club directory record incomplete",
      })),
      ...pendingProfiles.slice(0, 12).map((user) => ({
        _id: `profile-${user._id}`,
        detail: `${formatName(user)} still needs profile approval.`,
        openedAt: user?.createdAt,
        severity: "sky",
        source: normalizeText(user?.email) || "User profile",
        sourceType: "user",
        status: normalizeText(user?.profile?.status) || "pending",
        title: "Profile review still pending",
      })),
      ...pendingBirdApprovals.slice(0, 12).map((bird) => ({
        _id: `bird-${bird._id}`,
        detail: `${normalizeText(bird?.name) || normalizeText(bird?.bandNumber)} is still awaiting approval.`,
        openedAt: bird?.createdAt,
        severity: "amber",
        source:
          normalizeText(bird?.club?.name) ||
          normalizeText(bird?.club?.abbr) ||
          "Bird registry",
        sourceType: "bird",
        status: normalizeText(bird?.approvalStatus) || "pending",
        title: "Pigeon approval pending",
      })),
      ...wallets.flatMap((wallet) => {
        const owner = buildWalletOwner(wallet);
        const clubName =
          normalizeText(wallet?.affiliation?.club?.name) ||
          normalizeText(wallet?.club?.name) ||
          "Wallet support";

        return (wallet.transactions || [])
          .filter((transaction) => transaction?.status === "pending" || transaction?.requiresCall)
          .slice(0, 8)
          .map((transaction) => ({
            _id: `wallet-${wallet._id}-${transaction._id}`,
            detail: `${formatName(owner)} has a pending wallet action that still needs review.`,
            openedAt: transaction?.transactedAt || wallet?.updatedAt || wallet?.createdAt,
            severity: transaction?.requiresCall ? "rose" : "amber",
            source: clubName,
            sourceType: "wallet",
            status: normalizeText(transaction?.status) || "pending",
            title:
              transaction?.type === "recharge_request"
                ? "Recharge request pending verification"
                : "Wallet transaction needs review",
          }));
      }),
    ]
      .sort(
        (left, right) =>
          new Date(right.openedAt || 0).getTime() - new Date(left.openedAt || 0).getTime(),
      )
      .slice(0, 40);

    res.json({ success: "Support feed fetched successfully", payload: issues });
  } catch (error) {
    sendError(res, error);
  }
};
