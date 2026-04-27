import express from "express";
import {
  login,
  me,
  register,
  sendVerificationCode,
  verifyEmailCode,
} from "../controllers/Auth.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/security.js";

const router = express.Router();

router.post("/login", authLimiter, login);
router.get("/me", requireAuth, me);
router.post("/register", authLimiter, register);
router.post("/send-verification-code", authLimiter, sendVerificationCode);
router.post("/verify-email-code", authLimiter, verifyEmailCode);

export default router;
