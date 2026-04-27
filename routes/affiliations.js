import express from "express";
import {
  approveAffiliation,
  assignAffiliationRole,
  createAffiliation,
  deleteAffiliation,
  findClubDashboard,
  findAll,
  findOne,
  rejectAffiliation,
  updateAffiliation,
} from "../controllers/Affiliations.js";
import {
  requireAuth,
  requireClubManagementAccess,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", findAll);
router.get("/club-dashboard/:clubId", requireClubManagementAccess, findClubDashboard);
router.get("/:id", findOne);
router.post("/", createAffiliation);
router.put("/:id/approve", requireClubManagementAccess, approveAffiliation);
router.put("/:id/reject", requireClubManagementAccess, rejectAffiliation);
router.put("/:id/assign-role", requireClubManagementAccess, assignAffiliationRole);
router.put("/:id", updateAffiliation);
router.delete("/:id", deleteAffiliation);

export default router;
