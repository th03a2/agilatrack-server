import Affiliations from "../models/Affiliations.js";
import ClubManagement from "../models/ClubManagement.js";
import Users from "../models/Users.js";
import { hydrateAffiliationsWithDerivedRoles } from "../utils/clubRoles.js";
import {
  getTokenFromRequest,
  normalizeFlag,
  normalizeText,
  verifySessionToken,
} from "../utils/auth.js";

const ROLE_ALIASES = {
  "appeals committee": "platform_admin",
  "assistant admin": "member",
  "basketing officer": "operator",
  "booking officer": "operator",
  "cashier": "finance",
  "check in officer": "operator",
  "check-in officer": "operator",
  "club owner": "owner",
  "club secretary": "secretary",
  "club staff": "member",
  "club system admin": "platform_admin",
  "clocking officer": "operator",
  "compliance officer": "platform_admin",
  convoyer: "operator",
  "data encoder": "member",
  "entry validator": "operator",
  fancier: "member",
  "federation president": "platform_admin",
  "federation secretary": "platform_admin",
  "finance manager": "finance",
  guest: "guest",
  "health records officer": "member",
  "inventory officer": "ecommerce",
  "liberation officer": "operator",
  "loft owner": "member",
  "loft registrar": "member",
  "marketplace admin": "ecommerce",
  "marketplace customer": "ecommerce",
  member: "member",
  operator: "operator",
  organizer: "operator",
  owner: "owner",
  "operators coordinator": "operator",
  "operators director": "operator",
  "operators secretary": "operator",
  "order fulfillment officer": "ecommerce",
  "payment verifier": "finance",
  "pedigree encoder": "member",
  "pigeon registrar": "member",
  "prize fund officer": "finance",
  "race participant": "member",
  racer: "member",
  "regular member": "member",
  "race results officer": "operator",
  "regional coordinator": "platform_admin",
  secretary: "secretary",
  seller: "ecommerce",
  "shipping coordinator": "ecommerce",
  "shop manager": "ecommerce",
  "system administrator": "platform_admin",
  "technical support": "platform_admin",
  vendor: "ecommerce",
};

const FINANCE_ROLE_LABELS = new Set([
  "cashier",
  "finance manager",
  "payment verifier",
  "prize fund officer",
]);

const ECOMMERCE_ROLE_LABELS = new Set([
  "inventory officer",
  "marketplace admin",
  "marketplace customer",
  "order fulfillment officer",
  "seller",
  "shipping coordinator",
  "shop manager",
  "vendor",
]);

const PLATFORM_ADMIN_ROLE_LABELS = new Set([
  "appeals committee",
  "club system admin",
  "compliance officer",
  "federation president",
  "federation secretary",
  "regional coordinator",
  "system administrator",
  "technical support",
]);

const normalizeRole = (value = "") =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

const normalizeRoleBucket = (value = "") => {
  const normalizedRole = normalizeRole(value);
  return ROLE_ALIASES[normalizedRole] || normalizedRole || "guest";
};

const extractRoleLabels = (affiliations = []) =>
  Array.from(
    new Set(
      affiliations.flatMap((affiliation) =>
        [
          ...(Array.isArray(affiliation?.roles) ? affiliation.roles : []),
          affiliation?.membershipType,
        ]
          .map((value) => normalizeRole(value))
          .filter(Boolean),
      ),
    ),
  );

const extractRoleBuckets = (roleLabels = []) =>
  Array.from(new Set(roleLabels.map((value) => normalizeRoleBucket(value)).filter(Boolean)));

const extractPermissions = ({ roleBuckets = [], roleLabels = [] } = {}) => {
  const permissions = new Set(["profile:self"]);

  if (roleBuckets.includes("member")) {
    permissions.add("club:access");
    permissions.add("communications:read");
    permissions.add("records:self");
    permissions.add("races:read");
  }

  if (roleBuckets.some((bucket) => ["owner", "secretary"].includes(bucket))) {
    permissions.add("club:manage");
    permissions.add("communications:manage");
    permissions.add("join_requests:manage");
    permissions.add("members:manage");
    permissions.add("races:manage");
  }

  if (roleBuckets.includes("operator")) {
    permissions.add("club:access");
    permissions.add("communications:read");
    permissions.add("crates:manage");
    permissions.add("operations:manage");
    permissions.add("races:manage");
  }

  if (
    roleBuckets.includes("finance") ||
    roleLabels.some((role) => FINANCE_ROLE_LABELS.has(role))
  ) {
    permissions.add("finance:manage");
  }

  if (
    roleBuckets.includes("ecommerce") ||
    roleLabels.some((role) => ECOMMERCE_ROLE_LABELS.has(role))
  ) {
    permissions.add("ecommerce:manage");
  }

  if (
    roleBuckets.includes("platform_admin") ||
    roleLabels.some((role) => PLATFORM_ADMIN_ROLE_LABELS.has(role))
  ) {
    permissions.add("admin:manage");
    permissions.add("portal_state:manage");
  }

  if (
    permissions.has("club:manage") ||
    permissions.has("finance:manage") ||
    permissions.has("ecommerce:manage") ||
    permissions.has("operations:manage") ||
    permissions.has("admin:manage")
  ) {
    permissions.add("dashboard:live_ops");
  }

  return Array.from(permissions);
};

export function hasPrivilegedDirectoryAccess(auth = {}) {
  const roleBuckets = Array.isArray(auth.roleBuckets) ? auth.roleBuckets : [];
  const permissions = Array.isArray(auth.permissions) ? auth.permissions : [];

  return (
    roleBuckets.some((bucket) =>
      ["owner", "operator", "platform_admin", "secretary"].includes(bucket),
    ) ||
    permissions.includes("members:manage") ||
    permissions.includes("admin:manage")
  );
}

