import express from "express";
import {
  findAll,
  findOne,
  createClub,
  updateClub,
  deleteClub,
  findChildren,
  findLevels,
  findPyramid,
  findTree,
  uploadClubLogo,
} from "../controllers/Clubs.js";
import { requireAnyPermission, requireSessionUser } from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { clubSchemas } from "../validations/schemas.js";

const router = express.Router();

router.get("/", findAll);
router.get("/meta/levels", findLevels);
router.get("/pyramid", findPyramid);
router.get("/:id/tree", validateObjectIdParam("id"), findTree);
router.get("/:id/children", validateObjectIdParam("id"), findChildren);
router.get("/:id", validateObjectIdParam("id"), findOne);
router.put(
  "/:id/logo",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage"),
  uploadClubLogo,
);
router.post(
  "/",
  requireSessionUser,
  requireAnyPermission("admin:manage", "club:manage"),
  validateRequest(clubSchemas.create),
  createClub,
);
router.put(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage"),
  validateRequest(clubSchemas.update),
  updateClub,
);
router.delete(
  "/:id",
  requireSessionUser,
  validateObjectIdParam("id"),
  requireAnyPermission("admin:manage", "club:manage"),
  deleteClub,
);

export default router;
