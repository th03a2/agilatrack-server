import express from "express";
import { createUploadSuccessHandler } from "../controllers/uploadController.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createUploadMiddleware,
  ensureCloudinaryConfigured,
} from "../middleware/upload.js";

const router = express.Router();

const registerUploadRoute = (path, assetType) => {
  router.post(
    path,
    requireAuth,
    ensureCloudinaryConfigured,
<<<<<<< Updated upstream
    createUploadMiddleware(assetType).single("image"),
=======
    createUploadMiddleware(assetType),
>>>>>>> Stashed changes
    createUploadSuccessHandler(assetType),
  );
};

registerUploadRoute("/profile-photo", "profile-photo");
registerUploadRoute("/valid-id", "valid-id");
registerUploadRoute("/club-logo", "club-logo");
registerUploadRoute("/bird-image", "bird-image");
registerUploadRoute("/announcement-banner", "announcement-banner");

export default router;
