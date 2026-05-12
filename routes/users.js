import express from "express";
import {
  createUser,
  deleteUser,
  findAll,
  findOne,
  updateUser,
  validateNickname,
  findPublicUsers,
} from "../controllers/Users.js";
import { requireSessionUser } from "../middleware/sessionAuth.js";

const router = express.Router();

// Public endpoint for landing page stats (no auth required)
router.get("/public", findPublicUsers);

// Protected endpoints
router.use(requireSessionUser);
router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);
router.post("/validate-nickname", validateNickname);

export default router;
