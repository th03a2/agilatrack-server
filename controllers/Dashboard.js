import {
  denyTenantAccess,
  isTenantSuperAdmin,
  resolveTenantClubId,
} from "../middleware/tenantIsolation.js";
import { getDashboardStats } from "../services/dashboardService.js";

export const getStats = async (req, res, next) => {
  try {
    const requestedClubId = String(req.query?.club || req.query?.clubId || "").trim();
    const clubId = await resolveTenantClubId(req, res, {
      requestedClubId,
      requireClub: !isTenantSuperAdmin(req.auth),
    });

    if (clubId === null) {
      return null;
    }

    if (!clubId && !isTenantSuperAdmin(req.auth)) {
      return denyTenantAccess(req, res, {
        attemptedClubId: requestedClubId,
        reason: "Dashboard stats requested without an assigned club.",
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
