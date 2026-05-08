import jwt from "jsonwebtoken";

import ClubManagement from "../models/ClubManagement.js";
import Clubs from "../models/Clubs.js";
import OwnerAuditLogs from "../models/OwnerAuditLogs.js";
import Users from "../models/Users.js";
import {
  buildOrdersPayload,
  buildPaymentsPayload,
  buildPayoutsPayload,
  buildProductsPayload,
} from "./liveOps.js";
import { normalizeClubRoleLabel } from "../utils/clubRoles.js";
import {
  AUTH_TOKEN_AUDIENCE,
  AUTH_TOKEN_ISSUER,
  getAuthTokenSecret,
  normalizeText,
} from "../utils/auth.js";

export const OWNER_ZONE_REAUTH_TTL_SECONDS = Number(
  process.env.OWNER_ZONE_REAUTH_TTL_SECONDS || 5 * 60,
);

class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const getClientIp = (req) =>
  normalizeText(req.headers["x-forwarded-for"]).split(",")[0]?.trim() ||
  normalizeText(req.ip) ||
  normalizeText(req.socket?.remoteAddress);

const getDeviceId = (req) => normalizeText(req.headers["x-device-id"]);

const getOwnerZoneToken = (req) => normalizeText(req.headers["x-owner-zone-token"]);

const resolveObjectId = (value = "") =>
  value && typeof value === "object" ? normalizeText(value._id) : normalizeText(value);

const resolveAffiliationClubId = (affiliation = {}) =>
  resolveObjectId(affiliation?.club);

const getRoleValues = (affiliation = {}) => [
  ...(Array.isArray(affiliation?.roles) ? affiliation.roles : []),
  affiliation?.membershipType,
];

const hasOwnerRole = (values = []) =>
  values.some((value) => normalizeText(value) === "11" || normalizeClubRoleLabel(value) === "owner");

const isOwnerAffiliationForClub = (auth = {}, clubId = "") =>
  (Array.isArray(auth.affiliations) ? auth.affiliations : []).some(
    (affiliation) =>
      resolveAffiliationClubId(affiliation) === clubId &&
      hasOwnerRole(getRoleValues(affiliation)),
  );

const findOwnedClub = async ({ clubId, userId }) => {
  const [club, ownerManagementRecord] = await Promise.all([
    Clubs.findOne({
      _id: clubId,
      deletedAt: { $exists: false },
    })
      .select("abbr management.owner.user name")
      .lean(),
    ClubManagement.findOne({
      club: clubId,
      deletedAt: { $exists: false },
      user: userId,
      $or: [{ title: /owner/i }, { authorization: /owner/i }],
    })
      .select("_id")
      .lean(),
  ]);

  if (!club) {
    throw new HttpError("Club scope was not found.", 404);
  }

  const managementOwnerId = resolveObjectId(club?.management?.owner?.user);
  const isManagementOwner = Boolean(
    managementOwnerId && managementOwnerId === normalizeText(userId),
  );

  return {
    club,
    isOwner: isManagementOwner || Boolean(ownerManagementRecord),
  };
};

const assertClubOwner = async (req) => {
  const clubId = normalizeText(req.params?.clubId);
  const userId = normalizeText(req.auth?.userId);

  if (!userId) {
    throw new HttpError("Authentication is required for owner-zone access.", 401);
  }

  const { club, isOwner: isManagementOwner } = await findOwnedClub({ clubId, userId });
  const isAffiliationOwner = isOwnerAffiliationForClub(req.auth, clubId);

  if (!isManagementOwner && !isAffiliationOwner) {
    throw new HttpError("Only the verified owner of this club can access this zone.", 403);
  }

  return club;
};

const issueOwnerZoneToken = ({ clubId, deviceId, userId }) =>
  jwt.sign(
    {
      clubId,
      deviceId,
      purpose: "owner-zone",
      userId,
    },
    getAuthTokenSecret(),
    {
      audience: AUTH_TOKEN_AUDIENCE,
      expiresIn: OWNER_ZONE_REAUTH_TTL_SECONDS,
      issuer: AUTH_TOKEN_ISSUER,
      subject: String(userId),
    },
  );

const verifyOwnerZoneToken = (req) => {
  const token = getOwnerZoneToken(req);

  if (!token) {
    throw new HttpError("Owner re-authentication is required.", 401);
  }

  try {
    const payload = jwt.verify(token, getAuthTokenSecret(), {
      audience: AUTH_TOKEN_AUDIENCE,
      issuer: AUTH_TOKEN_ISSUER,
    });
    const requestDeviceId = getDeviceId(req);
    const payloadDeviceId = normalizeText(payload?.deviceId);

    if (payload?.purpose !== "owner-zone") {
      throw new Error("Invalid owner-zone token purpose.");
    }

    if (normalizeText(payload?.userId || payload?.sub) !== normalizeText(req.auth?.userId)) {
      throw new Error("Owner-zone token does not match the current user.");
    }

    if (normalizeText(payload?.clubId) !== normalizeText(req.params?.clubId)) {
      throw new Error("Owner-zone token does not match the active club.");
    }

    if (payloadDeviceId && payloadDeviceId !== requestDeviceId) {
      throw new Error("Owner-zone token does not match this device.");
    }

    return payload;
  } catch (error) {
    throw new HttpError(error.message || "Owner-zone session expired.", 401);
  }
};