export function canAccessUserRecord(auth = {}, targetUserId = "") {
  if (!targetUserId) {
    return false;
  }

  return (
    String(auth.userId || "") === String(targetUserId) ||
    hasPrivilegedDirectoryAccess(auth)
  );
}

export function hasPermission(auth = {}, permission = "") {
  const normalizedPermission = normalizeText(permission);
  const permissions = Array.isArray(auth.permissions) ? auth.permissions : [];
  return normalizedPermission ? permissions.includes(normalizedPermission) : false;
}

export function hasRoleBucket(auth = {}, bucket = "") {
  const normalizedBucket = normalizeFlag(bucket);
  const roleBuckets = Array.isArray(auth.roleBuckets) ? auth.roleBuckets : [];
  return normalizedBucket ? roleBuckets.includes(normalizedBucket) : false;
}

const GLOBAL_TENANT_ADMIN_LABELS = new Set([
  "admin",
  "appeals committee",
  "compliance officer",
  "federation president",
  "federation secretary",
  "regional coordinator",
  "system administrator",
]);

const resolveId = (value = "") =>
  value && typeof value === "object"
    ? normalizeText(value._id || value.id || value.toString?.() || "")
    : normalizeText(value);

const getAffiliationClubId = (affiliation = {}) => resolveId(affiliation?.club);

const getAuthUserClubIds = (auth = {}) =>
  [
    auth?.user?.clubId,
    auth?.user?.activePlatform?.club,
    ...(Array.isArray(auth?.affiliations)
      ? auth.affiliations.map((affiliation) => affiliation?.club)
      : []),
  ]
    .map(resolveId)
    .filter(Boolean);

export function hasGlobalTenantAccess(auth = {}) {
  const roleLabels = Array.isArray(auth.roleLabels) ? auth.roleLabels : [];
  const labels = [auth?.user?.role, ...roleLabels].map((value) => normalizeRole(value));

  return labels.some((label) => GLOBAL_TENANT_ADMIN_LABELS.has(label));
}

export function canAccessClubWorkspace(auth = {}, clubId = "") {
  const normalizedClubId = normalizeText(clubId);

  if (!normalizedClubId) {
    return false;
  }

  if (hasGlobalTenantAccess(auth)) {
    return true;
  }

  return getAuthUserClubIds(auth).some((candidateClubId) => candidateClubId === normalizedClubId);
}

export function canManageClubWorkspace(auth = {}, clubId = "") {
  const normalizedClubId = normalizeText(clubId);

  if (!normalizedClubId) {
    return false;
  }

  if (hasGlobalTenantAccess(auth)) {
    return true;
  }

  return (Array.isArray(auth.affiliations) ? auth.affiliations : []).some((affiliation) => {
    const affiliationClub = getAffiliationClubId(affiliation);
    const roleLabels = [
      ...(Array.isArray(affiliation?.roles) ? affiliation.roles : []),
      affiliation?.membershipType,
    ].map((value) => normalizeRoleBucket(value));

    return (
      String(affiliationClub || "") === normalizedClubId &&
      roleLabels.some((bucket) => ["owner", "operator", "secretary"].includes(bucket))
    );
  });
}

export async function optionalSessionUser(req, res, next) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return next();
  }

  return requireSessionUser(req, res, next);
}

export async function requireSessionUser(req, res, next) {
  try {
    const session = verifySessionToken(getTokenFromRequest(req));

    if (!session?.userId) {
      return res.status(401).json({ error: "Invalid or expired session" });
    }

    const user = await Users.findById(session.userId)
      .select("-password -__v")
      .lean({ virtuals: true });

    if (!user || user.isActive === false) {
      return res.status(401).json({ error: "User session is no longer active" });
    }

    const affiliations = await Affiliations.find({
      user: user._id,
      deletedAt: { $exists: false },
      status: "approved",
    })
      .populate({
        path: "club",
        select: "management",
        populate: [
          { path: "management.owner.user", select: "_id" },
          { path: "management.secretary.user", select: "_id" },
          { path: "management.coordinator.user", select: "_id" },
        ],
      })
      .select("_id club roles membershipType status")
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
          user: user._id,
        })
          .select("authorization club title")
          .lean()
      : [];
    const derivedAffiliations = hydrateAffiliationsWithDerivedRoles({
      affiliations,
      clubManagementRecords,
      userId: String(user._id),
    });

    const roleLabels = Array.from(
      new Set([
        ...extractRoleLabels(derivedAffiliations),
        normalizeRole(user?.role),
      ].filter(Boolean)),
    );
    const roleBuckets = extractRoleBuckets(roleLabels);
    const permissions = extractPermissions({ roleBuckets, roleLabels });

    req.auth = {
      affiliations: derivedAffiliations,
      permissions,
      roleBuckets,
      roleLabels,
      session,
      user,
      userId: String(user._id),
    };

    return next();
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to verify the current session.",
    });
  }
}

export const requireAnyRoleBucket = (...acceptedBuckets) => (req, res, next) => {
  if (acceptedBuckets.some((bucket) => hasRoleBucket(req.auth, bucket))) {
    return next();
  }

  return res.status(403).json({
    error: "You do not have access to this role-restricted action.",
  });
};

export const requireAnyPermission = (...acceptedPermissions) => (req, res, next) => {
  if (acceptedPermissions.some((permission) => hasPermission(req.auth, permission))) {
    return next();
  }

  return res.status(403).json({
    error: "You do not have permission to access this resource.",
  });
};
