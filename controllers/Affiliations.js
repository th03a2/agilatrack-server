import mongoose from "mongoose";
import {
  ensureOwnerOrClubManager,
  hasClubManagementAccess,
} from "../middleware/auth.js";
import Affiliations from "../models/Affiliations.js";
import Pigeons from "../models/Pigeons.js";
import Clubs from "../models/Clubs.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });
const SELF_AFFILIATION_FIELDS = ["application", "lofts", "mobile", "primaryLoft", "remarks"];

const populateAffiliation = (query) =>
  query
    .populate("user", "fullName email mobile pid profilePhoto validIdImage address profile isMale")
    .populate("club", "name code abbr level location clubLogo message")
    .populate("primaryLoft", "name code coordinates address status")
    .populate("lofts", "name code coordinates address status");

const rolePresets = {
  "regular member": {
    membershipType: "racer",
    roles: [2],
    label: "Regular Member",
  },
  "race participant": {
    membershipType: "racer",
    roles: [2],
    label: "Race Participant",
  },
  "club staff": {
    membershipType: "staff",
    roles: [74],
    label: "Club Staff",
  },
  "assistant admin": {
    membershipType: "organizer",
    roles: [20],
    label: "Assistant Admin",
  },
  "club officer": {
    membershipType: "officer",
    roles: [10],
    label: "Club Officer",
  },
};

const membershipTypeLabel = {
  racer: "Race Participant",
  officer: "Club Officer",
  organizer: "Assistant Admin",
  staff: "Club Staff",
};

const roleLabelById = {
  2: "Regular Member",
  10: "Club Officer",
  20: "Assistant Admin",
  74: "Club Staff",
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
      })
    : "";

const buildFullName = (fullName = {}) =>
  [
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

const buildAddress = (address = {}) =>
  [
    address.hn,
    address.street,
    address.purok,
    address.sitio,
    address.subdivision,
    address.block,
    address.lot,
    address.barangay,
    address.city,
    address.province,
    address.region,
    address.zip,
  ]
    .filter(Boolean)
    .join(", ");

const getProfileInitials = (fullName = {}) =>
  [fullName.fname, fullName.lname]
    .filter(Boolean)
    .map((value) => String(value).trim().charAt(0).toUpperCase())
    .join("") || "AT";

const getRoleLabel = (affiliation = {}) => {
  const numericRole = affiliation.roles?.find((role) => roleLabelById[Number(role)]);

  if (numericRole !== undefined) {
    return roleLabelById[Number(numericRole)];
  }

  return membershipTypeLabel[affiliation.membershipType] || "Regular Member";
};

const toRequestStatusLabel = (status = "") => {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "deactivated") return "Deactivated";
  return "Pending";
};

const toMemberStatusLabel = (status = "") => {
  if (status === "approved") return "Active";
  if (status === "deactivated") return "Suspended";
  return "Probationary";
};

const getVerificationStatus = (user = {}) => {
  if (user?.profile?.status === "approved") {
    return "Profile approved";
  }

  if (user?.validIdImage) {
    return "Email verified and valid ID uploaded";
  }

  return "Profile verification pending";
};

const serializeClubHistory = (entries = []) =>
  entries.map((entry) => {
    const clubName = entry.club?.name || entry.club?.abbr || "Unknown club";
    const status = toRequestStatusLabel(entry.status);
    const dateLabel = formatDate(entry.createdAt);

    return `${clubName} | ${status}${dateLabel ? ` | ${dateLabel}` : ""}`;
  });

const buildAffiliationQuery = (query = {}) => {
  const {
    user,
    club,
    status,
    mobile,
    memberCode,
    membershipType,
    role,
    primaryLoft,
  } = query;
  const dbQuery = { deletedAt: { $exists: false } };

  if (user) dbQuery.user = user;
  if (club) dbQuery.club = club;
  if (status) dbQuery.status = status;
  if (mobile) dbQuery.mobile = { $regex: mobile, $options: "i" };
  if (memberCode) dbQuery.memberCode = { $regex: memberCode, $options: "i" };
  if (membershipType) dbQuery.membershipType = membershipType;
  if (role) dbQuery.roles = role;
  if (primaryLoft) dbQuery.primaryLoft = primaryLoft;

  return dbQuery;
};

const pickAllowedSelfAffiliationUpdates = (payload = {}) =>
  SELF_AFFILIATION_FIELDS.reduce((accumulator, field) => {
    if (payload[field] !== undefined) {
      accumulator[field] = payload[field];
    }

    return accumulator;
  }, {});

const validateClubId = (clubId) => {
  if (!mongoose.Types.ObjectId.isValid(clubId)) {
    throw new Error("Club id is invalid.");
  }
};

