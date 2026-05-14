import express from "express";
import Users from "../models/Users.js";
import { verifySessionToken } from "../utils/auth.js";

const router = express.Router();

// Middleware to verify authentication and super_admin role
const requireSuperAdmin = async (req, res, next) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        message: "Please login to access this resource"
      });
    }

    const decoded = verifySessionToken(token);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({
        success: false,
        error: "Invalid authentication token",
        message: "Please login again"
      });
    }

    const user = await Users.findById(decoded.userId).select("role isActive");
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "User not found",
        message: "Authentication failed"
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: "Account is inactive",
        message: "Please contact administrator"
      });
    }

    if (user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: "Insufficient permissions",
        message: "Only super admin can access this resource"
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Authentication failed",
      message: "Please login again"
    });
  }
};

// Helper function to get token from request
function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  return req.cookies?.token || req.headers["x-access-token"] || null;
}

/**
 * POST /api/admin/users
 * Create admin account (super_admin only)
 */
router.post("/users", requireSuperAdmin, async (req, res) => {
  try {
    const { email, password, fname, lname, mname, mobile } = req.body;

    // Validate required fields
    if (!email || !password || !fname || !lname) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        message: "Email, password, first name, and last name are required"
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
        message: "Please enter a valid email address"
      });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: "Password too short",
        message: "Password must be at least 8 characters long"
      });
    }

    // Check if email already exists
    const existingUser = await Users.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "Email already exists",
        message: "An account with this email already exists"
      });
    }

    // Create admin user
    const adminUser = await Users.create({
      email: email.toLowerCase().trim(),
      password,
      fullName: {
        fname: fname.trim(),
        lname: lname.trim(),
        ...(mname ? { mname: mname.trim() } : {})
      },
      role: "admin", // Force role to admin only
      membershipStatus: "active",
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      profileCompleted: true,
      isActive: true,
      membership: "premium",
      state: ["verified"],
      mobile: mobile?.trim() || "",
      activePlatform: {
        _id: null,
        access: ["admin", "owner", "secretary", "operator", "member"],
        club: null,
        portal: "admin",
        role: "admin",
      },
      profile: {
        status: "approved",
        at: new Date(),
      },
    });

    // Return safe user data (never include password)
    const safeUserData = {
      _id: adminUser._id,
      email: adminUser.email,
      fullName: adminUser.fullName,
      role: adminUser.role,
      membershipStatus: adminUser.membershipStatus,
      isActive: adminUser.isActive,
      createdAt: adminUser.createdAt
    };

    res.status(201).json({
      success: true,
      message: "Admin account created successfully",
      payload: safeUserData
    });

  } catch (error) {
    console.error("Error creating admin user:", error);
    
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: "Duplicate entry",
        message: "Email or username already exists"
      });
    }

    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: "Unable to create admin account"
    });
  }
});

export default router;
