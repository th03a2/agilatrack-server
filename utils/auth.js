<<<<<<< Updated upstream
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./appError.js";

=======
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./appError.js";

const AUTH_TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

>>>>>>> Stashed changes
const roleLabelById = {
  2: "regular member",
  10: "club officer",
  20: "assistant admin",
  74: "club staff",
};

const clubManagementRoles = new Set([
  "assistant admin",
  "club admin",
  "club officer",
  "federation admin",
  "super admin",
  "school admin",
  "department head",
]);

const operationalRoles = new Set([
  ...clubManagementRoles,
  "club staff",
  "race organizer",
  "race official",
  "race secretary",
  "transporter",
]);

<<<<<<< Updated upstream
=======
const toBase64Url = (value) => Buffer.from(value).toString("base64url");

const fromBase64Url = (value) => Buffer.from(value, "base64url").toString("utf8");

const signTokenPayload = (payload) =>
  crypto
    .createHmac("sha256", env.AUTH_TOKEN_SECRET)
    .update(payload)
    .digest("base64url");

>>>>>>> Stashed changes
export const normalizeRoleLabel = (value = "") => {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const numericValue = Number(value);

  if (!Number.isNaN(numericValue) && roleLabelById[numericValue]) {
    return roleLabelById[numericValue];
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
};

const collectNormalizedLabels = ({ affiliations = [], user = {} }) => {
  const values = [
    user?.membership,
    ...(Array.isArray(user?.state) ? user.state : []),
    user?.activePlatform?.portal,
<<<<<<< Updated upstream
    user?.activePlatform?.role,
  ];

  affiliations.forEach((affiliation) => {
    values.push(affiliation?.membershipType);
    (affiliation?.roles || []).forEach((role) => values.push(role));
=======
  ];

  const activeRole = user?.activePlatform?.role;
  if (Array.isArray(activeRole)) {
    values.push(...activeRole);
  } else {
    values.push(activeRole);
  }

  affiliations.forEach((affiliation) => {
    values.push(affiliation?.membershipType);

    const roles = Array.isArray(affiliation?.roles)
      ? affiliation.roles
      : [affiliation?.roles];

    roles.forEach((role) => values.push(role));
>>>>>>> Stashed changes
  });

  return [...new Set(values.map(normalizeRoleLabel).filter(Boolean))];
};

export const buildAccessFlags = ({ affiliations = [], user = {} }) => {
  const roleLabels = collectNormalizedLabels({ affiliations, user });
  const isTeamAdmin = env.TEAM_ADMIN_EMAILS.includes(
    String(user?.email || "").trim().toLowerCase(),
  );

  return {
    isClubManager:
      isTeamAdmin || roleLabels.some((role) => clubManagementRoles.has(role)),
    isOperationalManager:
      isTeamAdmin || roleLabels.some((role) => operationalRoles.has(role)),
    roleLabels,
  };
};

export const extractAuthToken = (headerValue = "") => {
  const value = String(headerValue || "").trim();

  if (!value) {
    return "";
  }

  const [scheme, token] = value.split(/\s+/, 2);

  if (!token) {
    return scheme;
  }

  if (["bearer", "qtracy"].includes(String(scheme).toLowerCase())) {
    return token;
  }

  return value;
};

<<<<<<< Updated upstream
export const signAuthToken = (user) => {
  if (!env.JWT_SECRET) {
    throw new AppError(500, "JWT secret is not configured on the server.");
  }

  return jwt.sign(
    {
      email: user.email,
      type: "access",
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN,
      subject: String(user._id),
    },
  );
};

export const verifyAuthToken = (token) => {
  try {
    return jwt.verify(token, env.JWT_SECRET);
=======
export const signAuthToken = (userOrId) => {
  const userId =
    typeof userOrId === "object" && userOrId !== null
      ? userOrId._id || userOrId.id
      : userOrId;

  if (!userId) {
    throw new AppError(500, "Unable to create a session token.");
  }

  const payload = JSON.stringify({
    sub: String(userId),
    userId: String(userId),
    issuedAt: Date.now(),
    type: "session",
  });
  const encodedPayload = toBase64Url(payload);
  const signature = signTokenPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
};

export const verifyAuthToken = (token) => {
  const [encodedPayload = "", signature = ""] = String(token || "").split(".");

  if (!encodedPayload || !signature) {
    throw new AppError(401, "Authentication required. Please sign in again.");
  }

  const expectedSignature = signTokenPayload(encodedPayload);
  if (signature !== expectedSignature) {
    throw new AppError(401, "Authentication required. Please sign in again.");
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload));
    const userId = parsed?.sub || parsed?.userId;

    if (!userId || !parsed?.issuedAt) {
      throw new Error("Invalid session payload.");
    }

    if (Date.now() - Number(parsed.issuedAt) > AUTH_TOKEN_TTL_MS) {
      throw new Error("Session expired.");
    }

    return {
      ...parsed,
      sub: String(userId),
      type: parsed?.type || "session",
      userId: String(userId),
    };
>>>>>>> Stashed changes
  } catch {
    throw new AppError(401, "Authentication required. Please sign in again.");
  }
};
