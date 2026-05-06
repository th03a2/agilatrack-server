import express from "express";
import {
  chargeBirdRegistrationFee,
  chargeRaceFee,
  createWallet,
  deleteWallet,
  findAll,
  findOne,
  preloadWallet,
  requestRecharge,
  transferLoad,
  updateWallet,
} from "../controllers/Wallets.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/", requireSessionUser, findAll);
router.get("/:id", requireSessionUser, validateObjectIdParam("id"), findOne);
router.post(
  "/",
  requireSessionUser,
  requireAnyPermission("club:manage", "finance:manage", "records:self"),
  createWallet,
);
router.put(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "finance:manage", "records:self"),
  updateWallet,
);
router.put(
  "/:id/preload",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("finance:manage"),
  preloadWallet,
);
router.put(
  "/:id/transfer",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("finance:manage"),
  transferLoad,
);
router.put(
  "/:id/fees/bird-registration",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "finance:manage"),
  chargeBirdRegistrationFee,
);
router.put(
  "/:id/fees/race",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "finance:manage"),
  chargeRaceFee,
);
router.put(
  "/:id/recharge-request",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "finance:manage", "records:self"),
  requestRecharge,
);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "finance:manage"),
  deleteWallet,
);

export default router;
