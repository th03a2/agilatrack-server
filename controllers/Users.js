import Users from "../models/Users.js";
import {
  canAccessUserRecord,
  hasPrivilegedDirectoryAccess,
} from "../middleware/sessionAuth.js";
import { listUsers } from "../services/userService.js";

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
  const trimmedEmail = String(payload.email || "").trim().toLowerCase();
  const trimmedUsername = String(payload.username || "").trim().toLowerCase();
  const trimmedMobile = String(payload.mobile || "").trim();
  const fullName =
    payload.fullName && typeof payload.fullName === "object" ? payload.fullName : null;

  if (payload.email !== undefined) {
    if (!trimmedEmail) {
      throw Object.assign(new Error("Email is required."), { status: 400 });
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      throw Object.assign(new Error("Enter a valid email address."), { status: 400 });
    }

    nextPayload.email = trimmedEmail;
  }

  if (payload.username !== undefined) {
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

    nextPayload.username = trimmedUsername;
  }

  if (payload.mobile !== undefined) {
    if (trimmedMobile && !MOBILE_PATTERN.test(trimmedMobile)) {
      throw Object.assign(new Error("Enter a valid contact number."), {
        status: 400,
      });
    }

    nextPayload.mobile = trimmedMobile;
  }

  if (fullName) {
    const fname = String(fullName.fname || "").trim();
    const lname = String(fullName.lname || "").trim();
    const mname = String(fullName.mname || "").trim();

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
    };
  }

  if (payload.isMale !== undefined) {
    nextPayload.isMale = Boolean(payload.isMale);
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

export const findAll = async (req, res) => {
  try {
    if (!hasPrivilegedDirectoryAccess(req.auth)) {
      return res.status(403).json({
        error: "Only owner, secretary, or operator roles can browse all users.",
      });
    }

    const result = await listUsers({
      filter: buildUserQuery(req.query),
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
    if (!canAccessUserRecord(req.auth, req.params.id)) {
      return res.status(403).json({
        error: "You can only view your own account unless you manage users.",
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
    if (!hasPrivilegedDirectoryAccess(req.auth)) {
      return res.status(403).json({
        error: "Only owner, secretary, or operator roles can create users here.",
      });
    }

    const user = await Users.create(
      normalizeUserPayload(req.body, {
        allowAdminFields: true,
        allowPassword: true,
      }),
    );
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
    if (!canAccessUserRecord(req.auth, req.params.id)) {
      return res.status(403).json({
        error: "You can only update your own account unless you manage users.",
      });
    }

    const user = await Users.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const allowAdminFields =
      String(req.auth?.userId || "") !== String(req.params.id) &&
      hasPrivilegedDirectoryAccess(req.auth);

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
    if (!hasPrivilegedDirectoryAccess(req.auth)) {
      return res.status(403).json({
        error: "Only owner, secretary, or operator roles can deactivate users.",
      });
    }

    if (String(req.auth?.userId || "") === String(req.params.id)) {
      return res.status(400).json({
        error: "Use sign out instead of deactivating your own account here.",
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
