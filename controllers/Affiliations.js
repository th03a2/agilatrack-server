import Affiliations from "../models/Affiliations.js";
import Birds from "../models/Birds.js";
import Clubs from "../models/Clubs.js";
import Users from "../models/Users.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const CLUB_ROLE_LABELS = {
  "assistant-admin": "Assistant Admin",
  "club-officer": "Club Officer",
  "club-staff": "Club Staff",
  "race-participant": "Race Participant",
  "regular-member": "Regular Member",
};

const CLUB_ROLE_INPUTS = {
  "assistant admin": "assistant-admin",
  "assistant-admin": "assistant-admin",
  organizer: "assistant-admin",
  "club officer": "club-officer",
  "club-officer": "club-officer",
  officer: "club-officer",
  "club staff": "club-staff",
  "club-staff": "club-staff",
  staff: "club-staff",
  "race participant": "race-participant",
  "race-participant": "race-participant",
  racer: "race-participant",
  "regular member": "regular-member",
  "regular-member": "regular-member",
  regular: "regular-member",
};

const normalizeText = (value = "") => String(value || "").trim();
const normalizeFlag = (value = "") => normalizeText(value).toLowerCase();
const encodePathSegment = (value = "") =>
  normalizeFlag(value)
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
const formatWords = (value = "") =>
  normalizeText(value)
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ") || "Unknown";
const formatDateLabel = (value) => {
  if (!value) return "Not set";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};
const getInitials = (value = "") =>
  normalizeText(value)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "AT";
const getUserDisplayName = (user = {}) => {
  const fullName = [user?.fullName?.fname, user?.fullName?.mname, user?.fullName?.lname]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return fullName || normalizeText(user?.name) || normalizeText(user?.email) || "Unknown User";
};
const getCloudinaryCloudName = () =>
  normalizeText(process.env.CLOUDINARY_CLOUD_NAME);
