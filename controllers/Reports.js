import Birds from "../models/Birds.js";
import Lofts from "../models/Lofts.js";
import Affiliations from "../models/Affiliations.js";
import RaceEntries from "../models/RaceEntries.js";
import Races from "../models/Races.js";
import {
  getAccessibleClubIds as getTenantAccessibleClubIds,
  isTenantSuperAdmin,
} from "../middleware/tenantIsolation.js";

const sendError = (res, error, status = 400) =>
  res.status(status).json({ error: error.message || error });

export const getOwnerReportsSummary = async (req, res) => {
  try {
    // Get user's accessible clubs
    const accessibleClubIds = isTenantSuperAdmin(req.auth)
      ? null // Super admin can see all
      : getTenantAccessibleClubIds(req.auth);

    // FIXED: Only block when user is NOT global and has no accessible club IDs
    if (!isTenantSuperAdmin(req.auth) && (!accessibleClubIds || !accessibleClubIds.length)) {
      return res.status(403).json({
        error: "You do not have access to reports data.",
      });
    }

    // Build queries based on club access
    const clubFilter = isTenantSuperAdmin(req.auth) ? {} : { club: { $in: accessibleClubIds } };

    // Get counts from various collections
    const [
      totalBirds,
      activeBirds,
      totalLofts,
      activeLofts,
      totalMembers,
      activeMembers,
      totalRaces,
      completedRaces,
      totalRaceEntries,
      pendingBirdApprovals,
    ] = await Promise.all([
      // Birds
      Birds.countDocuments({ ...clubFilter, deletedAt: { $exists: false } }),
      Birds.countDocuments({ ...clubFilter, deletedAt: { $exists: false }, status: 'active' }),
      
      // Lofts
      Lofts.countDocuments({ ...clubFilter, deletedAt: { $exists: false } }),
      Lofts.countDocuments({ ...clubFilter, deletedAt: { $exists: false }, status: 'active' }),
      
      // Members (affiliations)
      Affiliations.countDocuments({ ...clubFilter, status: 'approved' }),
      Affiliations.countDocuments({ ...clubFilter, status: 'approved', roles: { $exists: true, $ne: [] } }),
      
      // Races
      Races.countDocuments({ ...clubFilter, deletedAt: { $exists: false } }),
      Races.countDocuments({ ...clubFilter, deletedAt: { $exists: false }, status: 'completed' }),
      
      // Race Entries
      RaceEntries.countDocuments({ ...clubFilter, deletedAt: { $exists: false } }),
      
      // Pending Bird Approvals
      Birds.countDocuments({ ...clubFilter, deletedAt: { $exists: false }, approvalStatus: 'pending' }),
    ]);

    // Get recent reports (mock data for now - can be extended later)
    const recentReports = [
      {
        _id: "summary-1",
        name: "Club Summary Report",
        type: "Summary",
        date: new Date().toISOString().split('T')[0],
        status: "Completed",
        metrics: {
          birds: totalBirds,
          lofts: totalLofts,
          members: totalMembers,
          races: totalRaces,
        }
      }
    ];

    const summary = {
      totalBirds,
      activeBirds,
      totalLofts,
      activeLofts,
      totalMembers,
      activeMembers,
      totalRaces,
      completedRaces,
      totalRaceEntries,
      pendingBirdApprovals,
      recentReports,
      generatedAt: new Date().toISOString(),
    };

    res.json({
      success: "Reports summary fetched successfully",
      data: summary,
    });
  } catch (error) {
    console.error('Error fetching reports summary:', error);
    sendError(res, error);
  }
};
