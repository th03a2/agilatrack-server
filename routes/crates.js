import express from "express";
import {
  createCrate,
  deleteCrate,
  findAll,
  findOne,
  updateCrate,
} from "../controllers/Crates.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createCrate);
router.put("/:id", updateCrate);
router.delete("/:id", deleteCrate);

export default router;
