import Users from "../models/Users.js";

const USER_SELECT = "-password -__v";

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

const normalizeUserPayload = (payload = {}) => {
  const nextPayload = { ...payload };

  if (typeof nextPayload.email === "string") {
    nextPayload.email = nextPayload.email.trim().toLowerCase();
  }

  if (typeof nextPayload.username === "string") {
    nextPayload.username = nextPayload.username.trim().toLowerCase();
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
    const user = await Users.create(normalizeUserPayload(req.body));
    const payload = await Users.findById(user._id)
      .select(USER_SELECT)
      .lean({ virtuals: true });

    res.status(201).json({ success: "User created successfully", payload });
  } catch (error) {
    sendError(res, error);
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await Users.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.set(normalizeUserPayload(req.body));
    await user.save();

    const payload = await Users.findById(user._id)
      .select(USER_SELECT)
      .lean({ virtuals: true });

    res.json({ success: "User updated successfully", payload });
  } catch (error) {
    sendError(res, error);
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
