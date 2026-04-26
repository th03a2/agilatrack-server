import express from "express";
import {
  createManagementMember,
  deleteManagementMember,
  findAll,
  findOne,
  updateManagementMember,
} from "../controllers/ClubManagement.js";

const router = express.Router();

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createManagementMember);
router.put("/:id", updateManagementMember);
router.delete("/:id", deleteManagementMember);

export default router;
