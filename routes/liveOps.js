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

const router = express.Router();

router.get("/health", getHealth);
router.get("/payments", findPayments);
router.get("/payouts", findPayouts);
router.get("/products", findProducts);
router.get("/orders", findOrders);
router.get("/sellers", findSellers);
router.get("/shipments", findShipments);
router.get("/support", findSupport);

export default router;
