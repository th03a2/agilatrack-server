import express from "express";
import {
  createLoft,
  deleteLoft,
  findAll,
  findOne,
  updateLoft,
} from "../controllers/Lofts.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";

const router = express.Router();

router.get("/", requireSessionUser, findAll);
router.get("/:id", requireSessionUser, validateObjectIdParam("id"), findOne);
router.post(
  "/",
  requireSessionUser,
  requireAnyPermission("club:manage", "records:self"),
  createLoft,
);
router.put(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "records:self"),
  updateLoft,
);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage"),
  deleteLoft,
);

export default router;
