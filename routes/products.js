import express from "express";
import {
  createProduct,
  deleteProduct,
  findProduct,
  findProducts,
  updateProduct,
} from "../controllers/OperationalResources.js";
import { requireAuth, requireOperationalAccess } from "../middleware/auth.js";

const router = express.Router();

router.use(requireAuth);

router.get("/", findProducts);
router.get("/:id", findProduct);
router.post("/", requireOperationalAccess, createProduct);
router.put("/:id", requireOperationalAccess, updateProduct);
router.delete("/:id", requireOperationalAccess, deleteProduct);

export default router;
