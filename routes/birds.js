import express from "express";
import {
  createBird,
  deleteBird,
  findAll,
  findOne,
  uploadBirdPhoto,
  updateBirdApproval,
  updateBird,
} from "../controllers/Birds.js";

const router = express.Router();

router.get("/", findAll);
router.post("/upload-photo", uploadBirdPhoto);
router.put("/:id/approval", updateBirdApproval);
router.get("/:id", findOne);
router.post("/", createBird);
router.put("/:id", updateBird);
router.delete("/:id", deleteBird);

export default router;
