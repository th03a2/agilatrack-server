import express from "express";
import {
  createSupportTicket,
  deleteSupportTicket,
  findSupport,
  findSupportTicket,
  updateSupportTicket,
} from "../controllers/OperationalResources.js";
import { requireAuth, requireOperationalAccess } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", findSupport);
router.get("/:id", findSupportTicket);
router.post("/", requireOperationalAccess, createSupportTicket);
router.put("/:id", requireOperationalAccess, updateSupportTicket);
router.delete("/:id", requireOperationalAccess, deleteSupportTicket);

export default router;
