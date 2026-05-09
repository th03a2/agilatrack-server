import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export const AUTH_TOKEN_TTL_SECONDS = Number(
  process.env.AUTH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 30,
);
export const AUTH_TOKEN_TTL_MS = AUTH_TOKEN_TTL_SECONDS * 1000;
export const AUTH_TOKEN_ISSUER =
  String(process.env.AUTH_TOKEN_ISSUER || "agilatrack").trim() || "agilatrack";
export const AUTH_TOKEN_AUDIENCE =
  String(process.env.AUTH_TOKEN_AUDIENCE || "agilatrack-users").trim() ||
  "agilatrack-users";

export const normalizeText = (value = "") => String(value || "").trim();
export const normalizeFlag = (value = "") => normalizeText(value).toLowerCase();

export const isProduction = () => normalizeFlag(process.env.NODE_ENV) === "production";

export const getAuthTokenSecret = () =>
  normalizeText(process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET) ||
  "agilatrack-dev-secret";

const toBase64Url = (value) => Buffer.from(value).toString("base64url");

const fromBase64Url = (value) => Buffer.from(value, "base64url").toString("utf8");

const signLegacyTokenPayload = (payload) =>
  crypto
    .createHmac("sha256", getAuthTokenSecret())
    .update(payload)
    .digest("base64url");

const verifyLegacySessionToken = (token) => {
  const [encodedPayload = "", signature = ""] = String(token || "").split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  if (signLegacyTokenPayload(encodedPayload) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    const userId = normalizeText(payload?.userId);
    const issuedAt = Number(payload?.issuedAt || 0);

    if (!userId || !issuedAt || Date.now() - issuedAt > AUTH_TOKEN_TTL_MS) {
      return null;
    }

    return {
      exp: Math.floor((issuedAt + AUTH_TOKEN_TTL_MS) / 1000),
      iat: Math.floor(issuedAt / 1000),
      legacy: true,
      userId,
    };
  } catch {
    return null;
  }
};

export const issueSessionToken = (userId, extraPayload = {}) =>
  jwt.sign(
    {
      ...extraPayload,
      userId: String(userId),
    },
    getAuthTokenSecret(),
    {
      audience: AUTH_TOKEN_AUDIENCE,
      expiresIn: AUTH_TOKEN_TTL_SECONDS,
      issuer: AUTH_TOKEN_ISSUER,
      subject: String(userId),
    },
  );

export const verifySessionToken = (token) => {
  const normalizedToken = normalizeText(token);

  if (!normalizedToken) {
    return null;
  }

  try {
    const payload = jwt.verify(normalizedToken, getAuthTokenSecret(), {
      audience: AUTH_TOKEN_AUDIENCE,
      issuer: AUTH_TOKEN_ISSUER,
    });

    return {
      exp: Number(payload?.exp || 0),
      iat: Number(payload?.iat || 0),
      legacy: false,
      raw: payload,
      role: normalizeFlag(payload?.role),
      userId: normalizeText(payload?.sub || payload?.userId),
    };
  } catch {
    return verifyLegacySessionToken(normalizedToken);
  }
};

export const getTokenFromRequest = (req) => {
  const rawHeader = normalizeText(req.headers.authorization);

  if (!rawHeader) {
    return "";
  }

  if (/^QTracy\s+/i.test(rawHeader)) {
    return rawHeader.replace(/^QTracy\s+/i, "").trim();
  }

  if (/^Bearer\s+/i.test(rawHeader)) {
    return rawHeader.replace(/^Bearer\s+/i, "").trim();
  }

  return rawHeader;
};

export const buildLegacyToken = (userId) => {
  const payload = JSON.stringify({
    issuedAt: Date.now(),
    userId: String(userId),
  });
  const encodedPayload = toBase64Url(payload);
  const signature = signLegacyTokenPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
};
