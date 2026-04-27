import express from "express";
import {
  createPigeon,
  deletePigeon,
  findAll,
  findOne,
  updatePigeon,
} from "../controllers/Pigeons.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createPigeon);
router.put("/:id", updatePigeon);
router.delete("/:id", deletePigeon);

export default router;
