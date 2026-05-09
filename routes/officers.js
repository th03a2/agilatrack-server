import express from "express";
import {
  createOfficer,
  deleteOfficer,
  findAll,
  findOne,
  updateOfficer,
} from "../controllers/Officers.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";

const router = express.Router();

// Legacy alias for club management endpoints.
router.get("/", requireSessionUser, findAll);
router.get("/:id", requireSessionUser, validateObjectIdParam("id"), findOne);
router.post(
  "/",
  requireSessionUser,
  requireAnyPermission("admin:manage", "club:manage"),
  createOfficer,
);
router.put(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage"),
  updateOfficer,
);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage"),
  deleteOfficer,
);

export default router;
