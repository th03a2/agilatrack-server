import express from "express";
import {
  approveAffiliation,
  assignAffiliationRole,
  createAffiliation,
  deleteAffiliation,
  findAll,
  findOne,
  getClubDashboard,
  rejectAffiliation,
  updateAffiliation,
} from "../controllers/Affiliations.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { affiliationSchemas } from "../validations/schemas.js";

const router = express.Router();

router.get("/", requireSessionUser, findAll);
router.get(
  "/club-dashboard/:clubId",
  requireSessionUser,
  validateObjectIdParam("clubId", "club"),
  getClubDashboard,
);
router.put(
  "/:id/approve",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "join_requests:manage"),
  approveAffiliation,
);
router.put(
  "/:id/reject",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "join_requests:manage"),
  rejectAffiliation,
);
router.put(
  "/:id/assign-role",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "join_requests:manage"),
  assignAffiliationRole,
);
router.get("/:id", requireSessionUser, validateObjectIdParam("id"), findOne);
router.post("/", requireSessionUser, validateRequest(affiliationSchemas.create), createAffiliation);
router.put("/:id", requireSessionUser, validateObjectIdParam("id"), updateAffiliation);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "join_requests:manage"),
  deleteAffiliation,
);

export default router;
