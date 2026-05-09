import express from "express";
import {
  boardEntry,
  bookEntry,
  checkInEntry,
  deleteEntry,
  departEntry,
  findAll,
  findOne,
  recordArrival,
  updateEntry,
} from "../controllers/RaceEntries.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { raceEntrySchemas } from "../validations/schemas.js";

const router = express.Router();

router.get("/", requireSessionUser, findAll);
router.get("/:id", requireSessionUser, validateObjectIdParam("id"), findOne);
router.post(
  "/",
  requireSessionUser,
  requireAnyPermission("club:manage", "operations:manage", "records:self", "races:read"),
  validateRequest(raceEntrySchemas.book),
  bookEntry,
);
router.put(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "operations:manage", "records:self"),
  updateEntry,
);
router.put(
  "/:id/check-in",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "operations:manage", "races:manage"),
  checkInEntry,
);
router.put(
  "/:id/boarding",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "operations:manage", "races:manage"),
  boardEntry,
);
router.put(
  "/:id/departure",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "operations:manage", "races:manage"),
  departEntry,
);
router.put(
  "/:id/arrival",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "operations:manage", "races:manage"),
  recordArrival,
);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "operations:manage"),
  deleteEntry,
);

export default router;
