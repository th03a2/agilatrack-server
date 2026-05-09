import express from "express";
import {
  createProfile,
  deleteProfile,
  findAll,
  findOne,
  updateProfile,
} from "../controllers/AvianHealthProfiles.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/", requireSessionUser, findAll);
router.get("/:id", requireSessionUser, validateObjectIdParam("id"), findOne);
router.post(
  "/",
  requireSessionUser,
  requireAnyPermission("club:manage", "records:self"),
  createProfile,
);
router.put(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "records:self"),
  updateProfile,
);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage"),
  deleteProfile,
);

export default router;
