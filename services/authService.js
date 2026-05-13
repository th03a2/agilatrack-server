import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { v2 as cloudinary } from "cloudinary";
import Affiliations from "../models/Affiliations.js";
import ClubManagement from "../models/ClubManagement.js";
import EmailVerifications from "../models/EmailVerifications.js";
import Users from "../models/Users.js";
import {
  hydrateAffiliationsWithDerivedRoles,
  resolvePrimaryAffiliationRole,
} from "../utils/clubRoles.js";
import {
  getTokenFromRequest,
  issueSessionToken,
  isProduction,
  normalizeFlag,
  normalizeText,
  verifySessionToken,
} from "../utils/auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ENV_PATH = path.join(__dirname, "..", ".env");

const USER_SELECT =
  "_id email username isEmailVerified emailVerifiedAt fullName activePlatform clubId membership membershipStatus profileCompleted role state mobile isMale pid profilePhoto files profile isActive createdAt updatedAt";
const MOBILE_PORTAL = "guest";
const VERIFICATION_CODE_LENGTH = 6;
const VERIFICATION_TTL_MS = 1000 * 60 * 10;
const VERIFICATION_TTL_MINUTES = VERIFICATION_TTL_MS / (1000 * 60);
const VERIFICATION_RESEND_COOLDOWN_SECONDS = Number(
  process.env.AUTH_VERIFICATION_RESEND_COOLDOWN_SECONDS || 40,
);
const VERIFICATION_RESEND_COOLDOWN_MS = VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000;
const MAX_VERIFICATION_ATTEMPTS = Number(
  process.env.AUTH_VERIFICATION_MAX_ATTEMPTS || 5,
);
const MAX_PROFILE_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_PROFILE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const normalizeEmail = (value = "") => normalizeFlag(value);
const normalizeUsername = (value = "") => normalizeFlag(value);

const shouldExposeVerificationCode = () => {
  const explicitFlag = normalizeFlag(process.env.AUTH_EXPOSE_VERIFICATION_CODE);

  if (explicitFlag === "true") {
    return true;
  }

  if (explicitFlag === "false") {
    return false;
  }

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
    .createHmac(
      "sha256",
      normalizeText(process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET) ||
        "agilatrack-dev-secret",
    )
    .update(`${normalizeEmail(email)}:${normalizeText(code)}`)
    .digest("hex");

const getVerificationExpiry = () => new Date(Date.now() + VERIFICATION_TTL_MS);

const getVerificationCooldownRemainingSeconds = (verification) => {
  const lastSentAt = new Date(verification?.lastSentAt || 0).getTime();
  const remainingMs = lastSentAt + VERIFICATION_RESEND_COOLDOWN_MS - Date.now();

  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
};

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

let cachedTransporter = null;
let cachedTransporterFingerprint = "";

const getSmtpConfig = () => ({
  from:
    normalizeText(process.env.SMTP_FROM) ||
    normalizeText(process.env.EMAIL_FROM) ||
    "no-reply@agilatrack.local",
  host:
    normalizeText(process.env.SMTP_HOST) || normalizeText(process.env.EMAIL_SMTP_HOST),
  pass:
    normalizeText(process.env.SMTP_PASS) || normalizeText(process.env.EMAIL_SMTP_PASS),
  port: Number(process.env.SMTP_PORT || process.env.EMAIL_SMTP_PORT || 587),
  secure: normalizeFlag(process.env.SMTP_SECURE || process.env.EMAIL_SMTP_SECURE) === "true",
  user:
    normalizeText(process.env.SMTP_USER) || normalizeText(process.env.EMAIL_SMTP_USER),
});

const getVerificationTransporter = () => {
  const config = getSmtpConfig();

  if (!config.host || !config.user || !config.pass || !config.from) {
    return null;
  }

  const fingerprint = JSON.stringify(config);
  if (cachedTransporter && cachedTransporterFingerprint === fingerprint) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    auth: {
      pass: config.pass,
      user: config.user,
    },
    host: config.host,
    port: config.port,
    secure: config.secure,
  });
  cachedTransporterFingerprint = fingerprint;

  return cachedTransporter;
};

