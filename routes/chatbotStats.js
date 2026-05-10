import express from "express";
import Clubs from "../models/Clubs.js";
import Birds from "../models/Birds.js";
import Races from "../models/Races.js";
import Affiliations from "../models/Affiliations.js";
import Users from "../models/Users.js";

const router = express.Router();

// Get general chatbot statistics
router.get("/stats", async (req, res) => {
  try {
    const [clubCount, birdCount, upcomingRacesCount] = await Promise.all([
      Clubs.countDocuments({ 
        deletedAt: { $exists: false },
        isActive: true 
      }),
      Birds.countDocuments({ 
        deletedAt: { $exists: false }
      }),
      Races.countDocuments({
        deletedAt: { $exists: false },
        raceDate: { $gte: new Date() },
        status: { $in: ["booking_open", "booking_closed", "check_in"] }
      })
    ]);

    const stats = {
      totalClubs: clubCount,
      totalBirds: birdCount,
      upcomingRaces: upcomingRacesCount
    };

    res.json({ payload: stats });
  } catch (error) {
    console.error("Error fetching chatbot stats:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

// Get club count specifically
router.get("/clubs/count", async (req, res) => {
  try {
    const count = await Clubs.countDocuments({ 
      deletedAt: { $exists: false },
      isActive: true 
    });
    
    res.json({ payload: { count } });
  } catch (error) {
    console.error("Error fetching club count:", error);
    res.status(500).json({ error: "Failed to fetch club count" });
  }
});

// Get bird count
router.get("/birds/count", async (req, res) => {
  try {
    const count = await Birds.countDocuments({ 
      deletedAt: { $exists: false }
    });
    
    res.json({ payload: { count } });
  } catch (error) {
    console.error("Error fetching bird count:", error);
    res.status(500).json({ error: "Failed to fetch bird count" });
  }
});

// Get upcoming races
router.get("/races/upcoming", async (req, res) => {
  try {
    const races = await Races.find({
      deletedAt: { $exists: false },
      raceDate: { $gte: new Date() },
      status: { $in: ["booking_open", "booking_closed", "check_in"] }
    })
    .select("name code raceDate status")
    .sort({ raceDate: 1 })
    .limit(10)
    .lean();

    res.json({ payload: { count: races.length, races } });
  } catch (error) {
    console.error("Error fetching upcoming races:", error);
    res.status(500).json({ error: "Failed to fetch upcoming races" });
  }
});

// Get available clubs
router.get("/clubs", async (req, res) => {
  try {
    const clubs = await Clubs.find({
      deletedAt: { $exists: false },
      isActive: true
    })
    .select("name code abbr")
    .sort({ name: 1 })
    .limit(20)
    .lean();

    res.json({ payload: clubs });
  } catch (error) {
    console.error("Error fetching clubs:", error);
    res.status(500).json({ error: "Failed to fetch clubs" });
  }
});

// Get user status (if authenticated)
router.get("/me/status", async (req, res) => {
  try {
    // Extract user ID from token if available
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '') || 
                  req.headers.authorization?.replace(/^QTracy\s+/i, '');
    
    if (!token) {
      return res.json({ payload: {} });
    }

    // Simple token verification (you might want to use your existing auth middleware)
    const getUserIdFromToken = (token) => {
      try {
        // This is a simplified version - use your existing token verification
        const parts = token.split('.');
        if (parts.length === 2) {
          const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
          return payload.userId;
        }
      } catch (error) {
        console.error("Token parsing error:", error);
      }
      return null;
    };

    const userId = getUserIdFromToken(token);
    
    if (!userId) {
      return res.json({ payload: {} });
    }

    // Get user's affiliation to determine role and status
    const affiliation = await Affiliations.findOne({
      user: userId,
      deletedAt: { $exists: false }
    })
    .populate('club', 'name code')
    .populate('user', 'fullName email')
    .lean();

    if (!affiliation) {
      return res.json({ payload: { role: 'guest', membershipStatus: 'no_club' } });
    }

    const userRole = Array.isArray(affiliation.roles) && affiliation.roles.length > 0 
      ? affiliation.roles[0] 
      : affiliation.membershipType || 'member';

    res.json({ 
      payload: { 
        role: userRole, 
        membershipStatus: affiliation.status,
        club: affiliation.club
      } 
    });
  } catch (error) {
    console.error("Error fetching user status:", error);
    res.status(500).json({ error: "Failed to fetch user status" });
  }
});

export default router;
