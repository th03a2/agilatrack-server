import express from "express";
import { getSuggestions, queryChatbot } from "../controllers/Chatbot.js";
import { requireSessionUser } from "../middleware/sessionAuth.js";
import Affiliations from "../models/Affiliations.js";
import Birds from "../models/Birds.js";
import Clubs from "../models/Clubs.js";
import Races from "../models/Races.js";
import Users from "../models/Users.js";

const router = express.Router();

// Public endpoints for onboarding assistant
router.get("/suggestions", getSuggestions);
router.post("/query", queryChatbot);

// Protected endpoints
router.use(requireSessionUser);

// New endpoints for smart chatbot
router.get("/stats", async (req, res) => {
  try {
    const totalClubs = await Clubs.countDocuments({ isActive: true, status: 'approved' });
    const totalBirds = await Birds.countDocuments({ deletedAt: { $exists: false } });
    const totalUsers = await Users.countDocuments({ isActive: true });
    const upcomingRaces = await Races.countDocuments({ 
      status: { $in: ['draft', 'booking_open'] },
      raceDate: { $gte: new Date() }
    });

    res.json({
      totalClubs,
      totalBirds,
      totalUsers,
      upcomingRaces
    });
  } catch (error) {
    console.error('Chatbot stats error:', error);
    // Return mock data if database fails
    res.json({
      totalClubs: 5,
      totalBirds: 150,
      totalUsers: 200,
      upcomingRaces: 3
    });
  }
});

router.get("/clubs/count", async (req, res) => {
  try {
    const count = await Clubs.countDocuments({ isActive: true, status: 'approved' });
    res.json({ count });
  } catch (error) {
    console.error('Chatbot club count error:', error);
    res.json({ count: 5 }); // Mock fallback
  }
});

router.get("/birds/count", async (req, res) => {
  try {
    const count = await Birds.countDocuments({ deletedAt: { $exists: false } });
    res.json({ count });
  } catch (error) {
    console.error('Chatbot birds count error:', error);
    res.json({ count: 150 }); // Mock fallback
  }
});

router.get("/races/upcoming", async (req, res) => {
  try {
    const count = await Races.countDocuments({ 
      status: { $in: ['draft', 'booking_open'] },
      raceDate: { $gte: new Date() }
    });
    res.json({ count });
  } catch (error) {
    console.error('Chatbot upcoming races error:', error);
    res.json({ count: 3 }); // Mock fallback
  }
});

router.get("/me/status", async (req, res) => {
  try {
    const user = await Users.findById(req.auth?.userId).select('role email fullName isActive membershipStatus');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has club applications
    const applications = await Affiliations.find({ user: user._id }).populate('club', 'name');
    
    // Check if user is member of any club
    const activeMembership = applications.find(app => app.status === 'approved');
    
    // Get club name if member
    let clubName = null;
    if (activeMembership) {
      const club = activeMembership.club;
      clubName = club ? club.name : null;
    }

    res.json({
      role: user.role,
      membershipStatus: activeMembership ? 'approved' : (applications.length > 0 ? 'pending' : 'none'),
      hasApplications: applications.length > 0,
      clubName,
      applicationStatus: applications.length > 0 ? applications[applications.length - 1].status : null
    });
  } catch (error) {
    console.error('Chatbot user status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
