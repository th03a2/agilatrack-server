import multer from "multer";
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

  if (error instanceof multer.MulterError) {
    const isFileSizeError = error.code === "LIMIT_FILE_SIZE";

    res.status(400).json({
      error: isFileSizeError ? "File too large." : "Upload failed.",
      details: isFileSizeError
        ? "Maximum file size is 5MB."
        : error.message || "The uploaded file could not be processed.",
    });
    return;
  }

  if (isAppError(error)) {
    res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
    return;
  }

  if (/not allowed by CORS/i.test(error?.message || "")) {
    res.status(403).json({
      error: "CORS request blocked.",
      details: error.message,
    });
    return;
  }

  console.error("Unhandled server error:", error);

  res.status(500).json({
    error: "Internal server error.",
    details: error?.message || "An unexpected error occurred.",
  });
};
