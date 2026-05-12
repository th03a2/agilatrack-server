import express from "express";
import {
  createRace,
  deleteRace,
  findAll,
  findOne,
  updateRace,
  findPublicRaces,
} from "../controllers/Races.js";
import {
  bookRacePigeons,
  getRaceResults,
  liberateRace,
  lockRaceResults,
  publishRaceResults,
  recordRaceArrivalByRace,
  scanBasketing,
} from "../controllers/RaceEntries.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { raceSchemas } from "../validations/schemas.js";

const router = express.Router();

// Public endpoint for landing page stats (no auth required)
router.get("/public", findPublicRaces);

// Protected endpoints
router.get("/", requireSessionUser, findAll);
router.post(
  "/:raceId/book",
  requireSessionUser,
  validateObjectIdParam("raceId", "race"),
  requireAnyPermission("club:manage", "operations:manage", "records:self", "races:read"),
  bookRacePigeons,
);
router.post(
  "/:raceId/basketing/scan",
  requireSessionUser,
  validateObjectIdParam("raceId", "race"),
  requireAnyPermission("club:manage", "operations:manage", "races:basketing"),
  scanBasketing,
);
router.post(
  "/:raceId/liberate",
  requireSessionUser,
  validateObjectIdParam("raceId", "race"),
  requireAnyPermission("club:manage", "operations:manage", "races:liberation"),
  liberateRace,
);
router.post(
  "/:raceId/arrival",
  requireSessionUser,
  validateObjectIdParam("raceId", "race"),
  requireAnyPermission("club:manage", "operations:manage", "races:arrival_scan"),
  recordRaceArrivalByRace,
);
router.get(
  "/:raceId/results",
  requireSessionUser,
  validateObjectIdParam("raceId", "race"),
  getRaceResults,
);
router.patch(
  "/:raceId/results/publish",
  requireSessionUser,
  validateObjectIdParam("raceId", "race"),
  requireAnyPermission("admin:manage", "club:manage", "operations:manage", "races:manage"),
  publishRaceResults,
);
router.patch(
  "/:raceId/results/lock",
  requireSessionUser,
  validateObjectIdParam("raceId", "race"),
  requireAnyPermission("admin:manage", "club:manage", "races:manage"),
  lockRaceResults,
);
router.get("/:id", requireSessionUser, validateObjectIdParam("id"), findOne);
router.post(
  "/",
  requireSessionUser,
  requireAnyPermission("admin:manage", "club:manage", "operations:manage", "races:manage"),
  validateRequest(raceSchemas.create),
  createRace,
);
router.put(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "operations:manage", "races:manage"),
  validateRequest(raceSchemas.update),
  updateRace,
);
router.patch(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "operations:manage", "races:manage"),
  validateRequest(raceSchemas.update),
  updateRace,
);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "operations:manage", "races:manage"),
  deleteRace,
);

export default router;
