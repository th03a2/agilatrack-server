import Birds from "../models/Birds.js";
import { buildPaginatedResult, getPaginationOptions } from "./pagination.js";

export const populateBird = (query) =>
  query
    .select("-healthRecords")
    .populate("club", "name code abbr level location")
    .populate("clubId", "name code abbr level location")
    .populate("ownerId", "fullName email mobile pid profilePhoto files")
    .populate("owner", "fullName email mobile pid profilePhoto files")
    .populate({
      path: "affiliation",
      select: "memberCode status membershipType roles user club primaryLoft",
      populate: [
        { path: "user", select: "fullName email mobile pid profilePhoto files" },
        { path: "club", select: "name code abbr level location" },
      ],
    })
    .populate("loft", "name code coordinates address status")
    .populate("breeder", "fullName email mobile pid profilePhoto files")
    .populate("parents.sire.bird", "bandNumber name sex color strain status")
    .populate("parents.dam.bird", "bandNumber name sex color strain status");

export const listPigeons = async ({ filter = {}, query = {} } = {}) => {
  const { limit, page, skip } = getPaginationOptions(query);
  const [data, totalItems] = await Promise.all([
    populateBird(Birds.find(filter))
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    Birds.countDocuments(filter),
  ]);

  return buildPaginatedResult({ data, limit, page, totalItems });
};

export const findDuplicateBandNumber = ({ bandNumber, clubId, excludeId = "" }) => {
  const filter = {
    bandNumber: String(bandNumber || "").trim().toUpperCase(),
    club: clubId,
    deletedAt: { $exists: false },
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  return Birds.findOne(filter).select("_id bandNumber").lean();
};

export default {
  findDuplicateBandNumber,
  listPigeons,
  populateBird,
};
