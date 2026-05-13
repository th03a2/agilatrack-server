import Announcements from "../models/Announcement.js";
import {
  canManageTenantClub,
  resolveTenantClubId,
} from "../middleware/tenantIsolation.js";
import { normalizeText } from "../utils/auth.js";

const priorityByApiValue = {
  high: "urgent",
  low: "normal",
  medium: "normal",
  urgent: "emergency",
};

const apiPriorityByModelValue = {
  emergency: "urgent",
  normal: "medium",
  urgent: "high",
};

function mapAnnouncement(announcement = {}) {
  const author = announcement.createdBy || {};

  return {
    _id: String(announcement._id || ""),
    title: normalizeText(announcement.title),
    content: normalizeText(announcement.body),
    type:
      announcement.priority === "emergency"
        ? "urgent"
        : announcement.audience === "operators"
          ? "system"
          : "general",
    priority: apiPriorityByModelValue[announcement.priority] || "medium",
    author: {
      _id: author?._id ? String(author._id) : "",
      name: normalizeText(author?.name) || normalizeText(author?.email) || "AgilaTrack",
      email: normalizeText(author?.email),
      role: normalizeText(author?.role) || "Club",
    },
    targetAudience: [normalizeText(announcement.audience) || "members"],
    isActive: !announcement.deletedAt,
    scheduledFor: announcement.publishedAt,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
  };
}

function getRequestClubId(req) {
  return normalizeText(req.query?.club || req.query?.clubId || req.body?.clubId || req.body?.club);
}

export const listAnnouncements = async (req, res, next) => {
  try {
    const clubId = await resolveTenantClubId(req, res, {
      requestedClubId: getRequestClubId(req),
      requireClub: true,
    });

    if (clubId === null) return null;

    const search = normalizeText(req.query?.search);
    const dbQuery = {
      clubId,
      deletedAt: { $exists: false },
      ...(search
        ? {
            $or: [
              { title: { $regex: search, $options: "i" } },
              { body: { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    };

    const rows = await Announcements.find(dbQuery)
      .populate("createdBy", "name email role")
      .sort({ publishedAt: -1, createdAt: -1 })
      .lean();
    const data = rows.map(mapAnnouncement);

    return res.json({
      data,
      payload: data,
      total: data.length,
      page: 1,
      totalPages: 1,
      unreadCount: 0,
    });
  } catch (error) {
    return next(error);
  }
};

export const getAnnouncement = async (req, res, next) => {
  try {
    const row = await Announcements.findById(req.params.id)
      .populate("createdBy", "name email role")
      .lean();

    if (!row || row.deletedAt) {
      return res.status(404).json({ error: "Announcement not found." });
    }

    const clubId = await resolveTenantClubId(req, res, {
      requestedClubId: row.clubId,
      requireClub: true,
    });

    if (clubId === null) return null;

    const data = mapAnnouncement(row);
    return res.json({ data, payload: data });
  } catch (error) {
    return next(error);
  }
};

export const createAnnouncement = async (req, res, next) => {
  try {
    const clubId = await resolveTenantClubId(req, res, {
      requestedClubId: getRequestClubId(req),
      requireClub: true,
    });

    if (clubId === null) return null;

    if (!canManageTenantClub(req.auth, clubId)) {
      return res.status(403).json({ error: "You do not have permission to manage club announcements." });
    }

    const title = normalizeText(req.body?.title);
    const body = normalizeText(req.body?.content || req.body?.body);

    if (!title || !body) {
      return res.status(400).json({ error: "Announcement title and content are required." });
    }

    const created = await Announcements.create({
      audience: Array.isArray(req.body?.targetAudience)
        ? normalizeText(req.body.targetAudience[0]) || "members"
        : normalizeText(req.body?.audience) || "members",
      body,
      clubId,
      createdBy: req.auth.userId,
      priority: priorityByApiValue[normalizeText(req.body?.priority)] || "normal",
      publishedAt: req.body?.scheduledFor || new Date(),
      title,
    });
    const row = await Announcements.findById(created._id)
      .populate("createdBy", "name email role")
      .lean();
    const data = mapAnnouncement(row);

    return res.status(201).json({ data, payload: data });
  } catch (error) {
    return next(error);
  }
};

export const updateAnnouncement = async (req, res, next) => {
  try {
    const existing = await Announcements.findById(req.params.id);

    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: "Announcement not found." });
    }

    if (!canManageTenantClub(req.auth, existing.clubId)) {
      return res.status(403).json({ error: "You do not have permission to manage club announcements." });
    }

    const title = normalizeText(req.body?.title);
    const body = normalizeText(req.body?.content || req.body?.body);
    const priority = normalizeText(req.body?.priority);

    if (title) existing.title = title;
    if (body) existing.body = body;
    if (priority) existing.priority = priorityByApiValue[priority] || existing.priority;
    if (req.body?.scheduledFor) existing.publishedAt = req.body.scheduledFor;
    existing.updatedBy = req.auth.userId;

    await existing.save();

    const row = await Announcements.findById(existing._id)
      .populate("createdBy", "name email role")
      .lean();
    const data = mapAnnouncement(row);

    return res.json({ data, payload: data });
  } catch (error) {
    return next(error);
  }
};

export const deleteAnnouncement = async (req, res, next) => {
  try {
    const existing = await Announcements.findById(req.params.id);

    if (!existing || existing.deletedAt) {
      return res.status(404).json({ error: "Announcement not found." });
    }

    if (!canManageTenantClub(req.auth, existing.clubId)) {
      return res.status(403).json({ error: "You do not have permission to manage club announcements." });
    }

    existing.deletedAt = new Date().toISOString();
    existing.updatedBy = req.auth.userId;
    await existing.save();

    return res.json({ success: "Announcement archived successfully" });
  } catch (error) {
    return next(error);
  }
};

export const markAnnouncementRead = async (_req, res) =>
  res.json({ success: "Announcement marked as read" });

export const markAllAnnouncementsRead = async (_req, res) =>
  res.json({ success: "Announcements marked as read", count: 0 });

export const getUnreadAnnouncementCount = async (_req, res) =>
  res.json({ data: { count: 0 }, payload: { count: 0 } });
