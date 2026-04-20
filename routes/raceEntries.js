import express from "express";
import {
  boardEntry,
  bookEntry,
  checkInEntry,
  deleteEntry,
  departEntry,
  findAll,
  findOne,
  recordArrival,
  updateEntry,
} from "../controllers/RaceEntries.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", bookEntry);
router.put("/:id", updateEntry);
router.put("/:id/check-in", checkInEntry);
router.put("/:id/boarding", boardEntry);
router.put("/:id/departure", departEntry);
router.put("/:id/arrival", recordArrival);
router.delete("/:id", deleteEntry);

export default router;
