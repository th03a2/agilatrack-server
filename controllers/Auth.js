import crypto from "node:crypto";
import Users from "../models/Users.js";
import Affiliations from "../models/Affiliations.js";

const USER_SELECT =
  "_id email fullName activePlatform membership state mobile isMale pid files profile isActive createdAt updatedAt";
const MOBILE_PORTAL = "guest";
const AUTH_TOKEN_SECRET =
  process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || "agilatrack-dev-secret";
const AUTH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const sendInvalidCredentials = (res) =>
  res.status(401).json({ error: "Invalid email or password" });

const toBase64Url = (value) => Buffer.from(value).toString("base64url");

const fromBase64Url = (value) => Buffer.from(value, "base64url").toString("utf8");

const signTokenPayload = (payload) =>
  crypto
    .createHmac("sha256", AUTH_TOKEN_SECRET)
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

const buildAffiliationPlatform = (affiliation, { isMobile }) => {
  const clubId =
    affiliation?.club && typeof affiliation.club === "object"
      ? affiliation.club?._id
      : affiliation?.club;

  return {
    _id: affiliation?._id || null,
    club: clubId || null,
    role: null,
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
    .populate("club", "name code abbr level location")
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

export const login = async (req, res) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
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
      isMobile: String(req.body?.platform || req.query?.platform || "")
        .trim()
        .toLowerCase() === "mobile",
      success: "Login successful",
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Login failed" });
  }
};

export const validateRefresh = async (req, res) => {
  try {
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
      isMobile: String(req.query?.platform || req.headers["x-platform"] || "")
        .trim()
        .toLowerCase() === "mobile",
      success: "Session validated",
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Refresh validation failed" });
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
      isMobile: String(req.body?.platform || req.query?.platform || "")
        .trim()
        .toLowerCase() === "mobile" ||
        String(req.body?.activePlatform?.portal || "").trim().toLowerCase() ===
          MOBILE_PORTAL,
      success: "Auth updated",
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Auth update failed" });
  }
};
