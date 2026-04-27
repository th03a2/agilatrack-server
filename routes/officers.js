import express from "express";
import {
  createOfficer,
  deleteOfficer,
  findAll,
  findOne,
  updateOfficer,
} from "../controllers/Officers.js";
import {
  requireAuth,
  requireClubManagementAccess,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireClubManagementAccess);

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createOfficer);
router.put("/:id", updateOfficer);
router.delete("/:id", deleteOfficer);

export default router;