const buildAdminDashboardPayload = async (clubId) => {
  validateClubId(clubId);

  const club = await Clubs.findById(clubId)
    .select("name abbr level location clubLogo message")
    .lean();

  if (!club) {
    throw new Error("Club not found.");
  }

  const affiliations = await populateAffiliation(
    Affiliations.find({
      club: clubId,
      deletedAt: { $exists: false },
    }),
  )
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });

  const userIds = affiliations.map((entry) => entry.user?._id).filter(Boolean);

  const [birdCounts, userHistory] = await Promise.all([
    Pigeons.aggregate([
      {
        $match: {
          club: new mongoose.Types.ObjectId(clubId),
          deletedAt: { $exists: false },
        },
      },
      {
        $group: {
          _id: "$owner",
          total: { $sum: 1 },
        },
      },
    ]),
    populateAffiliation(
      Affiliations.find({
        user: { $in: userIds },
        deletedAt: { $exists: false },
      }),
    ).lean({ virtuals: true }),
  ]);

  const birdCountMap = new Map(
    birdCounts.map((entry) => [String(entry._id), entry.total]),
  );
  const historyMap = new Map();

  userHistory.forEach((entry) => {
    const key = String(entry.user?._id || "");
    const current = historyMap.get(key) || [];
    current.push(entry);
    historyMap.set(key, current);
  });

  const pendingRequests = affiliations
    .filter((entry) => entry.status === "pending")
    .map((entry) => {
      const fullName = buildFullName(entry.user?.fullName) || entry.user?.email || "Unknown user";
      const totalBirds = birdCountMap.get(String(entry.user?._id || "")) || 0;
      const history = (historyMap.get(String(entry.user?._id || "")) || []).filter(
        (historyEntry) => String(historyEntry._id) !== String(entry._id),
      );

      return {
        id: String(entry._id),
        profilePhotoUrl: entry.user?.profilePhoto || "",
        profileInitials: getProfileInitials(entry.user?.fullName),
        fullName,
        email: entry.user?.email || "",
        contactNumber: entry.mobile || entry.user?.mobile || "",
        clubRequested: entry.club?.name || entry.club?.abbr || club.name,
        dateApplied: formatDate(entry.approval?.requestedAt || entry.createdAt),
        status: toRequestStatusLabel(entry.status),
        address: buildAddress(entry.user?.address),
        validIdImage: entry.application?.validIdImage || entry.user?.validIdImage || "",
        existingBirdRecords: [
          totalBirds > 0
            ? `${totalBirds} active birds registered`
            : "No bird records linked yet",
        ],
        clubHistory: serializeClubHistory(history),
        membershipType: membershipTypeLabel[entry.membershipType] || entry.membershipType || "Regular Member",
        verificationStatus: getVerificationStatus(entry.user),
        preferredRole: getRoleLabel(entry),
        application: {
          loftName: entry.application?.loftName || "",
          birdOwnerType: entry.application?.birdOwnerType || "",
          reasonForJoining: entry.application?.reasonForJoining || "",
          validIdImage: entry.application?.validIdImage || entry.user?.validIdImage || "",
        },
        profileStatus: entry.user?.profile?.status || "pending",
      };
    });

  const approvedMembers = affiliations
    .filter((entry) => entry.status === "approved")
    .map((entry) => ({
      id: String(entry._id),
      memberName:
        buildFullName(entry.user?.fullName) || entry.user?.email || "Unknown user",
      profilePhotoUrl: entry.user?.profilePhoto || "",
      profileInitials: getProfileInitials(entry.user?.fullName),
      email: entry.user?.email || "",
      contactNumber: entry.mobile || entry.user?.mobile || "",
      role: getRoleLabel(entry),
      status: toMemberStatusLabel(entry.status),
      joinDate: formatDate(entry.approval?.approvedAt || entry.createdAt),
    }));

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    club: {
      id: String(club._id),
      name: club.name,
      abbr: club.abbr || "",
      level: club.level || "",
      message: club.message || "",
      clubLogo: club.clubLogo || "",
      location: [
        club.location?.municipality,
        club.location?.province,
        club.location?.region,
      ]
        .filter(Boolean)
        .join(", "),
    },
    overview: {
      totalMembers: approvedMembers.length,
      pendingJoinRequests: affiliations.filter((entry) => entry.status === "pending").length,
      activeBirdsRegistered: birdCounts.reduce((total, entry) => total + Number(entry.total || 0), 0),
      clubAnnouncements: club.message ? 1 : 0,
      newRegistrationsThisMonth: affiliations.filter(
        (entry) => new Date(entry.createdAt) >= startOfMonth,
      ).length,
    },
    pendingRequests,
    members: approvedMembers,
  };
};

