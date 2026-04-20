import express from "express";
import {
  createAffiliation,
  deleteAffiliation,
  findAll,
  findOne,
  updateAffiliation,
} from "../controllers/Affiliations.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createAffiliation);
router.put("/:id", updateAffiliation);
router.delete("/:id", deleteAffiliation);

export default router;
