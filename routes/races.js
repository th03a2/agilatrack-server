import express from "express";
import {
  createRace,
  deleteRace,
  findAll,
  findOne,
  updateRace,
} from "../controllers/Races.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createRace);
router.put("/:id", updateRace);
router.delete("/:id", deleteRace);

export default router;
