import express from "express";
import {
  createUser,
  deleteUser,
  findAll,
  findOne,
  updateUser,
} from "../controllers/Users.js";
import {
  requireAuth,
  requireClubManagementAccess,
  requireSelfOrClubManager,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", requireClubManagementAccess, findAll);
router.get("/:id", requireSelfOrClubManager((req) => req.params.id), findOne);
router.post("/", requireClubManagementAccess, createUser);
router.put("/:id", requireSelfOrClubManager((req) => req.params.id), updateUser);
router.delete("/:id", requireClubManagementAccess, deleteUser);

export default router;
