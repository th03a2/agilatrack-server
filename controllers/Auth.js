import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Users from "../models/Users.js";
import Affiliations from "../models/Affiliations.js";
import EmailVerifications from "../models/EmailVerifications.js";
import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.join(__dirname, "..", ".env");
const USER_SELECT =
  "_id email username isEmailVerified emailVerifiedAt fullName activePlatform membership state mobile isMale pid files profile isActive createdAt updatedAt";
const MOBILE_PORTAL = "guest";
const AUTH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_TTL_MS = 1000 * 60 * 10;
const VERIFICATION_TTL_MINUTES = VERIFICATION_TTL_MS / (1000 * 60);

const normalizeText = (value = "") => String(value || "").trim();
const normalizeFlag = (value = "") => normalizeText(value).toLowerCase();
const normalizeEmail = (value = "") => normalizeFlag(value);
const normalizeUsername = (value = "") => normalizeFlag(value);
const getAuthTokenSecret = () =>
  normalizeText(process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET) ||
  "agilatrack-dev-secret";
const getFirstEnvValue = (keys = []) =>
  keys
    .map((key) => normalizeText(process.env[key]))
    .find(Boolean) || "";
const isProduction = () => normalizeFlag(process.env.NODE_ENV) === "production";
const shouldExposeVerificationCode = () => {
  const explicitFlag = normalizeFlag(process.env.AUTH_EXPOSE_VERIFICATION_CODE);

  if (explicitFlag === "true") return true;
  if (explicitFlag === "false") return false;

  return !isProduction();
};
const isValidEmail = (value = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeText(value));
const isStrongPassword = (value = "") =>
  normalizeText(value).length >= 8 &&
  /[A-Z]/.test(value) &&
  /[a-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);
