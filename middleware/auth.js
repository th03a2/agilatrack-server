import Affiliations from "../models/Affiliations.js";
import Users from "../models/Users.js";
<<<<<<< Updated upstream
import { buildAccessFlags, extractAuthToken, verifyAuthToken } from "../utils/auth.js";
=======
import {
  buildAccessFlags,
  extractAuthToken,
  verifyAuthToken,
} from "../utils/auth.js";
>>>>>>> Stashed changes
import { AppError } from "../utils/appError.js";

const AUTH_USER_SELECT =
  "_id email username fullName activePlatform membership state mobile isActive profile pid profilePhoto validIdImage isEmailVerified";
const AUTH_AFFILIATION_SELECT = "_id club roles membershipType status user";

const buildAuthContext = async (userId) => {
  const [user, affiliations] = await Promise.all([
    Users.findById(userId).select(AUTH_USER_SELECT).lean({ virtuals: true }),
    Affiliations.find({
      user: userId,
      deletedAt: { $exists: false },
      status: "approved",
    })
      .select(AUTH_AFFILIATION_SELECT)
      .lean({ virtuals: true }),
  ]);

  if (!user || user.isActive === false) {
    throw new AppError(401, "Authentication required. Please sign in again.");
  }

  return {
    access: buildAccessFlags({ affiliations, user }),
    affiliations,
    user,
  };
};

export const hasClubManagementAccess = (auth) =>
  Boolean(auth?.access?.isClubManager);

export const hasOperationalAccess = (auth) =>
  Boolean(auth?.access?.isOperationalManager || auth?.access?.isClubManager);

export const ensureClubManagementAccess = (
  auth,
  message = "You do not have permission to perform this action.",
) => {
  if (!hasClubManagementAccess(auth)) {
    throw new AppError(403, message);
  }
};

export const ensureOperationalAccess = (
  auth,
  message = "You do not have permission to perform this action.",
) => {
  if (!hasOperationalAccess(auth)) {
    throw new AppError(403, message);
  }
};

export const ensureOwnerOrClubManager = (
  ownerId,
  auth,
  message = "You do not have permission to access this resource.",
) => {
  const normalizedOwnerId = String(ownerId || "").trim();
  const normalizedUserId = String(auth?.user?._id || "").trim();

  if (
    normalizedOwnerId &&
    normalizedUserId &&
    normalizedOwnerId === normalizedUserId
  ) {
    return;
  }

  ensureClubManagementAccess(auth, message);
};

export const requireAuth = async (req, res, next) => {
  try {
    const token = extractAuthToken(req.headers.authorization);

    if (!token) {
      throw new AppError(401, "Authentication required. Please sign in.");
    }

    const payload = verifyAuthToken(token);
    const authContext = await buildAuthContext(payload.sub);

    req.auth = {
      ...authContext,
      payload,
      token,
    };

    next();
  } catch (error) {
    next(error);
  }
};

export const requireClubManagementAccess = (req, res, next) => {
  try {
    ensureClubManagementAccess(req.auth);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireOperationalAccess = (req, res, next) => {
  try {
    ensureOperationalAccess(req.auth);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireSelfOrClubManager =
  (resolveOwnerId, options = {}) =>
  (req, res, next) => {
    try {
      const ownerId = resolveOwnerId(req);

      if (!ownerId && options.allowMissing) {
        next();
        return;
      }

      ensureOwnerOrClubManager(ownerId, req.auth);
      next();
    } catch (error) {
      next(error);
    }
  };
