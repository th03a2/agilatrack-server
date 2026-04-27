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
import {
  requireAuth,
  requireOperationalAccess,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", bookEntry);
router.put("/:id", updateEntry);
router.put("/:id/check-in", requireOperationalAccess, checkInEntry);
router.put("/:id/boarding", requireOperationalAccess, boardEntry);
router.put("/:id/departure", requireOperationalAccess, departEntry);
router.put("/:id/arrival", requireOperationalAccess, recordArrival);
router.delete("/:id", deleteEntry);

export default router;
