import express from "express";

import {
  createOwnerAuditLog,
  getOwnerAuditLogs,
  getOwnerZoneSnapshot,
  requireVerifiedOwnerZone,
  verifyOwnerZone,
} from "../controllers/OwnerZone.js";
import { requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";

const router = express.Router();

router.post(
  "/:clubId/verify",
  requireSessionUser,
  validateObjectIdParam("clubId"),
  verifyOwnerZone,
);

router.get(
  "/:clubId/snapshot",
  requireSessionUser,
  validateObjectIdParam("clubId"),
  requireVerifiedOwnerZone,
  getOwnerZoneSnapshot,
);

router.get(
  "/:clubId/audit-logs",
  requireSessionUser,
  validateObjectIdParam("clubId"),
  requireVerifiedOwnerZone,
  getOwnerAuditLogs,
);

router.post(
  "/:clubId/audit-logs",
  requireSessionUser,
  validateObjectIdParam("clubId"),
  requireVerifiedOwnerZone,
  createOwnerAuditLog,
);

export default router;
