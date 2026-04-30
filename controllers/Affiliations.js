import Affiliations from "../models/Affiliations.js";
import Birds from "../models/Birds.js";
import Clubs from "../models/Clubs.js";
import Users from "../models/Users.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

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

const formatPersonName = (fullName = {}, fallback = "") => {
  const parts = [
    fullName?.fname,
    fullName?.mname,
    fullName?.lname,
    fullName?.suffix,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  return parts.join(" ").trim() || fallback;
};

const formatLocation = (club = {}) =>
  [
    club?.location?.municipality,
    club?.location?.province,
    club?.location?.region,
  ]
    .filter(Boolean)
    .join(", ");

const formatDateLabel = (value) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
};

const normalizeRoleValue = (value = "") => {
  const normalized = String(value).trim().toLowerCase();

  const roleMap = {
    racer: "Race Participant",
    "race participant": "Race Participant",
    regular: "Regular Member",
    member: "Regular Member",
    "regular member": "Regular Member",
    staff: "Club Staff",
    "club staff": "Club Staff",
    organizer: "Assistant Admin",
    "assistant admin": "Assistant Admin",
    officer: "Club Officer",
    "club officer": "Club Officer",
  };

  return roleMap[normalized] || "Regular Member";
};

const normalizeMemberStatus = (value = "") => {
  const normalized = String(value).trim().toLowerCase();

  if (normalized === "approved") return "Active";
  if (normalized === "deactivated") return "Suspended";
  return "Probationary";
};

const resolveImageValue = (...values) => {
  const match = values.find((value) => typeof value === "string" && /^https?:\/\//i.test(value.trim()));
  return match ? match.trim() : "";
};

const buildClubDashboardPayload = async (clubId) => {
  const club = await Clubs.findById(clubId)
    .select("name abbr level location message logo")
    .lean();

  if (!club) {
    const error = new Error("Club not found");
    error.statusCode = 404;
    throw error;
  }

  const affiliations = await populateAffiliation(
    Affiliations.find({
      club: clubId,
      deletedAt: { $exists: false },
    }),
  )
    .sort({ createdAt: -1 })
    .lean({ virtuals: true });

  const activeBirdsRegistered = await Birds.countDocuments({
    club: clubId,
    deletedAt: { $exists: false },
    status: { $in: ["active", "breeding", "training"] },
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const pendingRequests = affiliations
    .filter((affiliation) => affiliation.status === "pending")
    .map((affiliation) => {
      const user = affiliation.user || {};
      const userName = formatPersonName(user.fullName, user.email || "Applicant");
      const requestedRole = normalizeRoleValue(
        affiliation.roles?.[0] || affiliation.membershipType,
      );

      return {
        id: String(affiliation._id),
        profilePhotoUrl: resolveImageValue(user.profilePhoto, user.pid, user.files?.profile),
        profileInitials: userName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join(""),
        fullName: userName,
        email: String(user.email || ""),
        contactNumber: String(affiliation.mobile || user.mobile || ""),
        clubRequested: club.name || club.abbr || "Club",
        dateApplied: formatDateLabel(affiliation.approval?.requestedAt || affiliation.createdAt),
        status: "Pending",
        address:
          [
            user.address?.street,
            user.address?.barangay,
            user.address?.city,
            user.address?.province,
            user.address?.region,
          ]
            .filter(Boolean)
            .join(", ") || "No address submitted",
        validIdImage: resolveImageValue(user.validIdImage, user.files?.application),
        existingBirdRecords: [],
        clubHistory: [],
        membershipType: normalizeRoleValue(affiliation.membershipType || affiliation.roles?.[0]),
        verificationStatus: String(user.profile?.status || "pending"),
        preferredRole: requestedRole,
        application: {
          loftName: String(affiliation.primaryLoft?.name || ""),
          birdOwnerType: String(affiliation.membershipType || ""),
          reasonForJoining: String(affiliation.approval?.reason || ""),
          validIdImage: resolveImageValue(user.validIdImage, user.files?.application),
        },
        profileStatus: String(user.profile?.status || "pending"),
      };
    });

  const members = affiliations
    .filter((affiliation) => affiliation.status === "approved" || affiliation.status === "deactivated")
    .map((affiliation) => {
      const user = affiliation.user || {};
      const memberName = formatPersonName(user.fullName, user.email || "Member");

      return {
        id: String(affiliation._id),
        memberName,
        profilePhotoUrl: resolveImageValue(user.profilePhoto, user.pid, user.files?.profile),
        profileInitials: memberName
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join(""),
        email: String(user.email || ""),
        contactNumber: String(affiliation.mobile || user.mobile || ""),
        role: normalizeRoleValue(affiliation.roles?.[0] || affiliation.membershipType),
        status: normalizeMemberStatus(affiliation.status),
        joinDate: formatDateLabel(
          affiliation.approval?.approvedAt || affiliation.createdAt,
        ),
      };
    });

  return {
    club: {
      id: String(club._id),
      name: String(club.name || ""),
      abbr: String(club.abbr || ""),
      level: String(club.level || ""),
      location: formatLocation(club),
      message: String(club.message || ""),
      clubLogo: String(club.logo?.url || ""),
    },
    overview: {
      totalMembers: members.filter((member) => member.status === "Active").length,
      pendingJoinRequests: pendingRequests.length,
      activeBirdsRegistered,
      clubAnnouncements: 0,
      newRegistrationsThisMonth: affiliations.filter(
        (affiliation) => new Date(affiliation.createdAt) >= monthStart,
      ).length,
    },
    pendingRequests,
    members,
  };
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
    const payload = await buildClubDashboardPayload(req.params.clubId);

    res.json({
      success: "Club membership dashboard fetched successfully",
      payload,
    });
  } catch (error) {
    sendError(res, error, error.statusCode || 400);
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

export const approveAffiliation = async (req, res) => {
  try {
    const affiliation = await Affiliations.findById(req.params.id);

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    affiliation.status = "approved";
    affiliation.approval = {
      ...(affiliation.approval?.toObject?.() || affiliation.approval || {}),
      approvedAt: new Date(),
      approvedBy: req.body?.actorId || affiliation.approval?.approvedBy,
      rejectedAt: undefined,
      rejectedBy: undefined,
      reason: "",
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
      ...(affiliation.approval?.toObject?.() || affiliation.approval || {}),
      rejectedAt: new Date(),
      rejectedBy: req.body?.actorId || affiliation.approval?.rejectedBy,
      reason: String(req.body?.reason || affiliation.approval?.reason || "").trim(),
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
    const affiliation = await Affiliations.findById(req.params.id);

    if (!affiliation) {
      return res.status(404).json({ error: "Affiliation not found" });
    }

    const nextRole = String(req.body?.role || "").trim().toLowerCase();

    if (!nextRole) {
      return res.status(400).json({ error: "Role is required" });
    }

    affiliation.roles = [nextRole];
    await affiliation.save();

    const payload = await populateAffiliation(
      Affiliations.findById(affiliation._id),
    ).lean({ virtuals: true });

    res.json({ success: "Affiliation role updated successfully", payload });
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
