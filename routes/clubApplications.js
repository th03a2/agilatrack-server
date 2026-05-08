import express from "express";
import {
  approveAffiliation,
  findAll,
  findMyApplications,
  rejectAffiliation,
} from "../controllers/Affiliations.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/", requireSessionUser, findAll);
router.get("/my", requireSessionUser, findMyApplications);
router.patch(
  "/:id/approve",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "join_requests:manage"),
  approveAffiliation,
);
router.patch(
  "/:id/reject",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "join_requests:manage"),
  rejectAffiliation,
);

export default router;
