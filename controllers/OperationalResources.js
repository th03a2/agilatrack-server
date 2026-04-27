import mongoose from "mongoose";
import Affiliations from "../models/Affiliations.js";
import Clubs from "../models/Clubs.js";
import Crates from "../models/Crates.js";
import Orders from "../models/Orders.js";
import Payments from "../models/Payments.js";
import Payouts from "../models/Payouts.js";
import Pigeons from "../models/Pigeons.js";
import Products from "../models/Products.js";
import RaceEntries from "../models/RaceEntries.js";
import Races from "../models/Races.js";
import Sellers from "../models/Sellers.js";
import Shipments from "../models/Shipments.js";
import SupportTickets from "../models/SupportTickets.js";
import Users from "../models/Users.js";
import { createResourceCode } from "../models/operationsShared.js";

const ACTIVE_QUERY = { deletedAt: { $exists: false } };
const estimatedPrizeByRank = {
  1: 5000,
  2: 3000,
  3: 2000,
};

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
  [location?.municipality, location?.province, location?.region]
    .filter(Boolean)
    .join(", ");

const normalizeStatusValue = (value = "", fallback = "pending") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_") || fallback;

const escapeRegExp = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSearchRegex = (value = "") => new RegExp(escapeRegExp(value), "i");

const seedDocuments = async (Model, rows = []) => {
  const resolvedRows = await Promise.resolve(rows);
  const documents = resolvedRows.filter((row) => row?.externalKey);

  if (!documents.length) {
    return;
  }

  await Model.bulkWrite(
    documents.map((document) => ({
      updateOne: {
        filter: { externalKey: document.externalKey },
        update: { $setOnInsert: document },
        upsert: true,
      },
    })),
    { ordered: false },
  );
};

const buildListQuery = ({ filters = [], query = {}, searchFields = [] }) => {
  const dbQuery = { ...ACTIVE_QUERY };

  filters.forEach(({ field, param, partial, transform }) => {
    const rawValue = query?.[param];

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return;
    }

    const nextValue = transform ? transform(rawValue) : rawValue;

    if (nextValue === undefined || nextValue === null || nextValue === "") {
      return;
    }

    dbQuery[field] = partial ? buildSearchRegex(nextValue) : nextValue;
  });

  const searchValue = String(query?.q || "").trim();

  if (searchValue && searchFields.length) {
    const regex = buildSearchRegex(searchValue);
    dbQuery.$or = searchFields.map((field) => ({ [field]: regex }));
  }

  return dbQuery;
};

const findActiveDocument = async (Model, identifier, lookupFields = []) => {
  const value = String(identifier || "").trim();
  const conditions = lookupFields.map((field) => ({ [field]: value }));

  if (mongoose.Types.ObjectId.isValid(value)) {
    conditions.unshift({ _id: value });
  }

  if (!conditions.length) {
    return null;
  }

  return Model.findOne({
    ...ACTIVE_QUERY,
    $or: conditions,
  });
};

const toNumber = (value) => {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : undefined;
};

const buildClubSummary = (club = {}) => ({
  abbr: club?.abbr || "",
  club: club?._id || undefined,
  code: club?.code || "",
  level: club?.level || "",
  location: buildClubLocation(club?.location),
  name: buildClubName(club),
});

const buildOwnerSummary = (user = {}, fallback = "Unknown user") => ({
  email: user?.email || "",
  mobile: user?.mobile || "",
  name: buildFullName(user?.fullName, user?.email || fallback),
  user: user?._id || undefined,
});

