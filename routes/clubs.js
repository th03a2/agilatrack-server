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
  uploadClubLogo,
} from "../controllers/Clubs.js";

const router = express.Router();

router.get("/", findAll);
router.get("/meta/levels", findLevels);
router.get("/pyramid", findPyramid);
router.get("/:id/tree", findTree);
router.get("/:id/children", findChildren);
router.get("/:id", findOne);
router.put("/:id/logo", uploadClubLogo);
router.post("/", createClub);
router.put("/:id", updateClub);
router.delete("/:id", deleteClub);

export default router;
