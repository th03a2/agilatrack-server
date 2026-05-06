import Users from "../models/Users.js";
import { buildPaginatedResult, getPaginationOptions } from "./pagination.js";

export const listUsers = async ({ filter = {}, query = {}, select = "-password -__v" } = {}) => {
  const { limit, page, skip } = getPaginationOptions(query);
  const [data, totalItems] = await Promise.all([
    Users.find(filter)
      .select(select)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true }),
    Users.countDocuments(filter),
  ]);

  return buildPaginatedResult({ data, limit, page, totalItems });
};

export default {
  listUsers,
};
