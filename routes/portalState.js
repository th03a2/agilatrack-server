import express from "express";
import { deleteOne, findAll, upsertOne } from "../controllers/PortalState.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";

const router = express.Router();

router.use(
  requireSessionUser,
  requireAnyPermission(
    "admin:manage",
    "club:manage",
    "dashboard:live_ops",
    "ecommerce:manage",
    "finance:manage",
    "operations:manage",
    "portal_state:manage",
  ),
);

router.get("/", findAll);
router.put("/:domain/:module/:entityType/:entityId", upsertOne);
router.delete("/:domain/:module/:entityType/:entityId", deleteOne);

export default router;
