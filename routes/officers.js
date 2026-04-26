import express from "express";
import {
  createOfficer,
  deleteOfficer,
  findAll,
  findOne,
  updateOfficer,
} from "../controllers/Officers.js";

const router = express.Router();

// Legacy alias for club management endpoints.
router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createOfficer);
router.put("/:id", updateOfficer);
router.delete("/:id", deleteOfficer);

export default router;
