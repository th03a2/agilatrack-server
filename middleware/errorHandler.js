<<<<<<< Updated upstream
import multer from "multer";
=======
>>>>>>> Stashed changes
import { env } from "../config/env.js";
import { isAppError } from "../utils/appError.js";

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

<<<<<<< Updated upstream
  if (error instanceof multer.MulterError) {
    const isFileSizeError = error.code === "LIMIT_FILE_SIZE";

    res.status(400).json({
      error: isFileSizeError ? "File too large." : "Upload failed.",
      ...(env.IS_PRODUCTION
        ? {}
        : {
            details: isFileSizeError
              ? `Maximum file size is ${env.MAX_UPLOAD_FILE_SIZE_MB}MB.`
              : error.message || "The uploaded file could not be processed.",
          }),
=======
  if (
    error instanceof SyntaxError &&
    "body" in error &&
    /JSON/i.test(error.message || "")
  ) {
    res.status(400).json({
      error: "Invalid JSON payload",
      message: "Request body contains malformed JSON.",
>>>>>>> Stashed changes
    });
    return;
  }

<<<<<<< Updated upstream
  if (isAppError(error)) {
    res.status(error.statusCode).json({
      error: error.message,
      ...(!env.IS_PRODUCTION && error.details ? { details: error.details } : {}),
=======
  if (isAppError(error) || Number.isInteger(error?.statusCode)) {
    res.status(error.statusCode || 400).json({
      error: error.message,
      ...(!env.IS_PRODUCTION && error?.details ? { details: error.details } : {}),
>>>>>>> Stashed changes
    });
    return;
  }

  if (/not allowed by CORS/i.test(error?.message || "")) {
    res.status(403).json({
      error: "CORS request blocked.",
      ...(!env.IS_PRODUCTION ? { details: error.message } : {}),
    });
    return;
  }

  console.error("Unhandled server error:", error);

  res.status(500).json({
    error: "Internal server error.",
    ...(!env.IS_PRODUCTION
      ? { details: error?.message || "An unexpected error occurred." }
      : {}),
  });
};
