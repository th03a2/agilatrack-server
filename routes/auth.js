import express from "express";
import {
  getCurrentUser,
  login,
  register,
  sendVerificationCode,
  update,
  uploadProfile,
  validateRefresh,
  verifyEmailCode,
} from "../controllers/Auth.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", getCurrentUser);
router.post("/send-verification-code", sendVerificationCode);
router.post("/verify-email-code", verifyEmailCode);
router.post("/register", register);
router.post("/upload", uploadProfile);
router.get("/validateRefresh", validateRefresh);
router.put("/update", update);

export default router;
