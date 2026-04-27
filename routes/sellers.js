import express from "express";
import {
  createSeller,
  deleteSeller,
  findSeller,
  findSellers,
  updateSeller,
} from "../controllers/OperationalResources.js";
import { requireAuth, requireOperationalAccess } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", findSellers);
router.get("/:id", findSeller);
router.post("/", requireOperationalAccess, createSeller);
router.put("/:id", requireOperationalAccess, updateSeller);
router.delete("/:id", requireOperationalAccess, deleteSeller);

export default router;
