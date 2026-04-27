import express from "express";
import {
  createPayment,
  deletePayment,
  findPayment,
  findPayments,
  updatePayment,
} from "../controllers/OperationalResources.js";
import { requireAuth, requireOperationalAccess } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", findPayments);
router.get("/:id", findPayment);
router.post("/", requireOperationalAccess, createPayment);
router.put("/:id", requireOperationalAccess, updatePayment);
router.delete("/:id", requireOperationalAccess, deletePayment);

export default router;
