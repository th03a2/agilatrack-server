import express from "express";
import {
  bulkUpdateBirdHealth,
  createBird,
  deleteBird,
  findAll,
  findOne,
  transferBirdOwnership,
  uploadBirdPhoto,
  updateBirdApproval,
  updateBird,
} from "../controllers/Birds.js";
import {
  requireAnyPermission,
  requireAnyRoleBucket,
  requireSessionUser,
} from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { birdSchemas } from "../validations/schemas.js";

const router = express.Router();

router.get("/", requireSessionUser, findAll);
router.patch(
  "/bulk-health",
  requireSessionUser,
  requireAnyPermission("club:manage", "operations:manage", "records:self"),
  bulkUpdateBirdHealth,
);
router.post(
  "/upload-photo",
  requireSessionUser,
  requireAnyPermission("club:manage", "operations:manage", "records:self"),
  uploadBirdPhoto,
);
router.put(
  "/:id/approval",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "operations:manage"),
  updateBirdApproval,
);
router.patch(
  "/:id/transfer",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "operations:manage", "records:self"),
  transferBirdOwnership,
);
router.get("/:id", requireSessionUser, validateObjectIdParam("id"), findOne);
router.post(
  "/",
  requireSessionUser,
  requireAnyRoleBucket("member", "owner", "secretary"),
  validateRequest(birdSchemas.create),
  createBird,
);
router.put(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("club:manage", "operations:manage", "records:self"),
  validateRequest(birdSchemas.update),
  updateBird,
);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage", "operations:manage"),
  deleteBird,
);

export default router;