const deliverVerificationCode = async ({ email, code, expiresAt }) => {
  const transporter = getVerificationTransporter();
  const smtpConfig = getSmtpConfig();

  if (!transporter) {
    logVerificationCode({
      code,
      email,
      expiresAt,
      source: "local-dev",
    });

    return { exposedCode: shouldExposeVerificationCode() ? code : "" };
  }

  const fallbackToLocalDelivery = (reason) => {
    console.warn(`[auth] Email delivery failed: ${reason}`);
    logVerificationCode({
      code,
      email,
      expiresAt,
      source: "fallback",
    });

    return { exposedCode: shouldExposeVerificationCode() ? code : "" };
  };

  try {
    await transporter.sendMail({
      from: smtpConfig.from,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;">
          <h2 style="margin-bottom: 8px;">AgilaTrack Email Verification</h2>
          <p>Use the verification code below to continue your registration.</p>
          <p style="font-size: 28px; font-weight: 700; letter-spacing: 6px;">${code}</p>
          <p>This code expires in ${VERIFICATION_TTL_MINUTES} minutes.</p>
          <p>If you did not request this code, you can ignore this email.</p>
        </div>
      `,
      subject: "Your AgilaTrack verification code",
      text: [
        "AgilaTrack email verification",
        "",
        `Your verification code is: ${code}`,
        `This code expires in ${VERIFICATION_TTL_MINUTES} minutes.`,
        "",
        "If you did not request this code, you can ignore this email.",
      ].join("\n"),
      to: email,
    });

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
  apiKey: normalizeText(process.env.CLOUDINARY_API_KEY),
  apiSecret: normalizeText(process.env.CLOUDINARY_API_SECRET),
  cloudName: normalizeText(process.env.CLOUDINARY_CLOUD_NAME),
});

const isCloudinaryConfigured = () => {
  const config = getCloudinaryConfig();

  return Boolean(config.cloudName && config.apiKey && config.apiSecret);
};

const applyCloudinaryConfig = () => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  if (!cloudName || !apiKey || !apiSecret) {
    return false;
  }

  cloudinary.config({
    api_key: apiKey,
    api_secret: apiSecret,
    cloud_name: cloudName,
    secure: true,
  });

  return true;
};

const refreshCloudinaryConfig = () => {
  dotenv.config({ override: true, path: ENV_PATH, quiet: true });
  return applyCloudinaryConfig();
};

const getCloudinaryErrorDetails = (error) => {
  const nestedError = error?.error && typeof error.error === "object" ? error.error : null;
  const rawMessage = nestedError?.message || error?.message || "Profile upload failed";

  const message = /api key/i.test(rawMessage)
    ? `${rawMessage}. Check that CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET come from the same Cloudinary key row.`
    : rawMessage;

  return {
    code: nestedError?.http_code || error?.http_code || null,
    message,
  };
};

refreshCloudinaryConfig();

const parseProfileImageDataUrl = (source = "") => {
  const match = String(source || "")
    .trim()
    .match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/i);

  if (!match) {
    throw Object.assign(
      new Error("Profile upload expects a JPG, JPEG, PNG, or WEBP base64 image data URL."),
      { status: 400 },
    );
  }

  const mimeType = normalizeFlag(match[1]);
  if (!ALLOWED_PROFILE_MIME_TYPES.has(mimeType)) {
    throw Object.assign(
      new Error("Only JPG, JPEG, PNG, and WEBP profile images are allowed."),
      { status: 400 },
    );
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw Object.assign(new Error("Profile upload payload is empty."), {
      status: 400,
    });
  }

  if (buffer.length > MAX_PROFILE_UPLOAD_BYTES) {
    throw Object.assign(new Error("Profile images must be 10 MB or smaller."), {
      status: 400,
    });
  }

  return {
    source: `data:${mimeType};base64,${buffer.toString("base64")}`,
  };
};

const sendInvalidCredentials = (res) =>
  res.status(401).json({ error: "Invalid email or password" });

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

const isProfileComplete = (user = {}) => {
  const fullName = user?.fullName?.toObject?.() || user?.fullName || {};

  return Boolean(
    normalizeText(fullName.fname) &&
      normalizeText(fullName.lname) &&
      normalizeText(user.email) &&
      normalizeText(user.mobile),
  );
};

const buildAffiliationPlatform = (affiliation, { isMobile }) => {
  const clubId =
    affiliation?.club && typeof affiliation.club === "object"
      ? affiliation.club?._id
      : affiliation?.club;
  const primaryRole = resolvePrimaryAffiliationRole({
    affiliation,
  });

  return {
    _id: affiliation?._id || null,
    access: [],
    auxiliary: [],
    club: clubId || null,
    portal: isMobile ? MOBILE_PORTAL : "club",
    role: primaryRole,
  };
};

const buildActivePlatform = ({ user, activeAffiliation, isMobile }) => {
  const currentPlatform = user?.activePlatform || {};

  if (activeAffiliation?._id) {
    return buildAffiliationPlatform(activeAffiliation, { isMobile });
  }

  return {
    _id: currentPlatform?._id || null,
    access: [],
    auxiliary: [],
    club: currentPlatform?.club || null,
    portal: isMobile ? MOBILE_PORTAL : String(currentPlatform?.portal || "guest"),
    role: currentPlatform?.role || user?.role || null, // Preserve user role when no affiliation exists
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
    deletedAt: { $exists: false },
    status: "approved",
    user: userId,
  })
    .populate({
      path: "club",
      select: "name code abbr level location lid bid social logo management",
      populate: [
        {
          path: "management.owner.user",
          select: "fullName email mobile pid isMale",
        },
        {
          path: "management.secretary.user",
          select: "fullName email mobile pid isMale",
        },
        {
          path: "management.coordinator.user",
          select: "fullName email mobile pid isMale",
        },
      ],
    })
    .select("_id club memberCode membershipType roles status")
    .sort({ updatedAt: -1 })
    .lean({ virtuals: true });
  const clubIds = affiliations
    .map((affiliation) =>
      affiliation?.club && typeof affiliation.club === "object"
        ? String(affiliation.club?._id || "")
        : String(affiliation?.club || ""),
    )
    .filter(Boolean);
  const clubManagementRecords = clubIds.length
    ? await ClubManagement.find({
        club: { $in: clubIds },
        deletedAt: { $exists: false },
        user: userId,
      })
        .select("authorization club title")
        .lean()
    : [];
  const derivedAffiliations = hydrateAffiliationsWithDerivedRoles({
    affiliations,
    clubManagementRecords,
    userId: String(userId),
  });

  const currentPlatform = payload?.activePlatform || {};
  const activeAffiliation =
    derivedAffiliations.find(
      (affiliation) =>
        String(affiliation?._id || "") === String(currentPlatform?._id || ""),
    ) || derivedAffiliations[0] || null;

  const activePlatform = buildActivePlatform({
    activeAffiliation,
    isMobile,
    user: payload,
  });

  const normalizedAffiliations = derivedAffiliations.map((affiliation) => ({
    ...affiliation,
    activePlatform: buildAffiliationPlatform(affiliation, { isMobile }),
  }));

  return {
    activePlatform,
    affiliation: activeAffiliation,
    affiliations: normalizedAffiliations,
    schedules: [],
    token,
    user: {
      ...payload,
      activePlatform,
      profilePhoto: buildProfilePhotoUrl(payload),
    },
  };
};

const sendAuthResponse = async ({ res, userId, token = "", isMobile = false, success }) => {
  const data = await buildAuthData({ isMobile, token, userId });

  if (!data) {
    return sendInvalidCredentials(res);
  }

  return res.json({
    data,
    payload: data,
    success,
  });
};

const getRequestBaseUrl = (req) => {
  const configuredBaseUrl =
    normalizeText(process.env.PUBLIC_API_URL) ||
    normalizeText(process.env.API_PUBLIC_URL) ||
    normalizeText(process.env.SERVER_URL);

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  const host = req.get("host");
  const protocol = req.get("x-forwarded-proto") || req.protocol || "http";

  return `${protocol}://${host}`;
};

const getClientBaseUrl = (req) => {
  const configuredClientUrl =
    normalizeText(process.env.CLIENT_URL) ||
    normalizeText(process.env.FRONTEND_URL) ||
    normalizeText(process.env.WEB_APP_URL);

  if (configuredClientUrl) {
    return configuredClientUrl.replace(/\/+$/, "");
  }

  return normalizeText(req.get("origin")) || "http://localhost:5173";
};

const buildOAuthCallbackUrl = (req, provider) =>
  `${getRequestBaseUrl(req)}/api/auth/${provider}/callback`;

const redirectToConfiguredOAuthUrl = ({ envKey, res }) => {
  const configuredUrl = normalizeText(process.env[envKey]);

  if (!configuredUrl) {
    return false;
  }

  res.redirect(configuredUrl);
  return true;
};

export const redirectToGoogleOAuth = (req, res) => {
  if (redirectToConfiguredOAuthUrl({ envKey: "GOOGLE_OAUTH_URL", res })) {
    return;
  }

  const clientId =
    normalizeText(process.env.GOOGLE_CLIENT_ID) ||
    normalizeText(process.env.GOOGLE_OAUTH_CLIENT_ID);

  if (!clientId) {
    return res.redirect("https://accounts.google.com/");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    prompt: "select_account",
    redirect_uri: buildOAuthCallbackUrl(req, "google"),
    response_type: "code",
    scope: "openid email profile",
    state: "agilatrack-google",
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
};

export const redirectToFacebookOAuth = (req, res) => {
  if (redirectToConfiguredOAuthUrl({ envKey: "FACEBOOK_OAUTH_URL", res })) {
    return;
  }

  const clientId =
    normalizeText(process.env.FACEBOOK_CLIENT_ID) ||
    normalizeText(process.env.FACEBOOK_APP_ID);

  if (!clientId) {
    return res.redirect("https://www.facebook.com/login/");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: buildOAuthCallbackUrl(req, "facebook"),
    response_type: "code",
    scope: "email,public_profile",
    state: "agilatrack-facebook",
  });

  return res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
};

export const oauthCallbackPlaceholder = (provider) => (req, res) => {
  const callbackUrl = new URL(getClientBaseUrl(req));

  callbackUrl.searchParams.set("oauth", provider);
  callbackUrl.searchParams.set("status", "pending_backend_connection");

  return res.redirect(callbackUrl.toString());
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
    isMobile: normalizeFlag(req.query?.platform || req.headers["x-platform"]) === "mobile",
    res,
    success,
    token,
    userId: session.userId,
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

    const token = issueSessionToken(user._id, { role: user.role });

    return sendAuthResponse({
      isMobile: normalizeFlag(req.body?.platform || req.query?.platform) === "mobile",
      res,
      success: "Login successful",
      token,
      userId: user._id,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Login failed" });
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
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const existingVerification = await EmailVerifications.findOne({ email });
    const cooldownSeconds = getVerificationCooldownRemainingSeconds(existingVerification);
    if (cooldownSeconds > 0) {
      return res.status(429).json({
        error: `Please wait ${cooldownSeconds} seconds before requesting another code.`,
      });
    }

    const code = generateVerificationCode();
    const expiresAt = getVerificationExpiry();

    await EmailVerifications.findOneAndUpdate(
      { email },
      {
        attempts: 0,
        codeHash: hashEmailVerificationCode({ code, email }),
        email,
        expiresAt,
        lastSentAt: new Date(),
        verifiedAt: null,
      },
      {
        new: true,
        setDefaultsOnInsert: true,
        upsert: true,
      },
    );

    const delivery = await deliverVerificationCode({ code, email, expiresAt });

    return res.json({
      payload: {
        cooldownSeconds: VERIFICATION_RESEND_COOLDOWN_SECONDS,
        email,
        expiresAt: expiresAt.toISOString(),
        isEmailVerified: false,
      },
      success: buildVerificationSuccessMessage({
        email,
        exposedCode: delivery.exposedCode,
      }),
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
      return res.status(400).json({
        error: `Enter the ${VERIFICATION_CODE_LENGTH}-digit verification code.`,
      });
    }

    const verification = await EmailVerifications.findOne({ email });
    if (!verification) {
      return res.status(400).json({ error: "Send a verification code first." });
    }

    if (verification.expiresAt.getTime() <= Date.now()) {
      await verification.deleteOne();

      return res.status(410).json({
        error: "Verification code expired. Request a new code.",
      });
    }

    if (Number(verification.attempts || 0) >= MAX_VERIFICATION_ATTEMPTS) {
      return res.status(429).json({
        error: "Too many invalid verification attempts. Request a new code.",
      });
    }

    const codeHash = hashEmailVerificationCode({ code, email });
    if (verification.codeHash !== codeHash) {
      verification.attempts = Number(verification.attempts || 0) + 1;
      await verification.save();

      return res.status(400).json({
        error: "Invalid verification code. Try again or resend a new code.",
      });
    }

    verification.attempts = 0;
    verification.verifiedAt = new Date();
    await verification.save();

    return res.json({
      payload: {
        email,
        expiresAt: verification.expiresAt.toISOString(),
        isEmailVerified: true,
      },
      success: "Email verified successfully.",
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
      return res.status(400).json({
        error: "Username must be at least 4 characters long.",
      });
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

      return res.status(410).json({
        error: "Verification code expired. Request a new code.",
      });
    }

    const existingUser = await Users.findOne({
      $or: [{ email }, { username }],
    })
      .select("_id email username")
      .lean();

    if (existingUser?._id) {
      if (existingUser.email === email) {
        return res.status(409).json({ error: "An account with this email already exists." });
      }

      return res.status(409).json({ error: "This username is already taken." });
    }

    const user = await Users.create({
      activePlatform: {
        _id: null,
        access: [],
        club: null,
        portal: MOBILE_PORTAL,
        role: null,
      },
      email,
      emailVerifiedAt: verification.verifiedAt,
      fullName: {
        ...(mname ? { mname } : {}),
        fname,
        lname,
      },
      isEmailVerified: true,
      membership,
      membershipStatus: "guest",
      mobile,
      password,
      profileCompleted: false,
      role: "guest", // Always force role to guest for public registration
      state,
      username,
      // Explicitly ignore any role from request body - public registration is guest only
    });

    await verification.deleteOne();

    return res.status(201).json({
      payload: {
        _id: user._id,
        email: user.email,
        isEmailVerified: user.isEmailVerified,
        username: user.username,
      },
      success: "Registration completed successfully.",
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
    const session = verifySessionToken(getTokenFromRequest(req));
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
          access: [],
          club: null,
          portal: String(req.body.activePlatform?.portal || "guest").trim().toLowerCase(),
          role: null,
        };
      } else {
        const affiliation = await Affiliations.findOne({
          _id: requestedAffiliationId,
          deletedAt: { $exists: false },
          status: "approved",
          user: user._id,
        })
          .select("_id club roles")
          .lean();

        if (!affiliation?._id) {
          return res.status(404).json({ error: "Affiliation not found" });
        }

        user.activePlatform = {
          ...(user.activePlatform?.toObject?.() || user.activePlatform || {}),
          _id: affiliation._id,
          access: [],
          club: affiliation.club || null,
          portal: String(req.body.activePlatform?.portal || "guest").trim().toLowerCase(),
          role: Array.isArray(affiliation.roles) ? affiliation.roles : [],
        };
      }
    }

    if (isProfileComplete(user)) {
      user.profileCompleted = true;
    }

    await user.save();

    return sendAuthResponse({
      isMobile:
        normalizeFlag(req.body?.platform || req.query?.platform) === "mobile" ||
        normalizeFlag(req.body?.activePlatform?.portal) === MOBILE_PORTAL,
      res,
      success: "Auth updated",
      token: getTokenFromRequest(req),
      userId: user._id,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Auth update failed" });
  }
};

export const uploadProfile = async (req, res) => {
  try {
    const cloudinaryReady = refreshCloudinaryConfig();
    if (!cloudinaryReady || !isCloudinaryConfigured()) {
      return res.status(500).json({
        error: "Cloudinary is not configured on the server.",
        message:
          "Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to server/.env.",
      });
    }

    const session = verifySessionToken(getTokenFromRequest(req));
    if (!session?.userId) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const user = await Users.findById(session.userId);
    if (!user || user.isActive === false) {
      return res.status(404).json({ error: "User not found" });
    }

    const parsedImage = parseProfileImageDataUrl(req.body?.source);
    const safeEmail = encodePathSegment(user.email);
    const uploadResult = await cloudinary.uploader.upload(parsedImage.source, {
      folder: `users/${safeEmail}`,
      invalidate: true,
      overwrite: true,
      public_id: "profile",
      resource_type: "image",
    });

    user.files = {
      ...(user.files?.toObject?.() || user.files || {}),
      profile: uploadResult.version ? String(uploadResult.version) : uploadResult.asset_id,
    };
    user.pid = uploadResult.version
      ? String(uploadResult.version)
      : uploadResult.asset_id;
    user.profilePhoto = uploadResult.secure_url;
    user.profile = {
      ...(user.profile?.toObject?.() || user.profile || {}),
      at: new Date(),
    };
    await user.save();

    return res.status(201).json({
      imgId: user.pid,
      payload: {
        imgId: user.pid,
        profile: user.pid,
        publicId: uploadResult.public_id,
        source: uploadResult.secure_url,
      },
      success: "Profile photo uploaded successfully",
    });
  } catch (error) {
    const status = Number(error?.status || 500);
    const details = getCloudinaryErrorDetails(error);

    return res.status(status).json({
      ...(details.code ? { code: details.code } : {}),
      error: details.message,
    });
  }
};
