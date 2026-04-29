<<<<<<< Updated upstream
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
=======
import Affiliations from "../models/Affiliations.js";
import Users from "../models/Users.js";
import { configureCloudinary, getCloudinaryStatus } from "../config/cloudinary.js";
import cloudinary from "../config/cloudinary.js";
import { extractAuthToken, signAuthToken, verifyAuthToken } from "../utils/auth.js";

const USER_SELECT =
  "_id email username fullName activePlatform membership state mobile isMale pid files profile profilePhoto validIdImage isEmailVerified isActive createdAt updatedAt";
const MOBILE_PORTAL = "guest";
>>>>>>> Stashed changes

const sendInvalidCredentials = (res) =>
  res.status(401).json({ error: "Invalid email or password" });

<<<<<<< Updated upstream
const normalizeEmail = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const isValidEmail = (value) => EMAIL_REGEX.test(value);
=======
const encodePathSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const getCloudinaryErrorDetails = (error) => {
  const nestedError = error?.error && typeof error.error === "object" ? error.error : null;
  const rawMessage = nestedError?.message || error?.message || "Profile upload failed";

  const message = /api key/i.test(rawMessage)
    ? `${rawMessage}. Check that CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET come from the same Cloudinary key row.`
    : rawMessage;

  return {
    message,
    code: nestedError?.http_code || error?.http_code || null,
  };
};

