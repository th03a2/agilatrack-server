import { isProduction } from "../utils/auth.js";

export const apiNotFoundHandler = (req, res, next) => {
  if (!/^\/(?:api|nbi)(?:\/|$)/i.test(req.path)) {
    return next();
  }

  return res.status(404).json({
    error: "Route not found",
    message: `No handler exists for ${req.method} ${req.originalUrl}.`,
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const status = Number(error?.status || error?.statusCode || 500);
  const message =
    status >= 500 && isProduction()
      ? "Something went wrong on the server."
      : error?.message || "Request failed.";

  if (status >= 500) {
    console.error(`[server:error] ${req.method} ${req.originalUrl}`);
    console.error(error);
  }

  return res.status(status).json({
    ...(isProduction() || !error?.stack ? {} : { stack: error.stack }),
    error: message,
  });
};
