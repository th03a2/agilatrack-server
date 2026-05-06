import express from "express";
import {
  createRace,
  deleteRace,
  findAll,
  findOne,
  updateRace,
} from "../controllers/Races.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { raceSchemas } from "../validations/schemas.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", validateObjectIdParam("id"), findOne);
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
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "operations:manage", "races:manage"),
  deleteRace,
);

export default router;
