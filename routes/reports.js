import express from "express";
import {
  getOwnerReportsSummary,
} from "../controllers/Reports.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { simpleRateLimit } from "../middleware/simpleRateLimit.js";

const router = express.Router();

// Owner/Secretary reports summary
router.get(
  "/owner/summary",
  simpleRateLimit({ windowMs: 15 * 60 * 1000, max: 50 }), // 50 requests per 15 minutes
  requireSessionUser,
  requireAnyPermission("club:manage", "admin:manage", "operations:manage"),
  getOwnerReportsSummary,
);

export default router;
