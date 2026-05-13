import express from "express";
import { createClubApplication } from "../controllers/Affiliations.js";
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
  findPublicClubs,
} from "../controllers/Clubs.js";
import {
  optionalSessionUser,
  requireAnyPermission,
  requireSessionUser,
} from "../middleware/sessionAuth.js";
import { validateObjectIdParam } from "../middleware/validateObjectId.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { clubSchemas } from "../validations/schemas.js";

const router = express.Router();

// Public endpoint for landing page stats (no auth required)
router.get("/public", findPublicClubs);

// Other endpoints
router.get("/", optionalSessionUser, findAll);
router.get("/meta/levels", findLevels);
router.get("/pyramid", optionalSessionUser, findPyramid);
router.post(
  "/:clubId/applications",
  requireSessionUser,
  validateObjectIdParam("clubId", "club"),
  createClubApplication,
);
router.get("/:id/tree", optionalSessionUser, validateObjectIdParam("id"), findTree);
router.get("/:id/children", optionalSessionUser, validateObjectIdParam("id"), findChildren);
router.get("/:id", optionalSessionUser, validateObjectIdParam("id"), findOne);
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
