import express from "express";
import {
  findOrders,
  findPayments,
  findPayouts,
  findProducts,
  findSellers,
  findShipments,
  findSupport,
  getHealth,
} from "../controllers/liveOps.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";

const router = express.Router();

router.get("/health", getHealth);
router.get(
  "/payments",
  requireSessionUser,
  requireAnyPermission("dashboard:live_ops", "finance:manage"),
  findPayments,
);
router.get(
  "/payouts",
  requireSessionUser,
  requireAnyPermission("dashboard:live_ops", "finance:manage"),
  findPayouts,
);
router.get(
  "/products",
  requireSessionUser,
  requireAnyPermission("dashboard:live_ops", "ecommerce:manage"),
  findProducts,
);
router.get(
  "/orders",
  requireSessionUser,
  requireAnyPermission("dashboard:live_ops", "ecommerce:manage"),
  findOrders,
);
router.get(
  "/sellers",
  requireSessionUser,
  requireAnyPermission("dashboard:live_ops", "ecommerce:manage"),
  findSellers,
);
router.get(
  "/shipments",
  requireSessionUser,
  requireAnyPermission("dashboard:live_ops", "ecommerce:manage"),
  findShipments,
);
router.get(
  "/support",
  requireSessionUser,
  requireAnyPermission("admin:manage", "dashboard:live_ops", "ecommerce:manage"),
  findSupport,
);

export default router;
