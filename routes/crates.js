import express from "express";
import {
  createCrate,
  deleteCrate,
  findAll,
  findOne,
  updateCrate,
} from "../controllers/Crates.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/", requireSessionUser, findAll);
router.get("/:id", requireSessionUser, validateObjectIdParam("id"), findOne);
router.post(
  "/",
  requireSessionUser,
  requireAnyPermission("club:manage", "crates:manage", "operations:manage"),
  createCrate,
);
router.put(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "crates:manage", "operations:manage"),
  updateCrate,
);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "crates:manage", "operations:manage"),
  deleteCrate,
);

export default router;
