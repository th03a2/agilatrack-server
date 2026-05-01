import express from "express";
import { uploadBirdImageAsset } from "../controllers/Birds.js";
import { uploadAsset } from "../controllers/Uploads.js";

const router = express.Router();

const multipartUploadParser = express.raw({
  limit: "8mb",
  type: (req) =>
    String(req.headers["content-type"] || "")
      .trim()
      .toLowerCase()
      .startsWith("multipart/form-data"),
});

router.post("/bird-image", multipartUploadParser, uploadBirdImageAsset);
router.post("/:target", multipartUploadParser, uploadAsset);

export default router;
