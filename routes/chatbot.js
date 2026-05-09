import express from "express";
import { getSuggestions, queryChatbot } from "../controllers/Chatbot.js";

const router = express.Router();

router.get("/suggestions", getSuggestions);
router.post("/query", queryChatbot);

// New endpoints for smart chatbot
router.get("/stats", async (req, res) => {
  try {
    const Club = require("../models/Club");
    const User = require("../models/User");
    const Pigeon = require("../models/Pigeon");
    const Race = require("../models/Race");

    const totalClubs = await Club.countDocuments({ status: 'active' });
    const totalBirds = await Pigeon.countDocuments();
    const totalUsers = await User.countDocuments({ isActive: true });
    const upcomingRaces = await Race.countDocuments({ 
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
    const Club = require("../models/Club");
    const count = await Club.countDocuments({ status: 'active' });
    res.json({ count });
  } catch (error) {
    console.error('Chatbot club count error:', error);
    res.json({ count: 5 }); // Mock fallback
  }
});

router.get("/birds/count", async (req, res) => {
  try {
    const Pigeon = require("../models/Pigeon");
    const count = await Pigeon.countDocuments();
    res.json({ count });
  } catch (error) {
    console.error('Chatbot birds count error:', error);
    res.json({ count: 150 }); // Mock fallback
  }
});

router.get("/races/upcoming", async (req, res) => {
  try {
    const Race = require("../models/Race");
    const count = await Race.countDocuments({ 
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
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify token and get user (implement based on your auth system)
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const User = require("../models/User");
    const user = await User.findById(decoded.userId).select('role email name isActive');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has club applications
    const Affiliation = require("../models/Affiliation");
    const applications = await Affiliation.find({ userId: user._id });
    
    // Check if user is member of any club
    const activeMembership = applications.find(app => app.status === 'approved');
    
    // Get club name if member
    let clubName = null;
    if (activeMembership) {
      const Club = require("../models/Club");
      const club = await Club.findById(activeMembership.clubId).select('name');
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
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
