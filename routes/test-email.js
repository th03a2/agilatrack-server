import express from "express";
import { sendTestEmail } from "../services/emailService.js";

const router = express.Router();

// Test email endpoint
router.get("/", async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email parameter is required",
        error: "Please provide an email address: /api/test-email?email=your@email.com",
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
        error: "Please provide a valid email address",
      });
    }

    console.log(`[test-email] Sending test email to: ${email}`);
    
    const result = await sendTestEmail(email);
    
    return res.json({
      success: true,
      message: "Test email sent successfully",
      data: {
        recipient: email,
        messageId: result.messageId,
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error("[test-email] Error:", error.message);
    
    return res.status(500).json({
      success: false,
      message: "Failed to send test email",
      error: error.message,
    });
  }
});

export default router;
