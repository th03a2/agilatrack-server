import express from "express";
import {
  createPigeon,
  deletePigeon,
  findAll,
  findOne,
  updatePigeon,
} from "../controllers/Pigeons.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createPigeon);
router.put("/:id", updatePigeon);
router.delete("/:id", deletePigeon);

export default router;
