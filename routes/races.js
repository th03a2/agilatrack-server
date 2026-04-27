import express from "express";
import {
  createRace,
  deleteRace,
  findAll,
  findOne,
  updateRace,
} from "../controllers/Races.js";
import { requireAuth, requireClubManagementAccess } from "../middleware/auth.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", requireAuth, requireClubManagementAccess, createRace);
router.put("/:id", requireAuth, requireClubManagementAccess, updateRace);
router.delete("/:id", requireAuth, requireClubManagementAccess, deleteRace);

export default router;
