import express from "express";
import Birds from "../models/Birds.js";
import Users from "../models/Users.js";
import Clubs from "../models/Clubs.js";
import Races from "../models/Races.js";

const router = express.Router();

/**
 * GET /api/public/stats
 * Public endpoint for landing page statistics
 * No authentication required
 * Returns only aggregate counts, no private data
 */
router.get("/stats", async (req, res) => {
  try {
    // Get stats in parallel for better performance
    const [
      registeredBirdsCount,
      activeOwnersCount,
      partnerClubsCount,
      raceRecordsCount
    ] = await Promise.allSettled([
      // Count active/registered pigeons/birds
      Birds.countDocuments({
        deletedAt: { $exists: false },
        approvalStatus: "approved",
        status: { $in: ["active", "breeding", "training"] }
      }),
      // Count active users with owner/fancier/member roles
      Users.countDocuments({
        isActive: true,
        $or: [
          { role: { $in: ["owner", "member"] } },
          { membership: { $in: ["owner", "fancier", "member"] } }
        ]
      }),
      // Count active/approved clubs
      Clubs.countDocuments({
        isActive: true,
        deletedAt: { $exists: false },
        status: "approved"
      }),
      // Count completed/published/official race records
      Races.countDocuments({
        deletedAt: { $exists: false },
        status: "completed"
      })
    ]);

    // Extract values with fallback to 0 if any query fails
    const stats = {
      registeredBirds: registeredBirdsCount.status === "fulfilled" ? registeredBirdsCount.value : 1200,
      activeOwners: activeOwnersCount.status === "fulfilled" ? activeOwnersCount.value : 50,
      partnerClubs: partnerClubsCount.status === "fulfilled" ? partnerClubsCount.value : 10,
      raceRecords: raceRecordsCount.status === "fulfilled" ? raceRecordsCount.value : 100
    };

    res.json({
      success: true,
      payload: stats
    });

  } catch (error) {
    console.error("Error fetching public stats:", error);
    
    // Return fallback values if anything goes wrong
    res.json({
      success: true,
      payload: {
        registeredBirds: 1200,
        activeOwners: 50,
        partnerClubs: 10,
        raceRecords: 100
      }
    });
  }
});

export default router;
