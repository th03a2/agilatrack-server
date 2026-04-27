import express from "express";
import {
  createPayout,
  deletePayout,
  findPayout,
  findPayouts,
  updatePayout,
} from "../controllers/OperationalResources.js";
import { requireAuth, requireOperationalAccess } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", findPayouts);
router.get("/:id", findPayout);
router.post("/", requireOperationalAccess, createPayout);
router.put("/:id", requireOperationalAccess, updatePayout);
router.delete("/:id", requireOperationalAccess, deletePayout);

export default router;
