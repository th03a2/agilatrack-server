import Races from "../models/Races.js";
import { makeCacheKey, remember } from "../utils/cache.js";
import { buildPaginatedResult, getPaginationOptions } from "./pagination.js";

export const populateRace = (query) =>
  query
    .populate({
      path: "club",
      select: "name code abbr level type location parent logo",
      populate: {
        path: "parent",
        select: "name code abbr level type location logo",
      },
    })
    .populate("organizer", "fullName email mobile pid profilePhoto files");

export const listRaces = async ({ filter = {}, query = {} } = {}) => {
  const { limit, page, skip } = getPaginationOptions(query);
  const cacheKey = makeCacheKey("races:list", filter, { limit, page });

  return remember(cacheKey, async () => {
    const [data, totalItems] = await Promise.all([
      populateRace(Races.find(filter))
        .sort({ raceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Races.countDocuments(filter),
    ]);

    return buildPaginatedResult({ data, limit, page, totalItems });
  });
};

export default {
  listRaces,
  populateRace,
};