const getProfilePhotoVersion = (user = {}) => {
  const rawVersion = normalizeText(user?.pid || user?.files?.profile);
  if (!rawVersion) return "";

  if (/^v\d+$/i.test(rawVersion)) return rawVersion;
  if (/^\d+$/.test(rawVersion)) return `v${rawVersion}`;

  return "";
};
const buildProfilePhotoUrl = (user = {}) => {
  const cloudName = getCloudinaryCloudName();
  const version = getProfilePhotoVersion(user);
  const emailKey = encodePathSegment(user?.email);

  if (!cloudName || !version || !emailKey) {
    return "";
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/${version}/users/${emailKey}/profile`;
};
const formatClubLocation = (club = {}) =>
  [
    club?.location?.municipality,
    club?.location?.city,
    club?.location?.province,
    club?.location?.region,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(", ") || "Location not set";
const normalizeClubRole = (value = "") =>
  CLUB_ROLE_INPUTS[normalizeFlag(value)] || "race-participant";
const getClubRoleLabel = (value = "") =>
  CLUB_ROLE_LABELS[normalizeClubRole(value)] || "Race Participant";
const getAffiliationRoleLabel = (affiliation = {}) =>
  getClubRoleLabel(affiliation?.roles?.[0] || affiliation?.membershipType || "racer");
const getPendingRequestStatusLabel = (status = "") => {
  const normalized = normalizeFlag(status);

  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "deactivated") return "Deactivated";

  return "Pending";
};
const getMemberStatusLabel = (affiliation = {}) => {
  if (normalizeFlag(affiliation?.status) === "deactivated") {
    return "Suspended";
  }

  const approvedAt = affiliation?.approval?.approvedAt || affiliation?.createdAt;
  const approvedTime = new Date(approvedAt || 0).getTime();
  const thirtyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;

  if (approvedTime && approvedTime >= thirtyDaysAgo) {
    return "Probationary";
  }

  return "Active";
};
const formatHistoryEntry = (affiliation = {}) => {
  const clubName =
    normalizeText(affiliation?.club?.name) ||
    normalizeText(affiliation?.club?.abbr) ||
    "Club";

  return `${clubName} - ${formatWords(affiliation?.status || "pending")}`;
};
const buildClubHistoryMap = (records = []) =>
  records.reduce((map, record) => {
    const userId = String(record?.user || "");
    if (!userId) return map;

    const existing = map.get(userId) || [];
    existing.push(record);
    map.set(userId, existing);
    return map;
  }, new Map());
const buildBirdMap = (records = []) =>
  records.reduce((map, record) => {
    const ownerId = String(record?.owner || "");
    if (!ownerId) return map;

    const existing = map.get(ownerId) || [];
    existing.push(record);
    map.set(ownerId, existing);
    return map;
  }, new Map());
const sortMemberRows = (rows = []) =>
  [...rows].sort((left, right) => {
    const statusOrder = {
      Active: 0,
      Probationary: 1,
      Suspended: 2,
    };

    const statusRank =
      (statusOrder[left.status] ?? 99) - (statusOrder[right.status] ?? 99);
    if (statusRank !== 0) return statusRank;

    return left.memberName.localeCompare(right.memberName);
  });

const buildDashboardPayload = async (clubId) => {
  const club = await Clubs.findById(clubId)
    .select("name abbr code level location message logo")
    .lean();

  if (!club) {
    return null;
  }

  const affiliationRecords = await Affiliations.find({
    club: clubId,
    deletedAt: { $exists: false },
    status: { $in: ["pending", "approved", "rejected", "deactivated"] },
  })
    .populate("user", "fullName name email mobile pid files profile isEmailVerified")
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });

  const clubUserIds = [
    ...new Set(
      affiliationRecords
        .map((record) => String(record?.user?._id || record?.user || ""))
        .filter(Boolean),
    ),
  ];

  const [birdRecords, historyRecords, activeBirdsRegistered] = await Promise.all([
    clubUserIds.length
      ? Birds.find({
          club: clubId,
          owner: { $in: clubUserIds },
          deletedAt: { $exists: false },
        })
          .select("owner bandNumber name status")
          .sort({ createdAt: -1 })
          .lean()
      : [],
    clubUserIds.length
      ? Affiliations.find({
          user: { $in: clubUserIds },
          deletedAt: { $exists: false },
        })
          .populate("club", "name abbr")
          .select("user club status")
          .sort({ createdAt: -1 })
          .lean()
      : [],
    Birds.countDocuments({
      club: clubId,
      deletedAt: { $exists: false },
      status: { $in: ["active", "training", "breeding"] },
    }),
  ]);

  const birdMap = buildBirdMap(birdRecords);
  const historyMap = buildClubHistoryMap(historyRecords);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const pendingRequests = affiliationRecords
    .filter((record) => normalizeFlag(record?.status) === "pending")
    .map((record) => {
      const userId = String(record?.user?._id || "");
      const userName = getUserDisplayName(record?.user);
      const profileStatus = normalizeFlag(record?.user?.profile?.status || "pending") || "pending";
      const userBirds = (birdMap.get(userId) || []).slice(0, 5);
      const userHistory = (historyMap.get(userId) || [])
        .filter((entry) => String(entry?._id || "") !== String(record?._id || ""))
        .slice(0, 5);

      return {
        id: String(record?._id || ""),
        profilePhotoUrl: buildProfilePhotoUrl(record?.user),
        profileInitials: getInitials(userName),
        fullName: userName,
        email: normalizeText(record?.user?.email),
        contactNumber: normalizeText(record?.mobile || record?.user?.mobile),
        clubRequested: normalizeText(club.name || club.abbr || club.code),
        dateApplied: formatDateLabel(record?.approval?.requestedAt || record?.createdAt),
        status: getPendingRequestStatusLabel(record?.status),
        address: formatClubLocation({ location: record?.user?.address || {} }),
        validIdImage: normalizeText(record?.application?.validIdImage),
        existingBirdRecords: userBirds.map((bird) =>
          [normalizeText(bird?.name), normalizeText(bird?.bandNumber)]
            .filter(Boolean)
            .join(" - "),
        ),
        clubHistory: userHistory.map(formatHistoryEntry),
        membershipType: getClubRoleLabel(record?.membershipType),
        verificationStatus: `Profile ${formatWords(profileStatus)}`,
        preferredRole: getAffiliationRoleLabel(record),
        application: {
          loftName: normalizeText(record?.application?.loftName),
          birdOwnerType: normalizeText(record?.application?.birdOwnerType),
          reasonForJoining: normalizeText(record?.application?.reasonForJoining),
          validIdImage: normalizeText(record?.application?.validIdImage),
        },
        profileStatus,
      };
    });

  const members = sortMemberRows(
    affiliationRecords
      .filter((record) => {
        const status = normalizeFlag(record?.status);
        return status === "approved" || status === "deactivated";
      })
      .map((record) => {
        const userName = getUserDisplayName(record?.user);

        return {
          id: String(record?._id || ""),
          memberName: userName,
          profilePhotoUrl: buildProfilePhotoUrl(record?.user),
          profileInitials: getInitials(userName),
          email: normalizeText(record?.user?.email),
          contactNumber: normalizeText(record?.mobile || record?.user?.mobile),
          role: getAffiliationRoleLabel(record),
          status: getMemberStatusLabel(record),
          joinDate: formatDateLabel(record?.approval?.approvedAt || record?.createdAt),
        };
      }),
  );

  return {
    club: {
      id: String(club?._id || ""),
      name: normalizeText(club?.name),
      abbr: normalizeText(club?.abbr || club?.code),
      level: formatWords(club?.level),
      location: formatClubLocation(club),
      message: normalizeText(club?.message),
      clubLogo: normalizeText(club?.logo?.url),
    },
    overview: {
      totalMembers: affiliationRecords.filter(
        (record) => normalizeFlag(record?.status) === "approved",
      ).length,
      pendingJoinRequests: pendingRequests.length,
      activeBirdsRegistered,
      clubAnnouncements: normalizeText(club?.message) ? 1 : 0,
      newRegistrationsThisMonth: affiliationRecords.filter((record) => {
        const createdAt = new Date(record?.createdAt || 0).getTime();
        return createdAt >= startOfMonth.getTime();
      }).length,
    },
    pendingRequests,
    members,
  };
};

const populateAffiliation = (query) =>
  query
    .populate("user", "fullName email mobile pid isMale address")
    .populate({
      path: "club",
      select:
        "name code abbr level type location parent lid bid social logo management",
      populate: [
        {
          path: "parent",
          select: "name code abbr level type location",
        },
        {
          path: "management.secretary.user",
          select: "fullName email mobile pid isMale",
        },
      ],
    })
    .populate("primaryLoft", "name code coordinates address status")
    .populate("lofts", "name code coordinates address status");

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

export const findAll = async (req, res) => {
  try {
    const payload = await populateAffiliation(
      Affiliations.find(buildAffiliationQuery(req.query)),
    )
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Affiliations fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const getClubDashboard = async (req, res) => {
  try {
    const payload = await buildDashboardPayload(req.params.clubId);

    if (!payload) {
      return res.status(404).json({ error: "Club not found" });
    }

    return res.json({
      success: "Club dashboard fetched successfully",
      payload,
    });
  } catch (error) {
    return sendError(res, error, 500);
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

    res.json({ success: "Affiliation fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createAffiliation = async (req, res) => {
  try {
    const applicant = await Users.findById(req.body?.user)
      .select("pid files.profile")
      .lean();

    const hasProfilePhoto = Boolean(
      applicant?.pid || applicant?.files?.profile,
    );

    if (!hasProfilePhoto) {
      return res.status(400).json({
        error:
          "Profile photo is required before submitting a club application.",
      });
    }

    const created = await Affiliations.create(req.body);
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

export const approveAffiliation = async (req, res) => {
  try {
    const affiliation = await Affiliations.findOne({
      _id: req.params.id,
      deletedAt: { $exists: false },
    });

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    affiliation.status = "approved";
    affiliation.approval = {
      ...(affiliation.approval?.toObject?.() || affiliation.approval || {}),
      approvedAt: new Date(),
      ...(normalizeText(req.body?.actorId) ? { approvedBy: req.body.actorId } : {}),
      rejectedAt: undefined,
      rejectedBy: undefined,
      reason: "",
    };

    if (!Array.isArray(affiliation.roles) || !affiliation.roles.length) {
      affiliation.roles = [normalizeClubRole(affiliation.membershipType || "racer")];
    }

    await affiliation.save();

    const payload = await buildDashboardPayload(affiliation.club);

    return res.json({
      success: "Affiliation approved successfully",
      payload,
    });
  } catch (error) {
    return sendError(res, error, 500);
  }
};

export const rejectAffiliation = async (req, res) => {
  try {
    const affiliation = await Affiliations.findOne({
      _id: req.params.id,
      deletedAt: { $exists: false },
    });

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    const reason = normalizeText(req.body?.reason);

    affiliation.status = "rejected";
    affiliation.approval = {
      ...(affiliation.approval?.toObject?.() || affiliation.approval || {}),
      rejectedAt: new Date(),
      ...(normalizeText(req.body?.actorId) ? { rejectedBy: req.body.actorId } : {}),
      ...(reason ? { reason } : {}),
    };

    await affiliation.save();

    const payload = await buildDashboardPayload(affiliation.club);

    return res.json({
      success: "Affiliation rejected successfully",
      payload,
    });
  } catch (error) {
    return sendError(res, error, 500);
  }
};

export const assignAffiliationRole = async (req, res) => {
  try {
    const roleInput = normalizeText(req.body?.role);

    if (!roleInput || !CLUB_ROLE_INPUTS[normalizeFlag(roleInput)]) {
      return res.status(400).json({ error: "A valid club role is required." });
    }

    const affiliation = await Affiliations.findOne({
      _id: req.params.id,
      deletedAt: { $exists: false },
    });

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    affiliation.roles = [normalizeClubRole(roleInput)];
    await affiliation.save();

    const payload = await buildDashboardPayload(affiliation.club);

    return res.json({
      success: "Affiliation role updated successfully",
      payload,
    });
  } catch (error) {
    return sendError(res, error, 500);
  }
};

export const updateAffiliation = async (req, res) => {
  try {
    const affiliation = await Affiliations.findById(req.params.id);

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    const rejectionReason = String(req.body?.approval?.reason || "").trim();
    const isRejectedUpdate = String(req.body?.status || "").trim() === "rejected";

    affiliation.set(req.body);

    if (isRejectedUpdate && rejectionReason) {
      const existingRemarks = Array.isArray(affiliation.remarks)
        ? affiliation.remarks
        : [];
      const nextRemark = `Declined: ${rejectionReason}`;

      if (!existingRemarks.includes(nextRemark)) {
        affiliation.remarks = [...existingRemarks, nextRemark];
      }
    }

    await affiliation.save();

    const payload = await populateAffiliation(
      Affiliations.findById(affiliation._id),
    ).lean({ virtuals: true });

    res.json({ success: "Affiliation updated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteAffiliation = async (req, res) => {
  try {
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

    if (!payload) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    res.json({ success: "Affiliation archived successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
