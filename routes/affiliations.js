import express from "express";
import {
  approveAffiliation,
  assignAffiliationRole,
  createAffiliation,
  deleteAffiliation,
  findAll,
  findOne,
  getClubDashboard,
  rejectAffiliation,
  updateAffiliation,
} from "../controllers/Affiliations.js";

const router = express.Router();

router.get("/", findAll);
router.get("/club-dashboard/:clubId", getClubDashboard);
router.put("/:id/approve", approveAffiliation);
router.put("/:id/reject", rejectAffiliation);
router.put("/:id/assign-role", assignAffiliationRole);
router.get("/:id", findOne);
router.post("/", createAffiliation);
router.put("/:id", updateAffiliation);
router.delete("/:id", deleteAffiliation);

export default router;