const buildGuestState = (values = []) => {
  const normalized = Array.isArray(values)
    ? values.map((value) => normalizeFlag(value)).filter(Boolean)
    : [];

  return normalized.length ? [...new Set(normalized)] : ["guest"];
};
const generateVerificationCode = () => {
  const staticCode = normalizeText(process.env.AUTH_STATIC_VERIFICATION_CODE);

  if (new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`).test(staticCode)) {
    return staticCode;
  }

  return String(crypto.randomInt(0, 10 ** VERIFICATION_CODE_LENGTH)).padStart(
    VERIFICATION_CODE_LENGTH,
    "0",
  );
};
const hashEmailVerificationCode = ({ email, code }) =>
  crypto
    .createHmac("sha256", getAuthTokenSecret())
    .update(`${normalizeEmail(email)}:${normalizeText(code)}`)
    .digest("hex");
const getVerificationExpiry = () => new Date(Date.now() + VERIFICATION_TTL_MS);
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
const logVerificationCode = ({ email, code, expiresAt, source }) => {
  console.info(
    `[auth] ${source} verification code for ${email}: ${code} (expires ${expiresAt.toISOString()})`,
  );
};
const deliverVerificationCode = async ({ email, code, expiresAt }) => {
  const webhookUrl = getFirstEnvValue([
    "AUTH_EMAIL_WEBHOOK_URL",
    "EMAIL_VERIFICATION_WEBHOOK_URL",
  ]);
  const webhookToken = getFirstEnvValue([
    "AUTH_EMAIL_WEBHOOK_TOKEN",
    "EMAIL_VERIFICATION_WEBHOOK_TOKEN",
  ]);

  if (!webhookUrl) {
    logVerificationCode({
      email,
      code,
      expiresAt,
      source: "local-dev",
    });

    return { exposedCode: shouldExposeVerificationCode() ? code : "" };
  }

  const fallbackToLocalDelivery = (reason) => {
    console.warn(`[auth] Email delivery webhook failed: ${reason}`);
    logVerificationCode({
      email,
      code,
      expiresAt,
      source: "fallback",
    });

    return { exposedCode: shouldExposeVerificationCode() ? code : "" };
  };

  if (typeof fetch !== "function") {
    if (isProduction()) {
      throw new Error(
        "Email delivery webhook requires a Node.js runtime with fetch support.",
      );
    }

    return fallbackToLocalDelivery("fetch is not available in this Node.js runtime.");
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
      },
      body: JSON.stringify({
        type: "email_verification",
        email,
        code,
        expiresAt: expiresAt.toISOString(),
        ttlMinutes: VERIFICATION_TTL_MINUTES,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");

      throw new Error(
        `Webhook responded with ${response.status}${details ? ` ${details}` : ""}`.trim(),
      );
    }

    return { exposedCode: "" };
  } catch (error) {
    if (isProduction()) {
      throw error;
    }

    return fallbackToLocalDelivery(error?.message || error);
  }
};
const buildVerificationSuccessMessage = ({ email, exposedCode = "" }) => {
  if (exposedCode) {
    return `Verification code generated for local development. Use ${exposedCode} for ${email}. It expires in ${VERIFICATION_TTL_MINUTES} minutes.`;
  }

  return `Verification code sent to ${email}. It expires in ${VERIFICATION_TTL_MINUTES} minutes.`;
};
const getCloudinaryConfig = () => ({
  cloudName: String(process.env.CLOUDINARY_CLOUD_NAME || "").trim(),
  apiKey: String(process.env.CLOUDINARY_API_KEY || "").trim(),
  apiSecret: String(process.env.CLOUDINARY_API_SECRET || "").trim(),
});
const isCloudinaryConfigured = () =>
  Boolean(
    getCloudinaryConfig().cloudName &&
      getCloudinaryConfig().apiKey &&
      getCloudinaryConfig().apiSecret,
  );

const applyCloudinaryConfig = () => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret) return false;

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  return true;
};

const refreshCloudinaryConfig = () => {
  dotenv.config({ path: ENV_PATH, override: true, quiet: true });
  return applyCloudinaryConfig();
};

const getCloudinaryErrorDetails = (error) => {
  const nestedError = error?.error && typeof error.error === "object" ? error.error : null;
  const rawMessage =
    nestedError?.message ||
    error?.message ||
    "Profile upload failed";

  const message = /api key/i.test(rawMessage)
    ? `${rawMessage}. Check that CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET come from the same Cloudinary key row.`
    : rawMessage;

  return {
    message,
    code: nestedError?.http_code || error?.http_code || null,
  };
};

refreshCloudinaryConfig();

const sendInvalidCredentials = (res) =>
  res.status(401).json({ error: "Invalid email or password" });

const toBase64Url = (value) => Buffer.from(value).toString("base64url");

const fromBase64Url = (value) => Buffer.from(value, "base64url").toString("utf8");

const signTokenPayload = (payload) =>
  crypto
    .createHmac("sha256", getAuthTokenSecret())
    .update(payload)
    .digest("base64url");

const issueSessionToken = (userId) => {
  const payload = JSON.stringify({
    userId: String(userId),
    issuedAt: Date.now(),
  });
  const encodedPayload = toBase64Url(payload);
  const signature = signTokenPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
};

const verifySessionToken = (token) => {
  const [encodedPayload = "", signature = ""] = String(token || "").split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signTokenPayload(encodedPayload);
  if (signature !== expectedSignature) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload));
    if (!parsed?.userId || !parsed?.issuedAt) return null;
    if (Date.now() - Number(parsed.issuedAt) > AUTH_TOKEN_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
};

const getTokenFromRequest = (req) => {
  const rawHeader = String(req.headers.authorization || "").trim();
  if (!rawHeader) return "";

  if (/^QTracy\s+/i.test(rawHeader)) {
    return rawHeader.replace(/^QTracy\s+/i, "").trim();
  }

  if (/^Bearer\s+/i.test(rawHeader)) {
    return rawHeader.replace(/^Bearer\s+/i, "").trim();
  }

  return rawHeader;
};

const encodePathSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const buildAffiliationPlatform = (affiliation, { isMobile }) => {
  const clubId =
    affiliation?.club && typeof affiliation.club === "object"
      ? affiliation.club?._id
      : affiliation?.club;
  const primaryRole = Array.isArray(affiliation?.roles)
    ? affiliation.roles[0] || null
    : affiliation?.roles || affiliation?.membershipType || null;

  return {
    _id: affiliation?._id || null,
    club: clubId || null,
    role: primaryRole,
    portal: isMobile ? MOBILE_PORTAL : "club",
    access: [],
    auxiliary: [],
  };
};

const buildActivePlatform = ({ user, activeAffiliation, isMobile }) => {
  const currentPlatform = user?.activePlatform || {};

  if (activeAffiliation?._id) {
    return buildAffiliationPlatform(activeAffiliation, { isMobile });
  }

  return {
    _id: currentPlatform?._id || null,
    club: currentPlatform?.club || null,
    role: null,
    portal: isMobile ? MOBILE_PORTAL : String(currentPlatform?.portal || "guest"),
    access: [],
    auxiliary: [],
  };
};

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
      select: "name code abbr level location lid bid social logo management",
      populate: {
        path: "management.secretary.user",
        select: "fullName email mobile pid isMale",
      },
    })
    .select("_id club memberCode membershipType roles status")
    .sort({ updatedAt: -1 })
    .lean({ virtuals: true });

  const currentPlatform = payload?.activePlatform || {};
  const hasExplicitGuestPlatform =
    !currentPlatform?._id &&
    !currentPlatform?.club &&
    String(currentPlatform?.portal || "")
      .trim()
      .toLowerCase() === "guest";

  const activeAffiliation =
    affiliations.find(
      (affiliation) =>
        String(affiliation?._id || "") === String(currentPlatform?._id || ""),
    ) ||
    (hasExplicitGuestPlatform ? null : affiliations[0] || null);

  const activePlatform = buildActivePlatform({
    user: payload,
    activeAffiliation,
    isMobile,
  });

  const normalizedAffiliations = affiliations.map((affiliation) => ({
    ...affiliation,
    activePlatform: buildAffiliationPlatform(affiliation, { isMobile }),
  }));

  return {
    user: {
      ...payload,
      activePlatform,
    },
    affiliations: normalizedAffiliations,
    activePlatform,
    affiliation: activeAffiliation,
    schedules: [],
    token,
  };
};

const sendAuthResponse = async ({ res, userId, token = "", isMobile = false, success }) => {
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

const sendSessionFromRequest = async ({ req, res, success }) => {
  const token = getTokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ error: "Missing authorization token" });
  }

  const session = verifySessionToken(token);
  if (!session?.userId) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  return sendAuthResponse({
    res,
    userId: session.userId,
    token,
    isMobile: normalizeFlag(req.query?.platform || req.headers["x-platform"]) === "mobile",
    success,
  });
};

export const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await Users.findByEmail(email);

    if (!user || user.isActive === false) {
      return sendInvalidCredentials(res);
    }

    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return sendInvalidCredentials(res);
    }

    const token = issueSessionToken(user._id);

    return sendAuthResponse({
      res,
      userId: user._id,
      token,
      isMobile: normalizeFlag(req.body?.platform || req.query?.platform) === "mobile",
      success: "Login successful",
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Login failed" });
  }
};

export const getCurrentUser = async (req, res) => {
  try {
    return sendSessionFromRequest({
      req,
      res,
      success: "Current user fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to fetch current user" });
  }
};

export const validateRefresh = async (req, res) => {
  try {
    return sendSessionFromRequest({
      req,
      res,
      success: "Session validated",
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Refresh validation failed" });
  }
};

export const sendVerificationCode = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    const existingUser = await Users.findOne({ email }).select("_id").lean();
    if (existingUser?._id) {
      return res
        .status(409)
        .json({ error: "An account with this email already exists." });
    }

    const code = generateVerificationCode();
    const expiresAt = getVerificationExpiry();

    await EmailVerifications.findOneAndUpdate(
      { email },
      {
        email,
        codeHash: hashEmailVerificationCode({ email, code }),
        expiresAt,
        verifiedAt: null,
        attempts: 0,
        lastSentAt: new Date(),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    const delivery = await deliverVerificationCode({ email, code, expiresAt });

    return res.json({
      success: buildVerificationSuccessMessage({
        email,
        exposedCode: delivery.exposedCode,
      }),
      payload: {
        email,
        expiresAt: expiresAt.toISOString(),
        isEmailVerified: false,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to send verification code.",
    });
  }
};

export const verifyEmailCode = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = normalizeText(req.body?.code);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!code) {
      return res.status(400).json({ error: "Verification code is required" });
    }

    if (!new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`).test(code)) {
      return res
        .status(400)
        .json({ error: `Enter the ${VERIFICATION_CODE_LENGTH}-digit verification code.` });
    }

    const verification = await EmailVerifications.findOne({ email });
    if (!verification) {
      return res.status(400).json({ error: "Send a verification code first." });
    }

    if (verification.expiresAt.getTime() <= Date.now()) {
      await verification.deleteOne();

      return res
        .status(410)
        .json({ error: "Verification code expired. Request a new code." });
    }

    const codeHash = hashEmailVerificationCode({ email, code });
    if (verification.codeHash !== codeHash) {
      verification.attempts = Number(verification.attempts || 0) + 1;
      await verification.save();

      return res
        .status(400)
        .json({ error: "Invalid verification code. Try again or resend a new code." });
    }

    verification.verifiedAt = new Date();
    verification.attempts = 0;
    await verification.save();

    return res.json({
      success: "Email verified successfully.",
      payload: {
        email,
        expiresAt: verification.expiresAt.toISOString(),
        isEmailVerified: true,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to verify your email.",
    });
  }
};

