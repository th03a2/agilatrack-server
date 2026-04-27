import express from "express";
import { login, update, validateRefresh } from "../controllers/Auth.js";

const router = express.Router();

router.post("/login", login);
router.get("/validateRefresh", validateRefresh);
router.put("/update", update);

export default router;
