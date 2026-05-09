import mongoose from "mongoose";

import TenantAccessLogs from "../models/TenantAccessLogs.js";
import { normalizeClubRoleLabel } from "../utils/clubRoles.js";
import { normalizeText } from "../utils/auth.js";
import { canAccessClubWorkspace, canManageClubWorkspace, hasGlobalTenantAccess } from "./sessionAuth.js";

const MANAGER_ROLE_LABELS = new Set(["owner", "secretary", "operator"]);

export const normalizeTenantId = (value = "") =>
  value && typeof value === "object"
    ? normalizeText(value._id || value.id || value.toString?.() || "")
    : normalizeText(value);

const getClientIp = (req) =>
  normalizeText(req.headers["x-forwarded-for"]).split(",")[0]?.trim() ||
  normalizeText(req.ip) ||
  normalizeText(req.socket?.remoteAddress);

const getAffiliationRoles = (affiliation = {}) =>
  [
    ...(Array.isArray(affiliation?.roles) ? affiliation.roles : []),
    affiliation?.membershipType,
  ]
    .map((role) => normalizeClubRoleLabel(role))
    .filter(Boolean);

export const isTenantSuperAdmin = (auth = {}) => hasGlobalTenantAccess(auth);

export const getAccessibleClubIds = (auth = {}) => {
  if (isTenantSuperAdmin(auth)) {
    return [];
  }

  return Array.from(
    new Set(
      [
        auth?.user?.clubId,
        auth?.user?.activePlatform?.club,
        ...(Array.isArray(auth?.affiliations)
          ? auth.affiliations.map((affiliation) => affiliation?.club)
          : []),
      ]
        .map(normalizeTenantId)
        .filter(Boolean),
    ),
  );
};

export const getPrimaryTenantClubId = (auth = {}) =>
  normalizeTenantId(auth?.user?.clubId) ||
  normalizeTenantId(auth?.user?.activePlatform?.club) ||
  getAccessibleClubIds(auth)[0] ||
  "";

export const canAccessTenantClub = (auth = {}, clubId = "") =>
  canAccessClubWorkspace(auth, normalizeTenantId(clubId));

export const canManageTenantClub = (auth = {}, clubId = "") =>
  canManageClubWorkspace(auth, normalizeTenantId(clubId));

export const canManageTenantAffiliation = (auth = {}, clubId = "") => {
  const normalizedClubId = normalizeTenantId(clubId);

  if (!normalizedClubId) {
    return false;
  }

  if (isTenantSuperAdmin(auth)) {
    return true;
  }

  return (Array.isArray(auth.affiliations) ? auth.affiliations : []).some((affiliation) => {
    const affiliationClubId = normalizeTenantId(affiliation?.club);

    return (
      affiliationClubId === normalizedClubId &&
      getAffiliationRoles(affiliation).some((role) => MANAGER_ROLE_LABELS.has(role))
    );
  });
};

export const logTenantAccessAttempt = async (
  req,
  { action = "blocked_cross_club_access", attemptedClubId = "", reason = "" } = {},
) => {
  try {
    await TenantAccessLogs.create({
      action,
      attemptedClubId: normalizeTenantId(attemptedClubId),
      endpoint: req.originalUrl || req.url,
      ip: getClientIp(req),
      method: req.method,
      reason,
      role: [
        req.auth?.user?.role,
        ...(Array.isArray(req.auth?.roleLabels) ? req.auth.roleLabels : []),
      ]
        .map(normalizeText)
        .filter(Boolean)
        .join(", "),
      user: mongoose.Types.ObjectId.isValid(req.auth?.userId) ? req.auth.userId : undefined,
      userAgent: normalizeText(req.headers["user-agent"]).slice(0, 260),
    });
  } catch {
    // Audit logging must not mask the access-control decision.
  }
};

export const denyTenantAccess = async (
  req,
  res,
  {
    attemptedClubId = "",
    message = "You do not have access to this club scope.",
    reason = "Cross-club access attempt was blocked.",
  } = {},
) => {
  await logTenantAccessAttempt(req, { attemptedClubId, reason });

  return res.status(403).json({
    error: message,
    message,
    success: false,
  });
};

export const scopeQueryToTenant = async (
  req,
  res,
  dbQuery,
  { field = "club", requestedClubId = "" } = {},
) => {
  const normalizedRequestedClubId = normalizeTenantId(requestedClubId || dbQuery[field]);

  if (isTenantSuperAdmin(req.auth)) {
    if (normalizedRequestedClubId) {
      dbQuery[field] = normalizedRequestedClubId;
    }

    return true;
  }

  const accessibleClubIds = getAccessibleClubIds(req.auth);

  if (normalizedRequestedClubId) {
    if (!canAccessTenantClub(req.auth, normalizedRequestedClubId)) {
      await denyTenantAccess(req, res, {
        attemptedClubId: normalizedRequestedClubId,
        reason: `Requested ${field} is outside the authenticated user's club scope.`,
      });
      return false;
    }

    dbQuery[field] = normalizedRequestedClubId;
    return true;
  }

  dbQuery[field] = accessibleClubIds.length ? { $in: accessibleClubIds } : { $in: [] };
  return true;
};

export const resolveTenantClubId = async (
  req,
  res,
  { requestedClubId = "", requireClub = true } = {},
) => {
  const normalizedRequestedClubId = normalizeTenantId(requestedClubId);

  if (isTenantSuperAdmin(req.auth)) {
    return normalizedRequestedClubId;
  }

  if (normalizedRequestedClubId) {
    if (!canAccessTenantClub(req.auth, normalizedRequestedClubId)) {
      await denyTenantAccess(req, res, {
        attemptedClubId: normalizedRequestedClubId,
        reason: "Requested club is outside the authenticated user's tenant.",
      });
      return null;
    }

    return normalizedRequestedClubId;
  }

  const primaryClubId = getPrimaryTenantClubId(req.auth);

  if (!primaryClubId && requireClub) {
    await denyTenantAccess(req, res, {
      reason: "No club is assigned to the authenticated user.",
    });
    return null;
  }

  return primaryClubId;
};

export const requireSameClub =
  ({ param = "clubId", manage = false } = {}) =>
  async (req, res, next) => {
    const clubId = normalizeTenantId(req.params?.[param] || req.query?.[param] || req.body?.[param]);
    const allowed = manage
      ? canManageTenantClub(req.auth, clubId)
      : canAccessTenantClub(req.auth, clubId);

    if (!allowed) {
      return denyTenantAccess(req, res, {
        attemptedClubId: clubId,
        reason: "Route club parameter is outside the authenticated user's tenant.",
      });
    }

    return next();
  };