const buildAffiliationPlatform = (affiliation, { isMobile }) => {
  const clubId =
    affiliation?.club && typeof affiliation.club === "object"
      ? affiliation.club?._id
      : affiliation?.club;
  const primaryRole = Array.isArray(affiliation?.roles)
    ? affiliation.roles[0] || null
    : affiliation?.roles || affiliation?.membershipType || null;
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
const buildAuthPayload = async (userId) => {
  const [user, affiliations] = await Promise.all([
    Users.findById(userId).select(USER_SELECT).lean({ virtuals: true }),
    Affiliations.find({
      user: userId,
      deletedAt: { $exists: false },
      status: "approved",
=======
const buildAuthData = async ({ userId, token = "", isMobile = false }) => {
  const payload = await Users.findById(userId)
    .select(USER_SELECT)
    .lean({ virtuals: true });

  if (!payload || payload.isActive === false) {
    return null;
  }

  const affiliations = await Affiliations.find({
    user: userId,
    deletedAt: { $exists: false },
    status: "approved",
  })
    .populate({
      path: "club",
      select:
        "name code abbr level location lid bid social logo clubLogo management message",
      populate: {
        path: "management.secretary.user",
        select: "fullName email mobile pid isMale",
      },
>>>>>>> Stashed changes
    })
      .populate("club", "name code abbr level location")
      .select(AFFILIATION_SELECT)
      .sort({ updatedAt: -1 })
      .lean({ virtuals: true }),
  ]);

  return { affiliations, user };
};

<<<<<<< Updated upstream
const buildSessionPayload = async (user) => ({
  ...(await buildAuthPayload(user._id)),
  token: signAuthToken(user),
});
=======
const sendAuthResponse = async ({
  res,
  userId,
  token = "",
  isMobile = false,
  success,
}) => {
  const data = await buildAuthData({ userId, token, isMobile });

  if (!data) {
    return sendInvalidCredentials(res);
  }

  return res.json({
    success,
    data,
    payload: data,
  });
};
>>>>>>> Stashed changes

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

<<<<<<< Updated upstream
    res.json({
=======
    const token = signAuthToken(user);

    return sendAuthResponse({
      res,
      userId: user._id,
      token,
      isMobile: String(req.body?.platform || req.query?.platform || "")
        .trim()
        .toLowerCase() === "mobile",
>>>>>>> Stashed changes
      success: "Login successful",
      payload: await buildSessionPayload(user),
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Login failed" });
  }
};

<<<<<<< Updated upstream
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
=======
export const me = async (req, res) =>
  sendAuthResponse({
    res,
    userId: req.auth.user._id,
    token: req.auth.token,
    success: "Session validated",
  });

export const validateRefresh = async (req, res) => {
  try {
    const token = extractAuthToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ error: "Missing authorization token" });
    }

    const session = verifyAuthToken(token);

    return sendAuthResponse({
      res,
      userId: session.userId,
      token,
      isMobile: String(req.query?.platform || req.headers["x-platform"] || "")
        .trim()
        .toLowerCase() === "mobile",
      success: "Session validated",
    });
  } catch (error) {
    res.status(401).json({ error: error.message || "Refresh validation failed" });
  }
};

export const update = async (req, res) => {
  try {
    const token = extractAuthToken(req.headers.authorization);
    const session = verifyAuthToken(token);

    const user = await Users.findById(session.userId);
    if (!user || user.isActive === false) {
      return res.status(404).json({ error: "User not found" });
    }

    const requestedUserId = String(req.body?._id || user._id);
    if (String(user._id) !== requestedUserId) {
      return res.status(403).json({ error: "Unauthorized auth update request" });
    }

    if (req.body?.fullName && typeof req.body.fullName === "object") {
      user.fullName = {
        ...(user.fullName?.toObject?.() || user.fullName || {}),
        ...req.body.fullName,
      };
    }

    if (Array.isArray(req.body?.state)) {
      user.state = req.body.state
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
    }

    if (req.body?.activePlatform && typeof req.body.activePlatform === "object") {
      const requestedAffiliationId = String(req.body.activePlatform?._id || "").trim();

      if (!requestedAffiliationId) {
        user.activePlatform = {
          ...(user.activePlatform?.toObject?.() || user.activePlatform || {}),
          _id: null,
          club: null,
          role: null,
          portal: String(req.body.activePlatform?.portal || "guest")
            .trim()
            .toLowerCase(),
          access: [],
        };
      } else {
        const affiliation = await Affiliations.findOne({
          _id: requestedAffiliationId,
          user: user._id,
          status: "approved",
          deletedAt: { $exists: false },
        })
          .select("_id club roles")
          .lean();

        if (!affiliation?._id) {
          return res.status(404).json({ error: "Affiliation not found" });
        }

        user.activePlatform = {
          ...(user.activePlatform?.toObject?.() || user.activePlatform || {}),
          _id: affiliation._id,
          club: affiliation.club || null,
          role: Array.isArray(affiliation.roles) ? affiliation.roles : [],
          portal: String(req.body.activePlatform?.portal || "guest")
            .trim()
            .toLowerCase(),
          access: [],
        };
      }
    }

    await user.save();

    return sendAuthResponse({
      res,
      userId: user._id,
      token,
      isMobile: String(req.body?.platform || req.query?.platform || "")
        .trim()
        .toLowerCase() === "mobile" ||
        String(req.body?.activePlatform?.portal || "").trim().toLowerCase() ===
          MOBILE_PORTAL,
      success: "Auth updated",
    });
  } catch (error) {
    const statusCode = error?.message?.includes("Authentication required") ? 401 : 500;

    res.status(statusCode).json({ error: error.message || "Auth update failed" });
  }
};

export const uploadProfile = async (req, res) => {
  try {
    const status = configureCloudinary();
    if (!status.configured) {
      return res.status(503).json({
        error: "Cloudinary is not configured",
        message:
          "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env.",
        missing: getCloudinaryStatus().missing,
      });
    }

    const token = extractAuthToken(req.headers.authorization);
    const session = verifyAuthToken(token);

    const user = await Users.findById(session.userId);
    if (!user || user.isActive === false) {
      return res.status(404).json({ error: "User not found" });
    }

    const source = String(req.body?.source || "").trim();
    if (!source.startsWith("data:image/")) {
      return res.status(400).json({
        error: "Invalid image payload",
        message: "Profile upload expects a base64 image data URL.",
      });
    }

    const safeEmail = encodePathSegment(user.email);
    const uploadResult = await cloudinary.uploader.upload(source, {
      folder: `users/${safeEmail}`,
      invalidate: true,
      overwrite: true,
      public_id: "profile",
      resource_type: "image",
    });

    user.pid = uploadResult.version
      ? String(uploadResult.version)
      : uploadResult.asset_id;
    user.profilePhoto = uploadResult.secure_url;
    user.files = {
      ...(user.files?.toObject?.() || user.files || {}),
      profile: user.pid,
    };
    user.profile = {
      ...(user.profile?.toObject?.() || user.profile || {}),
      at: new Date(),
    };
    await user.save();

    return res.status(201).json({
      success: "Profile photo uploaded successfully",
      imgId: user.pid,
      payload: {
        imgId: user.pid,
        profile: user.pid,
        profilePhoto: uploadResult.secure_url,
        source: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      },
    });
  } catch (error) {
    const details = getCloudinaryErrorDetails(error);
    const statusCode = error?.message?.includes("Authentication required") ? 401 : 500;

    return res.status(statusCode).json({
      error: details.message,
      code: details.code,
    });
>>>>>>> Stashed changes
  }
};
