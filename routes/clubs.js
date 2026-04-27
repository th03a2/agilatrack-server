import express from "express";
import {
  findAll,
  findOne,
  createClub,
  updateClub,
  deleteClub,
  findChildren,
  findLevels,
  findPyramid,
  findTree,
} from "../controllers/Clubs.js";
import { requireClubManagementAccess, requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", findAll);
router.get("/meta/levels", findLevels);
router.get("/pyramid", findPyramid);
router.get("/:id/tree", findTree);
router.get("/:id/children", findChildren);
router.get("/:id", findOne);
router.post("/", requireAuth, requireClubManagementAccess, createClub);
router.put("/:id", requireAuth, requireClubManagementAccess, updateClub);
router.delete("/:id", requireAuth, requireClubManagementAccess, deleteClub);

export default router;
