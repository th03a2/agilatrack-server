import express from "express";
import {
  createBird,
  deleteBird,
  findAll,
  findOne,
  updateBird,
} from "../controllers/Birds.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createBird);
router.put("/:id", updateBird);
router.delete("/:id", deleteBird);

export default router;
