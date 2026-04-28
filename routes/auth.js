import express from "express";
import {
  login,
  update,
  uploadProfile,
  validateRefresh,
} from "../controllers/Auth.js";

const router = express.Router();

router.post("/login", login);
router.post("/upload", uploadProfile);
router.get("/validateRefresh", validateRefresh);
router.put("/update", update);

export default router;
