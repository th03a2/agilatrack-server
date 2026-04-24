import express from "express";
import { createUploadSuccessHandler } from "../controllers/uploadController.js";
import {
  createUploadMiddleware,
  ensureCloudinaryConfigured,
} from "../middleware/upload.js";

const router = express.Router();

const registerUploadRoute = (path, assetType) => {
  router.post(
    path,
    ensureCloudinaryConfigured,
    createUploadMiddleware(assetType).single("image"),
    createUploadSuccessHandler(assetType),
  );
};

registerUploadRoute("/profile-photo", "profile-photo");
registerUploadRoute("/valid-id", "valid-id");
registerUploadRoute("/club-logo", "club-logo");
registerUploadRoute("/bird-image", "bird-image");
registerUploadRoute("/announcement-banner", "announcement-banner");

export default router;
