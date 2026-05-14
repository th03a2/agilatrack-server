import express from "express";
import { uploadBirdImageAsset } from "../controllers/Birds.js";
import { uploadAsset } from "../controllers/Uploads.js";
import { requireAnyRoleBucket, requireSessionUser } from "../middleware/sessionAuth.js";

const router = express.Router();

const multipartUploadParser = express.raw({
  limit: "10mb",
  type: (req) =>
    String(req.headers["content-type"] || "")
      .trim()
      .toLowerCase()
      .startsWith("multipart/form-data"),
});

const requireUploadTarget = (...allowedTargets) => (req, res, next) => {
  if (allowedTargets.includes(String(req.params.target || "").trim().toLowerCase())) {
    return next();
  }

  return res.status(404).json({
    error: "Unsupported upload target",
    message: `Upload target "${req.params.target}" is not available.`,
  });
};

const requireUploadTargetAccess = (req, res, next) => {
  const target = String(req.params.target || "").trim().toLowerCase();

  if (target === "profile-photo" || target === "valid-id" || target === "club-logo") {
    return next();
  }

  return requireAnyRoleBucket("owner", "secretary", "operator", "platform_admin")(req, res, next);
};

router.post(
  "/bird-image",
  requireSessionUser,
  requireAnyRoleBucket("member"),
  multipartUploadParser,
  uploadBirdImageAsset,
);

// Logo upload routes with role protection
router.post(
  "/fancier-logo",
  requireSessionUser,
  requireAnyRoleBucket("member", "owner", "secretary", "operator", "platform_admin"),
  multipartUploadParser,
  uploadAsset,
);

router.post(
  "/loft-logo",
  requireSessionUser,
  requireAnyRoleBucket("member", "owner", "secretary", "operator", "platform_admin"),
  multipartUploadParser,
  uploadAsset,
);

router.post(
  "/operator-logo",
  requireSessionUser,
  requireAnyRoleBucket("operator", "platform_admin"),
  multipartUploadParser,
  uploadAsset,
);

router.post(
  "/:target",
  requireSessionUser,
  requireUploadTarget("announcement-banner", "club-logo", "profile-photo", "valid-id"),
  requireUploadTargetAccess,
  multipartUploadParser,
  uploadAsset,
);

export default router;
