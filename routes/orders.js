import express from "express";
import {
  createOrder,
  deleteOrder,
  findOrder,
  findOrders,
  updateOrder,
} from "../controllers/OperationalResources.js";
import { requireAuth, requireOperationalAccess } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", findOrders);
router.get("/:id", findOrder);
router.post("/", requireOperationalAccess, createOrder);
router.put("/:id", requireOperationalAccess, updateOrder);
router.delete("/:id", requireOperationalAccess, deleteOrder);

export default router;
