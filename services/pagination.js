export const getPaginationOptions = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requestedLimit = Number.parseInt(query.limit, 10) || 10;
  const limit = Math.min(100, Math.max(1, requestedLimit));
  const skip = (page - 1) * limit;

  return { limit, page, skip };
};

export const buildPaginatedResult = ({ data, limit, page, totalItems }) => ({
  data,
  limit,
  page,
  totalItems,
  totalPages: Math.max(1, Math.ceil(totalItems / limit)),
});
