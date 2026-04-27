import Users from "../models/Users.js";
import { hasClubManagementAccess } from "../middleware/auth.js";

const USER_SELECT = "-password -__v";
const SELF_SERVICE_FIELDS = [
  "email",
  "fullName",
  "mobile",
  "pid",
  "profilePhoto",
  "username",
  "validIdImage",
];

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

const sendCreateOrUpdateError = (res, error) => {
  if (error?.code === 11000) {
    const duplicateField = Object.keys(error.keyPattern || {})[0] || "field";
    const fieldLabel =
      duplicateField === "email"
        ? "Email"
        : duplicateField === "username"
          ? "Username"
          : "Value";

    return res.status(409).json({
      error: `${fieldLabel} is already in use.`,
    });
  }

  return sendError(res, error);
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
      { "fullName.fname": { $regex: search, $options: "i" } },
      { "fullName.mname": { $regex: search, $options: "i" } },
      { "fullName.lname": { $regex: search, $options: "i" } },
      { mobile: { $regex: search, $options: "i" } },
    ];
  }

  return dbQuery;
};

const pickAllowedSelfUpdates = (payload = {}) =>
  SELF_SERVICE_FIELDS.reduce((accumulator, field) => {
    if (payload[field] !== undefined) {
      accumulator[field] = payload[field];
    }

    return accumulator;
  }, {});

export const findAll = async (req, res) => {
  try {
    const payload = await Users.find(buildUserQuery(req.query))
      .select(USER_SELECT)
      .sort({ createdAt: -1 })
      .lean({ virtuals: true });

    res.json({ success: "Users fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const findOne = async (req, res) => {
  try {
    const payload = await Users.findById(req.params.id)
      .select(USER_SELECT)
      .lean({ virtuals: true });

    if (!payload) return res.status(404).json({ error: "User not found" });

    res.json({ success: "User fetched successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const createUser = async (req, res) => {
  try {
    const user = await Users.create(req.body);
    const payload = await Users.findById(user._id)
      .select(USER_SELECT)
      .lean({ virtuals: true });

    res.status(201).json({ success: "User created successfully", payload });
  } catch (error) {
    sendCreateOrUpdateError(res, error);
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await Users.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isManager = hasClubManagementAccess(req.auth);
    const nextPayload = isManager ? req.body : pickAllowedSelfUpdates(req.body);

    if (!Object.keys(nextPayload || {}).length) {
      return res.status(400).json({ error: "No allowed profile fields were provided." });
    }

    user.set(nextPayload);
    await user.save();

    const payload = await Users.findById(user._id)
      .select(USER_SELECT)
      .lean({ virtuals: true });

    res.json({ success: "User updated successfully", payload });
  } catch (error) {
    sendCreateOrUpdateError(res, error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const payload = await Users.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true },
    )
      .select(USER_SELECT)
      .lean({ virtuals: true });

    if (!payload) return res.status(404).json({ error: "User not found" });

    res.json({ success: "User deactivated successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};
