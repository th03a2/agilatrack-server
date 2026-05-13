import express from "express";
import {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  getUnreadAnnouncementCount,
  listAnnouncements,
  markAllAnnouncementsRead,
  markAnnouncementRead,
  updateAnnouncement,
} from "../controllers/Announcements.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";

const router = express.Router();

const requireAnnouncementManager = requireAnyPermission(
  "admin:manage",
  "club:manage",
  "communications:manage",
);

router.get("/", requireSessionUser, listAnnouncements);
router.get("/unread-count", requireSessionUser, getUnreadAnnouncementCount);
router.post("/mark-all-read", requireSessionUser, markAllAnnouncementsRead);
router.get("/:id", requireSessionUser, validateObjectIdParam("id"), getAnnouncement);
router.post("/", requireSessionUser, requireAnnouncementManager, createAnnouncement);
router.put(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnnouncementManager,
  updateAnnouncement,
);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnnouncementManager,
  deleteAnnouncement,
);
router.post("/:id/read", requireSessionUser, validateObjectIdParam("id"), markAnnouncementRead);

export default router;
