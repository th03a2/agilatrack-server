import { canAccessClubWorkspace, hasPermission } from "../middleware/sessionAuth.js";
import { getDashboardStats } from "../services/dashboardService.js";

export const getStats = async (req, res, next) => {
  try {
    const clubId = String(req.query?.club || req.query?.clubId || "").trim();

    if (clubId && !canAccessClubWorkspace(req.auth, clubId) && !hasPermission(req.auth, "admin:manage")) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this dashboard scope.",
        error: "You do not have access to this dashboard scope.",
      });
    }

    const payload = await getDashboardStats({ clubId });

    return res.json({
      success: true,
      message: "Dashboard stats fetched successfully",
      data: payload,
      payload,
    });
  } catch (error) {
    return next(error);
  }
};
