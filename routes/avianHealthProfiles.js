import express from "express";
import {
  createProfile,
  deleteProfile,
  findAll,
  findOne,
  updateProfile,
} from "../controllers/AvianHealthProfiles.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createProfile);
router.put("/:id", updateProfile);
router.delete("/:id", deleteProfile);

export default router;
