import express from "express";
import rateLimit from "express-rate-limit";
import {
  facebookOAuthCallback,
  getCurrentUser,
  googleOAuthCallback,
  login,
  register,
  redirectToFacebookOAuth,
  redirectToGoogleOAuth,
  sendVerificationCode,
  update,
  uploadProfile,
  validateRefresh,
  verifyEmailCode,
} from "../controllers/Auth.js";
import { validateRequest } from "../middlewares/validateRequest.js";
import { authSchemas } from "../validations/schemas.js";

const router = express.Router();

const authLimiter = rateLimit({
  legacyHeaders: false,
  limit: 5,
  standardHeaders: true,
  windowMs: 60 * 1000,
  handler: (_req, res) =>
    res.status(429).json({
      success: false,
      message: "Too many requests, please try again later",
      error: "Too many requests, please try again later",
    }),
});

router.post("/login", authLimiter, validateRequest(authSchemas.login), login);
router.get("/google", redirectToGoogleOAuth);
router.get("/google/callback", googleOAuthCallback);
router.get("/facebook", redirectToFacebookOAuth);
router.get("/facebook/callback", facebookOAuthCallback);
router.get("/me", getCurrentUser);
router.post("/send-verification-code", sendVerificationCode);
router.post("/verify-email-code", verifyEmailCode);
router.post("/register", authLimiter, validateRequest(authSchemas.register), register);
router.post("/upload", uploadProfile);
router.get("/validateRefresh", validateRefresh);
router.put("/update", update);

export default router;
