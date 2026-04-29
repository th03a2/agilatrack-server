import express from "express";
import {
  login,
  me,
<<<<<<< Updated upstream
  register,
  sendVerificationCode,
  verifyEmailCode,
=======
  update,
  uploadProfile,
  validateRefresh,
>>>>>>> Stashed changes
} from "../controllers/Auth.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/security.js";

const router = express.Router();

router.post("/login", authLimiter, login);
router.get("/me", requireAuth, me);
<<<<<<< Updated upstream
router.post("/register", authLimiter, register);
router.post("/send-verification-code", authLimiter, sendVerificationCode);
router.post("/verify-email-code", authLimiter, verifyEmailCode);
=======
router.post("/upload", uploadProfile);
router.get("/validateRefresh", validateRefresh);
router.put("/update", update);
>>>>>>> Stashed changes

export default router;
