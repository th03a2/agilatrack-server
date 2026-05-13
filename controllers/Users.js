import Affiliations from "../models/Affiliations.js";
import Users from "../models/Users.js";
import {
  hasPrivilegedDirectoryAccess,
} from "../middleware/sessionAuth.js";
import {
  denyTenantAccess,
  getAccessibleClubIds,
  getPrimaryTenantClubId,
  isTenantSuperAdmin,
  normalizeTenantId,
} from "../middleware/tenantIsolation.js";
import { listUsers } from "../services/userService.js";
import { validateNickname as validateNicknameUtil, normalizeNickname } from "../utils/nicknameHelper.js";

const USER_SELECT = "-password -__v";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_PATTERN = /^[a-z0-9._-]{4,32}$/i;
const MOBILE_PATTERN = /^[+]?[\d\s()/-]{7,24}$/;

const normalizeText = (value = "") => String(value || "").trim();

const isProfileComplete = (user = {}) => {
  const fullName = user?.fullName?.toObject?.() || user?.fullName || {};

  return Boolean(
    normalizeText(fullName.fname) &&
      normalizeText(fullName.lname) &&
      normalizeText(user.email) &&
      normalizeText(user.mobile),
  );
};

const encodePathSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const buildProfilePhotoUrl = (user = {}) => {
  const storedUrl = normalizeText(user?.profilePhoto);

  if (storedUrl) {
    return storedUrl;
  }

  const version = normalizeText(user?.pid || user?.files?.profile);
  const email = normalizeText(user?.email);
  const cloudName = normalizeText(process.env.CLOUDINARY_CLOUD_NAME);

  if (!version || !email || !cloudName) {
    return "";
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/v${version}/users/${encodePathSegment(email)}/profile`;
};

const serializeUser = (user = {}) => ({
  ...user,
  profilePhoto: buildProfilePhotoUrl(user),
});

const serializeUsers = (users = []) => users.map((user) => serializeUser(user));

const getDuplicateFieldMessage = (error) => {
  const field = Object.keys(error?.keyPattern || error?.keyValue || {})[0] || "";

  if (field === "email") {
    return "An account with this email already exists.";
  }

  if (field === "username") {
    return "This username is already taken.";
  }

  return "This record already exists.";
};

const normalizeUserPayload = (
  payload = {},
  { allowAdminFields = false, allowPassword = false } = {},
) => {
  const nextPayload = {};
  const trimmedMobile = String(payload.mobile || "").trim();
  const fullName =
    payload.fullName && typeof payload.fullName === "object" ? payload.fullName : null;
  const nickname = payload.fullName?.nickname;

  // IDENTITY FIELDS - LOCKED for normal users, only editable by admins
  if (allowAdminFields) {
    // Email - only admins can change
    if (payload.email !== undefined) {
      const trimmedEmail = String(payload.email || "").trim().toLowerCase();
      if (!trimmedEmail) {
        throw Object.assign(new Error("Email is required."), { status: 400 });
      }
      if (!EMAIL_PATTERN.test(trimmedEmail)) {
        throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
      }
      nextPayload.email = trimmedEmail;
    }

    // Username - only admins can change
    if (payload.username !== undefined) {
      const originalUsername = String(payload.username || "").trim();
      const trimmedUsername = originalUsername.toLowerCase();
      if (!trimmedUsername) {
        throw Object.assign(new Error("Username is required."), { status: 400 });
      }
      if (!USERNAME_PATTERN.test(trimmedUsername)) {
        throw Object.assign(
          new Error(
            "Username must be 4-32 characters and can only use letters, numbers, dots, dashes, or underscores.",
          ),
          { status: 400 },
        );
      }
      nextPayload.username = originalUsername;
      if (originalUsername) {
        nextPayload.normalizedNickname = normalizeNickname(originalUsername);
      }
    }

    // Identity name fields - only admins can change
    if (fullName) {
      const fname = String(fullName.fname || "").trim();
      const lname = String(fullName.lname || "").trim();
      const mname = String(fullName.mname || "").trim();
      const suffix = String(fullName.suffix || "").trim();

      if (payload.fullName?.fname !== undefined && !fname) {
        throw Object.assign(new Error("First name is required."), { status: 400 });
      }
      if (payload.fullName?.lname !== undefined && !lname) {
        throw Object.assign(new Error("Last name is required."), { status: 400 });
      }

      nextPayload.fullName = {
        ...(fname ? { fname } : {}),
        ...(lname ? { lname } : {}),
        ...(mname ? { mname } : {}),
        ...(suffix ? { suffix } : {}),
        ...(nickname !== undefined ? { nickname: nickname.trim() } : {}),
      };
    }

    // Sex/Gender - only admins can change
    if (payload.isMale !== undefined) {
      nextPayload.isMale = Boolean(payload.isMale);
    }

    // PII fields (birth info) - only admins can change
    if (payload.pii && typeof payload.pii === "object") {
      nextPayload.pii = {
        ...(payload.pii.dob ? { dob: String(payload.pii.dob).trim() } : {}),
        ...(payload.pii.pob ? { pob: String(payload.pii.pob).trim() } : {}),
      };
    }

    // Address - only admins can change
    if (payload.address && typeof payload.address === "object") {
      nextPayload.address = {
        ...(payload.address.region ? { region: String(payload.address.region).trim() } : {}),
        ...(payload.address.province ? { province: String(payload.address.province).trim() } : {}),
        ...(payload.address.city ? { city: String(payload.address.city).trim() } : {}),
        ...(payload.address.barangay ? { barangay: String(payload.address.barangay).trim() } : {}),
        ...(payload.address.zip ? { zip: String(payload.address.zip).trim() } : {}),
      };
    }
  } else {
    // NORMAL USERS - Only editable fields allowed
    
    // Mobile number - editable by normal users
    if (payload.mobile !== undefined) {
      if (trimmedMobile && !MOBILE_PATTERN.test(trimmedMobile)) {
        throw Object.assign(new Error("Enter a valid contact number."), {
          status: 400,
        });
      }
      nextPayload.mobile = trimmedMobile;
    }

    // Nickname only - editable by normal users
    if (nickname !== undefined) {
      const trimmedNickname = nickname.trim();
      nextPayload.fullName = { nickname: trimmedNickname };
      if (trimmedNickname) {
        nextPayload.normalizedNickname = normalizeNickname(trimmedNickname);
      }
    }

    // Profile photo - editable by normal users
    if (payload.profilePhoto !== undefined) {
      nextPayload.profilePhoto = String(payload.profilePhoto).trim();
    }
  }

  if (Array.isArray(payload.state)) {
    nextPayload.state = Array.from(
      new Set(
        payload.state
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    );
  }

  if (allowAdminFields && payload.isActive !== undefined) {
    nextPayload.isActive = Boolean(payload.isActive);
  }

  if (allowAdminFields && payload.profile && typeof payload.profile === "object") {
    nextPayload.profile = {
      ...(payload.profile.status ? { status: String(payload.profile.status).trim() } : {}),
      ...(payload.profile.at ? { at: payload.profile.at } : {}),
    };
  }

  if (allowPassword && payload.password !== undefined) {
    const password = String(payload.password || "");

    if (password.length < 8) {
      throw Object.assign(
        new Error("Password must be at least 8 characters long."),
        { status: 400 },
      );
    }

    nextPayload.password = password;
  }

  return nextPayload;
};

const sendError = (res, error, status = 400) => {
  if (error?.code === 11000) {
    return res.status(409).json({ error: getDuplicateFieldMessage(error) });
  }

  return res.status(status).json({ error: error.message || error });
};

const buildUserQuery = (query = {}) => {
  const {
    email,
    state,
    membership,
    isActive,
    search,
    region,
    province,
    city,
  } = query;
  const dbQuery = {};

  if (email) dbQuery.email = { $regex: email, $options: "i" };
  if (state) dbQuery.state = state;
  if (membership) dbQuery.membership = membership;
  if (isActive !== undefined) dbQuery.isActive = isActive === "true";
  if (region) dbQuery["address.region"] = region;
  if (province) dbQuery["address.province"] = province;
  if (city) dbQuery["address.city"] = city;

  if (search) {
    dbQuery.$or = [
      { email: { $regex: search, $options: "i" } },
      { username: { $regex: search, $options: "i" } },
      { "fullName.fname": { $regex: search, $options: "i" } },
      { "fullName.mname": { $regex: search, $options: "i" } },
      { "fullName.lname": { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
    ];
  }

  return dbQuery;
};

const getTenantUserIds = async (auth = {}) => {
  const accessibleClubIds = getAccessibleClubIds(auth);

  if (!accessibleClubIds.length) {
    return [];
  }

  const affiliations = await Affiliations.find({
    club: { $in: accessibleClubIds },
    deletedAt: { $exists: false },
    status: "approved",
  })
    .select("user")
    .lean();

  return Array.from(
    new Set(
      [
        normalizeTenantId(auth?.userId),
        ...affiliations.map((affiliation) => normalizeTenantId(affiliation.user)),
      ].filter(Boolean),
    ),
  );
};

const isUserInTenant = async (auth = {}, targetUserId = "") => {
  const normalizedTargetUserId = normalizeTenantId(targetUserId);

  if (!normalizedTargetUserId) {
    return false;
  }

  if (normalizeTenantId(auth?.userId) === normalizedTargetUserId) {
    return true;
  }

  return (await getTenantUserIds(auth)).includes(normalizedTargetUserId);
};

export const findAll = async (req, res) => {
  try {
    if (!isTenantSuperAdmin(req.auth) && !hasPrivilegedDirectoryAccess(req.auth)) {
      return res.status(403).json({
        error: "Only owner, secretary, operator, or admin roles can browse users.",
      });
    }

    const filter = buildUserQuery(req.query);

    if (!isTenantSuperAdmin(req.auth)) {
      const tenantUserIds = await getTenantUserIds(req.auth);
      filter._id = { $in: tenantUserIds };
    }

    const result = await listUsers({
      filter,
      query: req.query,
      select: USER_SELECT,
    });
    const payload = serializeUsers(result.data);

    res.json({
      success: "Users fetched successfully",
      message: "Users fetched successfully",
      data: payload,
      payload,
      page: result.page,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
    });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const isSelfRequest = normalizeTenantId(req.auth?.userId) === normalizeTenantId(req.params.id);
    const canViewTenantUser =
      isSelfRequest ||
      isTenantSuperAdmin(req.auth) ||
      (hasPrivilegedDirectoryAccess(req.auth) && (await isUserInTenant(req.auth, req.params.id)));

    if (!canViewTenantUser) {
      return denyTenantAccess(req, res, {
        reason: "User detail request targeted another club tenant.",
      });
    }

    const payload = await Users.findById(req.params.id)
      .select(USER_SELECT)
      .lean({ virtuals: true });

    if (!payload) return res.status(404).json({ error: "User not found" });

    res.json({ success: "User fetched successfully", payload: serializeUser(payload) });
  } catch (error) {
    sendError(res, error);
  }
};

export const createUser = async (req, res) => {
  try {
    if (!isTenantSuperAdmin(req.auth) && !hasPrivilegedDirectoryAccess(req.auth)) {
      return res.status(403).json({
        error: "Only owner, secretary, operator, or admin roles can create users here.",
      });
    }

    const nextPayload = normalizeUserPayload(req.body, {
      allowAdminFields: true,
      allowPassword: true,
    });

    if (!isTenantSuperAdmin(req.auth)) {
      nextPayload.clubId = getPrimaryTenantClubId(req.auth);
    }

    const user = await Users.create(nextPayload);
    const payload = await Users.findById(user._id)
      .select(USER_SELECT)
      .lean({ virtuals: true });

    res.status(201).json({ success: "User created successfully", payload: serializeUser(payload) });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateUser = async (req, res) => {
  try {
    const isSelfRequest = normalizeTenantId(req.auth?.userId) === normalizeTenantId(req.params.id);
    const canUpdateTenantUser =
      isSelfRequest ||
      isTenantSuperAdmin(req.auth) ||
      (hasPrivilegedDirectoryAccess(req.auth) && (await isUserInTenant(req.auth, req.params.id)));

    if (!canUpdateTenantUser) {
      return denyTenantAccess(req, res, {
        reason: "User update request targeted another club tenant.",
      });
    }

    const user = await Users.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const allowAdminFields =
      String(req.auth?.userId || "") !== String(req.params.id) &&
      (isTenantSuperAdmin(req.auth) || hasPrivilegedDirectoryAccess(req.auth));

    user.set(
      normalizeUserPayload(req.body, {
        allowAdminFields,
      }),
    );

    if (isProfileComplete(user)) {
      user.profileCompleted = true;
    }

    await user.save();

    const payload = await Users.findById(user._id)
      .select(USER_SELECT)
      .lean({ virtuals: true });

    res.json({ success: "User updated successfully", payload: serializeUser(payload) });
  } catch (error) {
    sendError(res, error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    if (!isTenantSuperAdmin(req.auth) && !hasPrivilegedDirectoryAccess(req.auth)) {
      return res.status(403).json({
        error: "Only owner, secretary, operator, or admin roles can deactivate users.",
      });
    }

    if (String(req.auth?.userId || "") === String(req.params.id)) {
      return res.status(400).json({
        error: "Use sign out instead of deactivating your own account here.",
      });
    }

    if (!isTenantSuperAdmin(req.auth) && !(await isUserInTenant(req.auth, req.params.id))) {
      return denyTenantAccess(req, res, {
        reason: "User deactivation request targeted another club tenant.",
      });
    }

    const payload = await Users.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    )
      .select(USER_SELECT)
      .lean({ virtuals: true });

    if (!payload) return res.status(404).json({ error: "User not found" });

    res.json({ success: "User deactivated successfully", payload: serializeUser(payload) });
  } catch (error) {
    sendError(res, error);
  }
};

export const validateNickname = async (req, res) => {
  try {
    const { nickname, userId } = req.body;
    
    if (!nickname) {
      return res.status(400).json({
        success: false,
        message: "Nickname is required.",
        suggestions: []
      });
    }
    
    const validation = await validateNicknameUtil(nickname.trim(), userId);
    
    if (validation.isValid) {
      return res.json({
        success: true,
        message: "Nickname is available.",
        suggestions: []
      });
    } else {
      return res.status(400).json({
        success: false,
        message: validation.error,
        suggestions: validation.suggestions
      });
    }
  } catch (error) {
    sendError(res, error);
  }
};

// Public endpoint for landing page stats
export const findPublicUsers = async (req, res) => {
  try {
    const publicUsers = await Users.find({ 
      isActive: true,
      "profile.status": "approved"
    })
    .select("username fullName email profile.createdAt")
    .lean()
    .limit(1000); // Limit for performance and security

    res.json({ success: "Public users fetched successfully", payload: publicUsers });
  } catch (error) {
    sendError(res, error);
  }
};
