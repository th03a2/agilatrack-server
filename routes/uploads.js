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

router.post(
  "/bird-image",
  requireSessionUser,
  requireAnyRoleBucket("member"),
  multipartUploadParser,
  uploadBirdImageAsset,
);
router.post("/:target", requireSessionUser, multipartUploadParser, uploadAsset);

export default router;