const buildPaymentRows = async () => {
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

  return [
    ...pendingProfiles.map((user) => ({
      amount: { amount: 0, currency: "PHP" },
      externalKey: `profile:${user._id}`,
      metadata: {
        isEmailVerified: Boolean(user.isEmailVerified),
        sourceEntity: "user",
        sourceId: String(user._id),
      },
      notes: user.validIdImage
        ? "Valid ID uploaded. Waiting for profile review."
        : "Valid ID not uploaded yet.",
      owner: buildOwnerSummary(user),
      reference: createResourceCode("PROFILE", user._id),
      source: "profile_verification",
      status: normalizeStatusValue(user.profile?.status, "pending"),
      submittedAt: user.createdAt,
      submittedLabel: formatDate(user.createdAt),
      verification: user.isEmailVerified ? "email_verified" : "email_pending",
    })),
    ...pendingAffiliations.map((affiliation) => ({
      amount: { amount: 0, currency: "PHP" },
      club: buildClubSummary(affiliation.club),
      externalKey: `affiliation:${affiliation._id}`,
      metadata: {
        sourceEntity: "affiliation",
        sourceId: String(affiliation._id),
      },
      notes:
        affiliation.application?.reasonForJoining ||
        "Pending membership and payment-verification review.",
      owner: {
        ...buildOwnerSummary(
          affiliation.user,
          affiliation.user?.email || "Unknown user",
        ),
        mobile: affiliation.mobile || affiliation.user?.mobile || "",
      },
      reference: createResourceCode("AFF", affiliation._id),
      source: "membership_request",
      status: normalizeStatusValue(affiliation.status, "pending"),
      submittedAt: affiliation.approval?.requestedAt || affiliation.createdAt,
      submittedLabel: formatDate(
        affiliation.approval?.requestedAt || affiliation.createdAt,
      ),
      verification: affiliation.application?.validIdImage
        ? "valid_id_uploaded"
        : "valid_id_pending",
    })),
  ];
};

