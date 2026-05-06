import mongoose from "mongoose";

export const validateObjectIdParam = (paramName, label = paramName) => (req, res, next) => {
  const rawValue = String(req.params?.[paramName] || "").trim();

  if (!rawValue || mongoose.Types.ObjectId.isValid(rawValue)) {
    return next();
  }

  return res.status(400).json({
    error: `Invalid ${label} id.`,
  });
};
