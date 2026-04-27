import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./appError.js";

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
    user?.activePlatform?.role,
  ];

  affiliations.forEach((affiliation) => {
    values.push(affiliation?.membershipType);
    (affiliation?.roles || []).forEach((role) => values.push(role));
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
  } catch {
    throw new AppError(401, "Authentication required. Please sign in again.");
  }
};