const buildPayoutRows = async () => {
  const entries = await RaceEntries.find({
    deletedAt: { $exists: false },
    "result.rank": { $gt: 0 },
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
    .sort({ "result.rank": 1, createdAt: -1 })
    .lean({ virtuals: true });

  return entries.map((entry) => {
    const rank = Number(entry.result?.rank || 0);
    const amount =
      estimatedPrizeByRank[rank] ||
      (rank > 0 ? Math.max(500, 1500 - rank * 25) : 0);

    return {
      amount: { amount, currency: "PHP" },
      bird: {
        bandNumber: entry.bird?.bandNumber || "",
        name: entry.bird?.name || entry.bird?.bandNumber || "Unnamed bird",
      },
      club: buildClubSummary(entry.affiliation?.club),
      externalKey: `race-entry:${entry._id}`,
      metadata: {
        raceEntryId: String(entry._id),
      },
      owner: buildOwnerSummary(
        entry.affiliation?.user,
        entry.affiliation?.user?.email || "Unknown user",
      ),
      payoutReference: `${entry.race?.code || "RACE"}-RANK-${rank || "NA"}`,
      payoutStatus:
        entry.race?.status === "completed" ? "ready" : "awaiting_publish",
      race: {
        code: entry.race?.code || "",
        name: entry.race?.name || "Unknown race",
        race: entry.race?._id || undefined,
        raceDate: entry.race?.raceDate || undefined,
        status: normalizeStatusValue(entry.race?.status, "draft"),
      },
      rank,
      recordedAt: entry.arrival?.arrivedAt || undefined,
      source: "race_result",
    };
  });
};

const buildProductRows = async () => {
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

  return [
    ...crates.map((crate) => ({
      category: "transport_equipment",
      club: buildClubSummary(crate.club),
      externalKey: `crate:${crate._id}`,
      inventoryCount:
        typeof crate.availableSlots === "number"
          ? crate.availableSlots
          : Math.max((crate.capacity || 0) - (crate.occupiedSlots || 0), 0),
      metadata: {
        capacity: crate.capacity || 0,
        loftCode: crate.loft?.code || "",
        loftName: crate.loft?.name || "",
        occupiedSlots: crate.occupiedSlots || 0,
        sourceEntity: "crate",
        sourceId: String(crate._id),
      },
      name: crate.name || crate.code || "Unnamed crate",
      reference: crate.code || createResourceCode("CRATE", crate._id),
      source: "crate_inventory",
      status: normalizeStatusValue(crate.status, "available"),
      subtitle: crate.loft?.name || crate.loft?.code || "No loft linked",
    })),
    ...pigeons.map((pigeon) => ({
      category: "registered_bird",
      club: buildClubSummary(pigeon.club),
      externalKey: `pigeon:${pigeon._id}`,
      inventoryCount: 1,
      metadata: {
        loftCode: pigeon.loft?.code || "",
        loftName: pigeon.loft?.name || "",
        sourceEntity: "pigeon",
        sourceId: String(pigeon._id),
        strain: pigeon.strain || "",
      },
      name: pigeon.name || pigeon.bandNumber || "Unnamed pigeon",
      owner: buildOwnerSummary(
        pigeon.owner,
        pigeon.owner?.email || "Unknown owner",
      ),
      reference: pigeon.bandNumber || createResourceCode("BIRD", pigeon._id),
      source: "pigeon_registry",
      status: normalizeStatusValue(pigeon.status, "active"),
      subtitle: pigeon.loft?.name || pigeon.loft?.code || "No loft linked",
    })),
  ];
};

const buildOrderRows = async () => {
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

  return entries.map((entry) => ({
    bookedAt: entry.booking?.bookedAt || entry.createdAt,
    club: buildClubSummary(entry.affiliation?.club),
    customer: buildOwnerSummary(
      entry.affiliation?.user,
      entry.affiliation?.user?.email || "Unknown customer",
    ),
    externalKey: `race-entry:${entry._id}`,
    item: {
      bandNumber: entry.bird?.bandNumber || "",
      category: "race_entry",
      name: entry.bird?.name || entry.bird?.bandNumber || "Unnamed bird",
      quantity: 1,
      reference: entry.bird?.bandNumber || "",
    },
    metadata: {
      raceEntryId: String(entry._id),
    },
    orderReference:
      entry.booking?.bookingCode || createResourceCode("ORDER", entry._id),
    race: {
      code: entry.race?.code || "",
      name: entry.race?.name || "Unknown race",
      race: entry.race?._id || undefined,
      raceDate: entry.race?.raceDate || undefined,
      status: normalizeStatusValue(entry.race?.status, "draft"),
    },
    source: "race_entry_booking",
    status: normalizeStatusValue(entry.status, "booked"),
    total: { amount: 0, currency: "PHP" },
  }));
};

const buildSellerRows = async () => {
  const clubs = await Clubs.find({
    deletedAt: { $exists: false },
  })
    .sort({ createdAt: -1 })
    .lean();

  return clubs.map((club) => ({
    club: buildClubSummary(club),
    contactEmail: club.email || "",
    contactPerson: club.contactPerson || "",
    contactPhone: club.contactNumber || "",
    externalKey: `club:${club._id}`,
    level: club.level || "national",
    location: buildClubLocation(club.location),
    metadata: {
      sourceEntity: "club",
      sourceId: String(club._id),
    },
    name: buildClubName(club),
    sellerStatus:
      club.isActive === false
        ? "inactive"
        : normalizeStatusValue(club.status, "active"),
    type: club.clubType || "Mixed",
  }));
};

const buildShipmentRows = async () => {
  const [races, entries] = await Promise.all([
    Races.find({ deletedAt: { $exists: false } })
      .populate("club", "name code abbr level location")
      .sort({ raceDate: -1, createdAt: -1 })
      .lean(),
    RaceEntries.find({ deletedAt: { $exists: false } })
      .select("race status arrival departure")
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
      latestArrival: null,
    };

    if (entry.status === "boarded") currentValue.boarded += 1;
    if (entry.status === "departed") currentValue.departed += 1;
    if (entry.status === "arrived") currentValue.arrived += 1;
    if (entry.status === "booked") currentValue.booked += 1;

    if (entry.arrival?.arrivedAt) {
      const currentArrivalTime = new Date(entry.arrival.arrivedAt).getTime();
      const existingArrivalTime = currentValue.latestArrival
        ? new Date(currentValue.latestArrival).getTime()
        : 0;

      if (currentArrivalTime > existingArrivalTime) {
        currentValue.latestArrival = entry.arrival.arrivedAt;
      }
    }

    entryCountByRace.set(raceId, currentValue);
  });

  return races.map((race) => {
    const counts = entryCountByRace.get(String(race._id)) || {
      arrived: 0,
      boarded: 0,
      booked: 0,
      departed: 0,
      latestArrival: null,
    };

    return {
      booked: counts.booked,
      club: buildClubSummary(race.club),
      deliveredAt: counts.latestArrival || undefined,
      departureSite: race.departure?.siteName || "Departure site pending",
      departed: counts.departed,
      departedAt: race.departure?.departedAt || undefined,
      externalKey: `race:${race._id}`,
      metadata: {
        raceId: String(race._id),
      },
      race: {
        code: race.code || "",
        name: race.name || "Unnamed race",
        race: race._id,
        raceDate: race.raceDate || undefined,
        status: normalizeStatusValue(race.status, "draft"),
      },
      received: counts.arrived,
      scheduledAt: race.raceDate || undefined,
      shipmentStatus: normalizeStatusValue(race.status, "draft"),
      staged: counts.boarded,
      trackingReference: race.code || createResourceCode("SHIP", race._id),
    };
  });
};

const buildSupportRows = async () => {
  const [clubs, pendingAffiliations, pendingProfiles, races] = await Promise.all([
    Clubs.find({ deletedAt: { $exists: false } })
      .select("name code abbr contactPerson email isActive status location level")
      .lean(),
    Affiliations.find({
      deletedAt: { $exists: false },
      status: "pending",
    })
      .populate("user", "fullName email mobile")
      .populate("club", "name code abbr level location")
      .lean({ virtuals: true }),
    Users.find({
      isActive: true,
      $or: [
        { "profile.status": "pending" },
        { "profile.status": { $exists: false } },
      ],
    })
      .select("fullName email mobile profile createdAt")
      .lean({ virtuals: true }),
    Races.find({
      deletedAt: { $exists: false },
      status: { $in: ["draft", "cancelled"] },
    })
      .select("name code status raceDate club")
      .populate("club", "name code abbr level location")
      .lean(),
  ]);

  const payload = [];

  clubs
    .filter((club) => !club.contactPerson || !club.email)
    .forEach((club) => {
      payload.push({
        club: buildClubSummary(club),
        detail: "Club contact person or email is still missing.",
        externalKey: `club:${club._id}`,
        metadata: {
          sourceEntity: "club",
          sourceId: String(club._id),
        },
        openedAt: null,
        severity: "amber",
        source: club.name || club.code || club.abbr || "Club",
        sourceType: "club",
        status: "open",
        title: "Directory needs seller support data",
      });
    });

  pendingAffiliations.forEach((affiliation) => {
    payload.push({
      club: buildClubSummary(affiliation.club),
      detail: `${buildFullName(
        affiliation.user?.fullName,
        affiliation.user?.email || "Unknown user",
      )} is still waiting for club approval.`,
      externalKey: `affiliation:${affiliation._id}`,
      metadata: {
        sourceEntity: "affiliation",
        sourceId: String(affiliation._id),
      },
      openedAt: affiliation.createdAt || undefined,
      owner: buildOwnerSummary(
        affiliation.user,
        affiliation.user?.email || "Unknown user",
      ),
      severity: "sky",
      source: buildClubName(affiliation.club),
      sourceType: "affiliation",
      status: "pending",
      title: "Membership approval waiting",
    });
  });

  pendingProfiles.forEach((user) => {
    payload.push({
      detail: "Profile verification is still pending final review.",
      externalKey: `profile:${user._id}`,
      metadata: {
        sourceEntity: "user",
        sourceId: String(user._id),
      },
      openedAt: user.createdAt || undefined,
      owner: buildOwnerSummary(user),
      severity: "amber",
      source: buildFullName(user.fullName, user.email || "Unknown user"),
      sourceType: "profile",
      status: normalizeStatusValue(user.profile?.status, "pending"),
      title: "Profile review pending",
    });
  });

  races.forEach((race) => {
    payload.push({
      club: buildClubSummary(race.club),
      detail: `${race.name || race.code || "Race"} is still ${normalizeStatusValue(
        race.status,
        "draft",
      )} on the backend.`,
      externalKey: `race:${race._id}`,
      metadata: {
        sourceEntity: "race",
        sourceId: String(race._id),
      },
      openedAt: race.raceDate || undefined,
      severity: race.status === "cancelled" ? "rose" : "violet",
      source: race.code || "Race",
      sourceType: "race",
      status: normalizeStatusValue(race.status, "draft"),
      title: "Race status needs attention",
    });
  });

  return payload;
};

const ensurePaymentsSeeded = () => seedDocuments(Payments, buildPaymentRows());
const ensurePayoutsSeeded = () => seedDocuments(Payouts, buildPayoutRows());
const ensureProductsSeeded = () => seedDocuments(Products, buildProductRows());
const ensureOrdersSeeded = () => seedDocuments(Orders, buildOrderRows());
const ensureSellersSeeded = () => seedDocuments(Sellers, buildSellerRows());
const ensureShipmentsSeeded = () => seedDocuments(Shipments, buildShipmentRows());
const ensureSupportSeeded = () =>
  seedDocuments(SupportTickets, buildSupportRows());

const createResourceHandlers = ({
  archivePatch,
  buildQuery,
  listLabel,
  lookupFields = [],
  Model,
  resourceLabel,
  seed,
  sort = { createdAt: -1 },
}) => ({
  create: async (req, res) => {
    try {
      const payloadData = { ...(req.body || {}) };
      delete payloadData.deletedAt;

      const created = await Model.create(payloadData);
      const payload = await Model.findById(created._id).lean({ virtuals: true });

      res.status(201).json({
        success: `${resourceLabel} created successfully`,
        payload,
      });
    } catch (error) {
      sendError(res, error);
    }
  },
  delete: async (req, res) => {
    try {
      const existing = await findActiveDocument(Model, req.params.id, lookupFields);

      if (!existing) {
        return res.status(404).json({ error: `${resourceLabel} not found` });
      }

      const nextArchivePatch =
        typeof archivePatch === "function" ? archivePatch(existing) : archivePatch || {};

      existing.set({
        ...nextArchivePatch,
        deletedAt: new Date().toISOString(),
      });
      await existing.save();

      const payload = await Model.findById(existing._id).lean({ virtuals: true });

      res.json({
        success: `${resourceLabel} archived successfully`,
        payload,
      });
    } catch (error) {
      sendError(res, error);
    }
  },
  findAll: async (req, res) => {
    try {
      if (seed) {
        await seed();
      }

      const payload = await Model.find(buildQuery(req.query))
        .sort(sort)
        .lean({ virtuals: true });

      res.json({ success: `${listLabel} fetched successfully`, payload });
    } catch (error) {
      sendError(res, error);
    }
  },
  findOne: async (req, res) => {
    try {
      if (seed) {
        await seed();
      }

      const payload = await findActiveDocument(Model, req.params.id, lookupFields);

      if (!payload) {
        return res.status(404).json({ error: `${resourceLabel} not found` });
      }

      res.json({
        success: `${resourceLabel} fetched successfully`,
        payload: payload.toObject({ virtuals: true }),
      });
    } catch (error) {
      sendError(res, error);
    }
  },
  update: async (req, res) => {
    try {
      const existing = await findActiveDocument(Model, req.params.id, lookupFields);

      if (!existing) {
        return res.status(404).json({ error: `${resourceLabel} not found` });
      }

      const payloadData = { ...(req.body || {}) };
      delete payloadData.deletedAt;

      existing.set(payloadData);
      await existing.save();

      const payload = await Model.findById(existing._id).lean({ virtuals: true });

      res.json({
        success: `${resourceLabel} updated successfully`,
        payload,
      });
    } catch (error) {
      sendError(res, error);
    }
  },
});

const paymentHandlers = createResourceHandlers({
  archivePatch: { status: "cancelled" },
  buildQuery: (query) =>
    buildListQuery({
      filters: [
        { field: "status", param: "status" },
        { field: "source", param: "source" },
        { field: "verification", param: "verification" },
        { field: "club.club", param: "clubId" },
        { field: "owner.user", param: "userId" },
        { field: "reference", param: "reference", partial: true },
      ],
      query,
      searchFields: [
        "reference",
        "owner.name",
        "owner.email",
        "club.name",
        "notes",
        "verification",
      ],
    }),
  listLabel: "Payments",
  lookupFields: ["externalKey", "reference"],
  Model: Payments,
  resourceLabel: "Payment",
  seed: ensurePaymentsSeeded,
  sort: { submittedAt: -1, createdAt: -1 },
});

const payoutHandlers = createResourceHandlers({
  archivePatch: { payoutStatus: "cancelled" },
  buildQuery: (query) =>
    buildListQuery({
      filters: [
        { field: "payoutStatus", param: "status" },
        { field: "race.race", param: "raceId" },
        { field: "club.club", param: "clubId" },
        { field: "rank", param: "rank", transform: toNumber },
      ],
      query,
      searchFields: [
        "payoutReference",
        "bird.name",
        "bird.bandNumber",
        "owner.name",
        "race.name",
        "race.code",
      ],
    }),
  listLabel: "Payouts",
  lookupFields: ["externalKey", "payoutReference"],
  Model: Payouts,
  resourceLabel: "Payout",
  seed: ensurePayoutsSeeded,
  sort: { rank: 1, recordedAt: -1, createdAt: -1 },
});

const productHandlers = createResourceHandlers({
  archivePatch: { status: "archived" },
  buildQuery: (query) =>
    buildListQuery({
      filters: [
        { field: "status", param: "status" },
        { field: "source", param: "source" },
        { field: "category", param: "category" },
        { field: "club.club", param: "clubId" },
        { field: "owner.user", param: "userId" },
        { field: "reference", param: "reference", partial: true },
      ],
      query,
      searchFields: [
        "name",
        "reference",
        "subtitle",
        "description",
        "club.name",
        "owner.name",
      ],
    }),
  listLabel: "Products",
  lookupFields: ["externalKey", "reference"],
  Model: Products,
  resourceLabel: "Product",
  seed: ensureProductsSeeded,
  sort: { createdAt: -1 },
});

const orderHandlers = createResourceHandlers({
  archivePatch: { status: "cancelled" },
  buildQuery: (query) =>
    buildListQuery({
      filters: [
        { field: "status", param: "status" },
        { field: "source", param: "source" },
        { field: "club.club", param: "clubId" },
        { field: "customer.user", param: "userId" },
        { field: "race.race", param: "raceId" },
        { field: "orderReference", param: "reference", partial: true },
      ],
      query,
      searchFields: [
        "orderReference",
        "item.name",
        "item.bandNumber",
        "customer.name",
        "customer.email",
        "race.name",
      ],
    }),
  listLabel: "Orders",
  lookupFields: ["externalKey", "orderReference"],
  Model: Orders,
  resourceLabel: "Order",
  seed: ensureOrdersSeeded,
  sort: { bookedAt: -1, createdAt: -1 },
});

const sellerHandlers = createResourceHandlers({
  archivePatch: { sellerStatus: "archived" },
  buildQuery: (query) =>
    buildListQuery({
      filters: [
        { field: "sellerStatus", param: "status" },
        { field: "level", param: "level" },
        { field: "club.club", param: "clubId" },
      ],
      query,
      searchFields: [
        "name",
        "contactPerson",
        "contactEmail",
        "location",
        "type",
      ],
    }),
  listLabel: "Sellers",
  lookupFields: ["externalKey", "name"],
  Model: Sellers,
  resourceLabel: "Seller",
  seed: ensureSellersSeeded,
  sort: { createdAt: -1 },
});

const shipmentHandlers = createResourceHandlers({
  archivePatch: { shipmentStatus: "cancelled" },
  buildQuery: (query) =>
    buildListQuery({
      filters: [
        { field: "shipmentStatus", param: "status" },
        { field: "race.race", param: "raceId" },
        { field: "club.club", param: "clubId" },
      ],
      query,
      searchFields: [
        "trackingReference",
        "race.name",
        "race.code",
        "departureSite",
        "club.name",
      ],
    }),
  listLabel: "Shipments",
  lookupFields: ["externalKey", "trackingReference", "race.code"],
  Model: Shipments,
  resourceLabel: "Shipment",
  seed: ensureShipmentsSeeded,
  sort: { scheduledAt: -1, createdAt: -1 },
});

const supportHandlers = createResourceHandlers({
  archivePatch: () => ({
    resolvedAt: new Date(),
    status: "closed",
  }),
  buildQuery: (query) =>
    buildListQuery({
      filters: [
        { field: "status", param: "status" },
        { field: "severity", param: "severity" },
        { field: "sourceType", param: "sourceType" },
        { field: "club.club", param: "clubId" },
        { field: "owner.user", param: "userId" },
      ],
      query,
      searchFields: ["title", "detail", "source", "owner.name", "club.name"],
    }),
  listLabel: "Support tickets",
  lookupFields: ["externalKey", "title"],
  Model: SupportTickets,
  resourceLabel: "Support ticket",
  seed: ensureSupportSeeded,
  sort: { openedAt: -1, createdAt: -1 },
});

export const createOrder = orderHandlers.create;
export const createPayment = paymentHandlers.create;
export const createPayout = payoutHandlers.create;
export const createProduct = productHandlers.create;
export const createSeller = sellerHandlers.create;
export const createShipment = shipmentHandlers.create;
export const createSupportTicket = supportHandlers.create;
export const deleteOrder = orderHandlers.delete;
export const deletePayment = paymentHandlers.delete;
export const deletePayout = payoutHandlers.delete;
export const deleteProduct = productHandlers.delete;
export const deleteSeller = sellerHandlers.delete;
export const deleteShipment = shipmentHandlers.delete;
export const deleteSupportTicket = supportHandlers.delete;
export const findOrder = orderHandlers.findOne;
export const findOrders = orderHandlers.findAll;
export const findPayment = paymentHandlers.findOne;
export const findPayments = paymentHandlers.findAll;
export const findPayout = payoutHandlers.findOne;
export const findPayouts = payoutHandlers.findAll;
export const findProduct = productHandlers.findOne;
export const findProducts = productHandlers.findAll;
export const findSeller = sellerHandlers.findOne;
export const findSellers = sellerHandlers.findAll;
export const findShipment = shipmentHandlers.findOne;
export const findShipments = shipmentHandlers.findAll;
export const findSupportTicket = supportHandlers.findOne;
export const findSupport = supportHandlers.findAll;
export const updateOrder = orderHandlers.update;
export const updatePayment = paymentHandlers.update;
export const updatePayout = payoutHandlers.update;
export const updateProduct = productHandlers.update;
export const updateSeller = sellerHandlers.update;
export const updateShipment = shipmentHandlers.update;
export const updateSupportTicket = supportHandlers.update;
