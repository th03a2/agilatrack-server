import express from "express";
import {
  createLoft,
  deleteLoft,
  findAll,
  findOne,
  updateLoft,
} from "../controllers/Lofts.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createLoft);
router.put("/:id", updateLoft);
router.delete("/:id", deleteLoft);

export default router;
