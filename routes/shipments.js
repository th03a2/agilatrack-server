import express from "express";
import {
  createShipment,
  deleteShipment,
  findShipment,
  findShipments,
  updateShipment,
} from "../controllers/OperationalResources.js";
import { requireAuth, requireOperationalAccess } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", findShipments);
router.get("/:id", findShipment);
router.post("/", requireOperationalAccess, createShipment);
router.put("/:id", requireOperationalAccess, updateShipment);
router.delete("/:id", requireOperationalAccess, deleteShipment);

export default router;
