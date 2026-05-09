const store = new Map();
const DEFAULT_TTL_MS = 60 * 1000;

export const makeCacheKey = (...parts) =>
  parts
    .map((part) => {
      if (part && typeof part === "object") {
        return JSON.stringify(
          Object.keys(part)
            .sort()
            .reduce((next, key) => ({ ...next, [key]: part[key] }), {}),
          (_key, value) => (value instanceof RegExp ? value.toString() : value),
        );
      }

      return String(part ?? "");
    })
    .join(":");

export const getCache = (key) => {
  const entry = store.get(key);

  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }

  return entry.value;
};

export const setCache = (key, value, ttlMs = DEFAULT_TTL_MS) => {
  store.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });

  return value;
};

export const remember = async (key, factory, ttlMs = DEFAULT_TTL_MS) => {
  const cached = getCache(key);

  if (cached !== null) {
    return cached;
  }

  return setCache(key, await factory(), ttlMs);
};

export const clearCacheByPrefix = (prefix) => {
  for (const key of store.keys()) {
    if (String(key).startsWith(prefix)) {
      store.delete(key);
    }
  }
};

export default {
  clearCacheByPrefix,
  getCache,
  makeCacheKey,
  remember,
  setCache,
};
