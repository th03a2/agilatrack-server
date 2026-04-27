import crypto from "node:crypto";
import Affiliations from "../models/Affiliations.js";
import Users from "../models/Users.js";
import { env } from "../config/env.js";
import { sendVerificationCodeEmail } from "../utils/email.js";
import { signAuthToken } from "../utils/auth.js";

const USER_SELECT =
  "_id email username fullName activePlatform membership state mobile isActive isEmailVerified createdAt updatedAt pid profilePhoto validIdImage profile";
const AFFILIATION_SELECT = "_id club memberCode membershipType roles status";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_REGEX = /^\d{6}$/;
const VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const VERIFICATION_RESEND_COOLDOWN_MS = 60 * 1000;

const sendInvalidCredentials = (res) =>
  res.status(401).json({ error: "Invalid email or password" });

const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isValidEmail = (value) => EMAIL_REGEX.test(value);

const isRegisteredUser = (user) =>
  Boolean(user?.password || user?.username || user?.mobile);

const generateVerificationCode = () =>
  crypto.randomInt(100000, 1000000).toString();

const clearEmailVerification = (user) => {
  user.emailVerificationCode = undefined;
  user.emailVerificationExpires = undefined;
  user.emailVerificationSentAt = undefined;
};

const sendError = (res, error, fallbackStatus = 400) =>
  res.status(error?.statusCode || fallbackStatus).json({
    error: error?.message || error || "Request failed",
    ...(!env.IS_PRODUCTION && error?.details ? { details: error.details } : {}),
  });

const sendRegistrationError = (res, error) => {
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

const buildAuthPayload = async (userId) => {
  const [user, affiliations] = await Promise.all([
    Users.findById(userId).select(USER_SELECT).lean({ virtuals: true }),
    Affiliations.find({
      user: userId,
      deletedAt: { $exists: false },
      status: "approved",
    })
      .populate("club", "name code abbr level location")
      .select(AFFILIATION_SELECT)
      .sort({ updatedAt: -1 })
      .lean({ virtuals: true }),
  ]);

  return { affiliations, user };
};

const buildSessionPayload = async (user) => ({
  ...(await buildAuthPayload(user._id)),
  token: signAuthToken(user),
});

export const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await Users.findByEmail(email);

    if (!user || user.isActive === false || !user.password) {
      return sendInvalidCredentials(res);
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return sendInvalidCredentials(res);
    }

    res.json({
      success: "Login successful",
      payload: await buildSessionPayload(user),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Login failed" });
  }
};

export const me = async (req, res) => {
  try {
    res.json({
      success: "Session validated successfully",
      payload: {
        ...(await buildAuthPayload(req.auth.user._id)),
        token: req.auth.token,
      },
    });
  } catch (error) {
    sendError(res, error, 500);
  }
};

export const sendVerificationCode = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    let user = await Users.findOne({ email });

    if (user && isRegisteredUser(user)) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const lastSentAt = user?.emailVerificationSentAt?.getTime() || 0;
    const retryAfterMs = lastSentAt + VERIFICATION_RESEND_COOLDOWN_MS - Date.now();

    if (retryAfterMs > 0) {
      return res.status(429).json({
        error: `Please wait ${Math.ceil(
          retryAfterMs / 1000,
        )} seconds before requesting a new code.`,
      });
    }

    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

    if (!user) {
      user = new Users({
        email,
        isActive: false,
      });
    }

    user.email = email;
    user.emailVerificationCode = code;
    user.emailVerificationExpires = expiresAt;
    user.emailVerificationSentAt = new Date();
    user.isActive = false;
    user.isEmailVerified = false;

    await user.save({ validateBeforeSave: false });
    const delivery = await sendVerificationCodeEmail({ code, email });

    return res.json({
      payload: {
        email,
        expiresAt,
        ...(!env.IS_PRODUCTION && delivery?.previewCode
          ? {
              deliveryMode: delivery.deliveryMode,
              devVerificationCode: delivery.previewCode,
              missingEmailConfig: delivery.missing,
            }
          : {}),
      },
      success:
        delivery?.deliveryMode === "preview"
          ? "Verification code generated for local development."
          : "Verification code sent successfully.",
    });
  } catch (error) {
    return sendError(res, error, 500);
  }
};

export const verifyEmailCode = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").trim();

    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    if (!code) {
      return res.status(400).json({ error: "Verification code is required." });
    }

    if (!VERIFICATION_CODE_REGEX.test(code)) {
      return res.status(400).json({ error: "Enter the 6-digit verification code." });
    }

    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(404).json({
        error: "Verification request not found. Please send a new code.",
      });
    }

    if (user.isEmailVerified) {
      return res.json({
        payload: {
          email,
          isEmailVerified: true,
        },
        success: "Email already verified.",
      });
    }

    if (!user.emailVerificationCode || !user.emailVerificationExpires) {
      return res.status(400).json({
        error: "Verification code not found. Please send a new code.",
      });
    }

    if (user.emailVerificationExpires.getTime() < Date.now()) {
      clearEmailVerification(user);
      user.isEmailVerified = false;
      await user.save({ validateBeforeSave: false });

      return res.status(400).json({
        error: "Verification code expired. Please request a new code.",
      });
    }

    if (user.emailVerificationCode !== code) {
      return res.status(400).json({
        error: "Invalid verification code. Please try again.",
      });
    }

    clearEmailVerification(user);
    user.isEmailVerified = true;

    await user.save({ validateBeforeSave: false });

    return res.json({
      payload: {
        email,
        isEmailVerified: true,
      },
      success: "Email verified successfully.",
    });
  } catch (error) {
    return sendError(res, error, 500);
  }
};

export const register = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const username = String(req.body?.username || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    const mobile = String(req.body?.mobile || "").trim();
    const fullName = req.body?.fullName || {};

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (!username) {
      return res.status(400).json({ error: "Username is required." });
    }

    if (!password) {
      return res.status(400).json({ error: "Password is required." });
    }

    if (!mobile) {
      return res.status(400).json({ error: "Mobile number is required." });
    }

    if (!String(fullName?.fname || "").trim() || !String(fullName?.lname || "").trim()) {
      return res.status(400).json({ error: "First name and last name are required." });
    }

    const user = await Users.findOne({ email });

    if (!user) {
      return res.status(400).json({
        error: "Verify your email before completing registration.",
      });
    }

    if (isRegisteredUser(user)) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    if (!user.isEmailVerified) {
      return res.status(400).json({
        error: "Verify your email before completing registration.",
      });
    }

    user.set({
      email,
      fullName,
      isActive: true,
      isEmailVerified: true,
      membership: req.body?.membership,
      mobile,
      password,
      state: req.body?.state,
      username,
    });

    clearEmailVerification(user);

    await user.save();

    const payload = await Users.findById(user._id)
      .select(USER_SELECT)
      .lean({ virtuals: true });

    return res.status(201).json({
      payload,
      success: "User created successfully",
    });
  } catch (error) {
    return sendRegistrationError(res, error);
  }
};