export const findAll = async (req, res) => {
  try {
    const query = buildAffiliationQuery(req.query);

    if (!hasClubManagementAccess(req.auth)) {
      query.user = req.auth.user._id;
    }

    const payload = await populateAffiliation(
      Affiliations.find(query),
    )
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Affiliations fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findClubDashboard = async (req, res) => {
  try {
    const payload = await buildAdminDashboardPayload(req.params.clubId);
    res.json({ success: "Club membership dashboard fetched successfully", payload });
  } catch (error) {
    sendError(res, error, error.message === "Club not found." ? 404 : 400);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await populateAffiliation(
      Affiliations.findById(req.params.id),
    ).lean({ virtuals: true });

    if (!payload) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    if (!hasClubManagementAccess(req.auth)) {
      ensureOwnerOrClubManager(payload.user?._id, req.auth);
    }

    res.json({ success: "Affiliation fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createAffiliation = async (req, res) => {
  try {
    const isManager = hasClubManagementAccess(req.auth);
    const requesterId = req.auth.user._id;
    const requestedUserId = req.body?.user || requesterId;

    if (!isManager) {
      ensureOwnerOrClubManager(requestedUserId, req.auth);
    }

    const created = await Affiliations.create({
      ...req.body,
      user: requestedUserId,
    });
    const payload = await populateAffiliation(
      Affiliations.findById(created._id),
    ).lean({ virtuals: true });

    res.status(201).json({
      success: "Affiliation created successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateAffiliation = async (req, res) => {
  try {
    const affiliation = await Affiliations.findById(req.params.id);

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    const isManager = hasClubManagementAccess(req.auth);
    ensureOwnerOrClubManager(affiliation.user, req.auth);

    const nextPayload = isManager
      ? req.body
      : pickAllowedSelfAffiliationUpdates(req.body);

    if (!Object.keys(nextPayload || {}).length) {
      return res.status(400).json({ error: "No allowed affiliation fields were provided." });
    }

    affiliation.set(nextPayload);
    await affiliation.save();

    const payload = await populateAffiliation(
      Affiliations.findById(affiliation._id),
    ).lean({ virtuals: true });

    res.json({ success: "Affiliation updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const approveAffiliation = async (req, res) => {
  try {
    const affiliation = await Affiliations.findById(req.params.id);

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    affiliation.status = "approved";
    affiliation.approval = {
      ...(affiliation.approval || {}),
      approvedAt: new Date(),
      approvedBy: req.auth.user._id,
      reason: req.body?.reason || affiliation.approval?.reason,
    };

    await affiliation.save();

    const payload = await populateAffiliation(
      Affiliations.findById(affiliation._id),
    ).lean({ virtuals: true });

    res.json({ success: "Affiliation approved successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const rejectAffiliation = async (req, res) => {
  try {
    const affiliation = await Affiliations.findById(req.params.id);

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    affiliation.status = "rejected";
    affiliation.approval = {
      ...(affiliation.approval || {}),
      rejectedAt: new Date(),
      rejectedBy: req.auth.user._id,
      reason: req.body?.reason || affiliation.approval?.reason,
    };

    await affiliation.save();

    const payload = await populateAffiliation(
      Affiliations.findById(affiliation._id),
    ).lean({ virtuals: true });

    res.json({ success: "Affiliation rejected successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const assignAffiliationRole = async (req, res) => {
  try {
    const roleLabel = String(req.body?.role || "").trim().toLowerCase();
    const preset = rolePresets[roleLabel];

    if (!preset) {
      return res.status(400).json({ error: "Selected role is invalid." });
    }

    const affiliation = await Affiliations.findById(req.params.id);

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    affiliation.membershipType = preset.membershipType;
    affiliation.roles = preset.roles;

    await affiliation.save();

    const payload = await populateAffiliation(
      Affiliations.findById(affiliation._id),
    ).lean({ virtuals: true });

    res.json({
      success: `Affiliation role updated to ${preset.label}`,
      payload,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteAffiliation = async (req, res) => {
  try {
    const existing = await Affiliations.findById(req.params.id).select("user");

    if (!existing) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    ensureOwnerOrClubManager(existing.user, req.auth);

    const payload = await populateAffiliation(
      Affiliations.findByIdAndUpdate(
        req.params.id,
        {
          deletedAt: new Date().toISOString(),
          status: "deactivated",
        },
        { new: true },
      ),
    ).lean({ virtuals: true });

    res.json({ success: "Affiliation archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
