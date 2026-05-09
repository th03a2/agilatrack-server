const toPositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getPaginationOptions = (query = {}, options = {}) => {
  const maxLimit = toPositiveInteger(options.maxLimit, 100);
  const defaultLimit = toPositiveInteger(options.defaultLimit, 10);
  const page = toPositiveInteger(query.page, 1);
  const requestedLimit = toPositiveInteger(query.limit, defaultLimit);
  const limit = Math.min(maxLimit, requestedLimit);
  const skip = (page - 1) * limit;

  return { limit, page, skip };
};

export const buildPaginationMeta = ({ limit, page, totalItems }) => ({
  hasNextPage: page * limit < totalItems,
  hasPreviousPage: page > 1,
  limit,
  page,
  totalItems,
  totalPages: Math.max(1, Math.ceil(totalItems / limit)),
});

export const buildPaginatedResult = ({ data, limit, page, totalItems }) => ({
  data,
  ...buildPaginationMeta({ limit, page, totalItems }),
});

export default {
  buildPaginatedResult,
  buildPaginationMeta,
  getPaginationOptions,
};
