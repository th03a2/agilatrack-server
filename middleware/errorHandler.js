import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { isProduction } from "../utils/auth.js";

const { JsonWebTokenError, TokenExpiredError } = jwt;

const getDuplicateMessage = (error = {}) => {
  const field = Object.keys(error.keyPattern || error.keyValue || {})[0] || "record";

  if (field === "email") return "An account with this email already exists.";
  if (field === "username") return "This username is already taken.";
  if (field === "bandNumber") return "Band number already exists.";
  if (field === "code") return "Code already exists.";

  return "This record already exists.";
};

const normalizeError = (error = {}) => {
  if (error.isJoi) {
    return {
      status: 400,
      message: "Validation error",
      errors: error.details?.map((detail) => ({
        field: detail.path?.join(".") || "",
        message: detail.message,
      })),
    };
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return {
      status: 400,
      message: "Validation error",
      errors: Object.values(error.errors || {}).map((detail) => ({
        field: detail.path || "",
        message: detail.message,
      })),
    };
  }

  if (error instanceof mongoose.Error.CastError) {
    return {
      status: 400,
      message: `Invalid ${error.path || "value"}.`,
    };
  }

  if (error?.code === 11000) {
    return {
      status: 409,
      message: getDuplicateMessage(error),
    };
  }

  if (error instanceof TokenExpiredError) {
    return {
      status: 401,
      message: "Session expired. Please sign in again.",
    };
  }

  if (error instanceof JsonWebTokenError) {
    return {
      status: 401,
      message: "Invalid or expired session.",
    };
  }

  const status = Number(error?.status || error?.statusCode || 500);

  return {
    status,
    message:
      status >= 500 && isProduction()
        ? "Something went wrong"
        : error?.message || "Something went wrong",
  };
};

export const apiNotFoundHandler = (req, res, next) => {
  if (!/^\/(?:api|nbi)(?:\/|$)/i.test(req.path)) {
    return next();
  }

  return res.status(404).json({
    success: false,
    message: "Route not found",
    error: "Route not found",
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const normalizedError = normalizeError(error);

  if (normalizedError.status >= 500) {
    console.error(`[server:error] ${req.method} ${req.originalUrl}`);
    console.error(error);
  }

  return res.status(normalizedError.status).json({
    success: false,
    message: normalizedError.message,
    error: normalizedError.message,
    ...(normalizedError.errors ? { errors: normalizedError.errors } : {}),
    ...(isProduction() || !error?.stack ? {} : { stack: error.stack }),
  });
};

export default errorHandler;