const formatName = (user = {}) =>
  [
    user?.fullName?.fname,
    user?.fullName?.mname,
    user?.fullName?.lname,
    user?.fullName?.suffix,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim() ||
  normalizeText(user?.name) ||
  normalizeText(user?.email) ||
  "Club owner";

const formatAuditLog = (log = {}) => ({
  action: normalizeText(log.action),
  device: normalizeText(log.device) || "Unknown device",
  id: String(log._id || ""),
  ip: normalizeText(log.ip),
  operator:
    log.operator && typeof log.operator === "object"
      ? formatName(log.operator)
      : "Club owner",
  reason: normalizeText(log.reason),
  target: normalizeText(log.target),
  timestamp: log.createdAt || log.updatedAt || new Date().toISOString(),
});

const createAuditLog = async ({
  action,
  clubId,
  metadata,
  reason,
  req,
  target,
  userId,
}) => {
  const log = await OwnerAuditLogs.create({
    action: normalizeText(action) || "Owner Action",
    club: clubId,
    device: getDeviceId(req) || normalizeText(req.headers["user-agent"]).slice(0, 180),
    ip: getClientIp(req),
    metadata,
    operator: userId,
    reason: normalizeText(reason),
    target: normalizeText(target),
  });

  return log.populate("operator", "email fullName");
};

const fetchAuditLogs = async (clubId) =>
  OwnerAuditLogs.find({ club: clubId })
    .populate("operator", "email fullName")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean({ virtuals: true });

const collectDataset = async (key, loader) => {
  try {
    return { data: await loader(), key };
  } catch (error) {
    return {
      error: error.message || "Unable to load owner-zone data.",
      key,
    };
  }
};

export const requireVerifiedOwnerZone = async (req, res, next) => {
  try {
    const club = await assertClubOwner(req);
    const tokenPayload = verifyOwnerZoneToken(req);

    req.ownerZone = {
      club,
      tokenPayload,
    };

    return next();
  } catch (error) {
    return res.status(error.status || 403).json({
      error: error.message || "Owner-zone access denied.",
    });
  }
};

export const verifyOwnerZone = async (req, res) => {
  try {
    const clubId = normalizeText(req.params?.clubId);
    const userId = normalizeText(req.auth?.userId);
    const password = String(req.body?.password || "");
    const club = await assertClubOwner(req);

    if (!password) {
      return res.status(400).json({
        error: "Owner password is required. PIN and OTP are prepared for a future backend method.",
      });
    }

    const user = await Users.findById(userId).select("email fullName isActive password");

    if (!user || user.isActive === false) {
      return res.status(401).json({ error: "Owner account is no longer active." });
    }

    const passwordMatches = await user.matchPassword(password);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid owner credentials." });
    }

    const deviceId = getDeviceId(req);
    const ownerZoneToken = issueOwnerZoneToken({
      clubId,
      deviceId,
      userId,
    });
    const expiresAt = new Date(Date.now() + OWNER_ZONE_REAUTH_TTL_SECONDS * 1000).toISOString();

    const auditLog = await createAuditLog({
      action: "Owner Zone Verification",
      clubId,
      metadata: { event: "reauthentication" },
      reason: "Owner password verified before finance and e-commerce access.",
      req,
      target: club.name || club.abbr || clubId,
      userId,
    });

    return res.json({
      payload: {
        auditLog: formatAuditLog(auditLog),
        club: {
          _id: String(club._id),
          name: club.name || club.abbr || "Club",
        },
        expiresAt,
        ownerZoneToken,
        verifiedAt: new Date().toISOString(),
      },
      success: "Owner-zone verification successful",
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: error.message || "Owner-zone verification failed.",
    });
  }
};

export const getOwnerZoneSnapshot = async (req, res) => {
  const clubId = normalizeText(req.params?.clubId);

  const [paymentsResult, payoutsResult, productsResult, ordersResult, auditLogsResult] =
    await Promise.all([
      collectDataset("payments", () => buildPaymentsPayload({ clubId })),
      collectDataset("payouts", () => buildPayoutsPayload({ clubId })),
      collectDataset("products", () => buildProductsPayload({ clubId })),
      collectDataset("orders", () => buildOrdersPayload({ clubId })),
      collectDataset("auditLogs", () => fetchAuditLogs(clubId)),
    ]);

  const payload = {
    auditLogs: [],
    errors: {},
    orders: [],
    payments: [],
    payouts: [],
    products: [],
  };

  [paymentsResult, payoutsResult, productsResult, ordersResult].forEach((result) => {
    if ("error" in result) {
      payload.errors[result.key] = result.error;
      return;
    }

    payload[result.key] = result.data;
  });

  if ("error" in auditLogsResult) {
    payload.errors.auditLogs = auditLogsResult.error;
  } else {
    payload.auditLogs = auditLogsResult.data.map(formatAuditLog);
  }

  return res.json({
    payload,
    success: "Owner-zone snapshot fetched successfully",
  });
};

export const getOwnerAuditLogs = async (req, res) => {
  try {
    const clubId = normalizeText(req.params?.clubId);
    const logs = await fetchAuditLogs(clubId);

    return res.json({
      payload: logs.map(formatAuditLog),
      success: "Owner audit logs fetched successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to fetch owner audit logs.",
    });
  }
};

export const createOwnerAuditLog = async (req, res) => {
  try {
    const clubId = normalizeText(req.params?.clubId);
    const userId = normalizeText(req.auth?.userId);
    const action = normalizeText(req.body?.action);
    const reason = normalizeText(req.body?.reason);
    const target = normalizeText(req.body?.target);

    if (!reason) {
      return res.status(400).json({
        error: "Reason is required for owner-zone audit logging.",
      });
    }

    const log = await createAuditLog({
      action: action || "Owner Action",
      clubId,
      metadata: {
        kind: normalizeText(req.body?.kind),
      },
      reason,
      req,
      target,
      userId,
    });

    return res.status(201).json({
      payload: formatAuditLog(log),
      success: "Owner audit log recorded successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to record owner audit log.",
    });
  }
};