export const register = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || "");
    const mobile = normalizeText(req.body?.mobile);
    const fname = normalizeText(req.body?.fullName?.fname);
    const lname = normalizeText(req.body?.fullName?.lname);
    const mname = normalizeText(req.body?.fullName?.mname);
    const membership = normalizeFlag(req.body?.membership || "guest") || "guest";
    const state = buildGuestState(req.body?.state);

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address." });
    }

    if (!fname) {
      return res.status(400).json({ error: "First name is required." });
    }

    if (!lname) {
      return res.status(400).json({ error: "Last name is required." });
    }

    if (!mobile) {
      return res.status(400).json({ error: "Contact number is required." });
    }

    if (username.length < 4) {
      return res
        .status(400)
        .json({ error: "Username must be at least 4 characters long." });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      });
    }

    const verification = await EmailVerifications.findOne({ email });
    if (!verification?.verifiedAt) {
      return res.status(400).json({
        error: "Verify your email before completing registration.",
      });
    }

    if (verification.expiresAt.getTime() <= Date.now()) {
      await verification.deleteOne();

      return res
        .status(410)
        .json({ error: "Verification code expired. Request a new code." });
    }

    const existingUser = await Users.findOne({
      $or: [{ email }, { username }],
    })
      .select("_id email username")
      .lean();

    if (existingUser?._id) {
      if (existingUser.email === email) {
        return res
          .status(409)
          .json({ error: "An account with this email already exists." });
      }

      return res.status(409).json({ error: "This username is already taken." });
    }

    const user = await Users.create({
      email,
      username,
      password,
      mobile,
      membership,
      state,
      isEmailVerified: true,
      emailVerifiedAt: verification.verifiedAt,
      fullName: {
        fname,
        lname,
        ...(mname ? { mname } : {}),
      },
      activePlatform: {
        _id: null,
        club: null,
        role: null,
        portal: MOBILE_PORTAL,
        access: [],
      },
    });

    await verification.deleteOne();

    return res.status(201).json({
      success: "Registration completed successfully.",
      payload: {
        _id: user._id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        username: user.username,
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: getDuplicateFieldMessage(error) });
    }

    return res.status(500).json({
      error: error.message || "Unable to complete registration.",
    });
  }
};

