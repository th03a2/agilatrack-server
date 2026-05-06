import Clubs from "../models/Clubs.js";
import { makeCacheKey, remember } from "../utils/cache.js";
import { buildPaginatedResult, getPaginationOptions } from "./pagination.js";

export const listClubs = async ({ filter = {}, query = {} } = {}) => {
  const { limit, page, skip } = getPaginationOptions(query);
  const cacheKey = makeCacheKey("clubs:list", filter, { limit, page });

  return remember(cacheKey, async () => {
    const [data, totalItems] = await Promise.all([
      Clubs.find(filter)
        .populate("parent", "name level location")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Clubs.countDocuments(filter),
    ]);

    return buildPaginatedResult({ data, limit, page, totalItems });
  });
};

export default {
  listClubs,
};
