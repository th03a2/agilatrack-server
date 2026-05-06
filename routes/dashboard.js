import express from "express";
import { getStats } from "../controllers/Dashboard.js";
import { requireSessionUser } from "../middleware/sessionAuth.js";

const router = express.Router();

router.get("/stats", requireSessionUser, getStats);

export default router;