export const update = async (req, res) => {
  try {
    const token = getTokenFromRequest(req);
    const session = verifySessionToken(token);
    if (!session?.userId) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

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
        .map((value) => String(value || "").trim())
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
      isMobile:
        normalizeFlag(req.body?.platform || req.query?.platform) === "mobile" ||
        normalizeFlag(req.body?.activePlatform?.portal) === MOBILE_PORTAL,
      success: "Auth updated",
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Auth update failed" });
  }
};

export const uploadProfile = async (req, res) => {
  try {
    const cloudinaryReady = refreshCloudinaryConfig();
    if (!cloudinaryReady || !isCloudinaryConfigured()) {
      return res.status(500).json({
        error: "Cloudinary is not configured",
        message:
          "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env.",
      });
    }

    const token = getTokenFromRequest(req);
    const session = verifySessionToken(token);
    if (!session?.userId) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

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
      public_id: "profile",
      resource_type: "image",
      overwrite: true,
      invalidate: true,
    });

    user.pid = uploadResult.version
      ? String(uploadResult.version)
      : uploadResult.asset_id;
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
        source: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      },
    });
  } catch (error) {
    const details = getCloudinaryErrorDetails(error);

    return res.status(500).json({
      error: details.message,
      code: details.code,
    });
  }
};
