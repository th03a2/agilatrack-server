import express from "express";
import {
  createCrate,
  deleteCrate,
  findAll,
  findOne,
  updateCrate,
} from "../controllers/Crates.js";
import {
  requireAuth,
  requireOperationalAccess,
} from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth, requireOperationalAccess);

router.get("/", findAll);
router.get("/:id", findOne);
router.post("/", createCrate);
router.put("/:id", updateCrate);
router.delete("/:id", deleteCrate);

export default router;
