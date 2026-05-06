const PROHIBITED_KEY_PATTERN = /^\$|\./;
const REPLACE_PATTERN = /^\$|\./g;

function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

function sanitizeObject(target, replaceWith = "_") {
  if (Array.isArray(target)) {
    target.forEach((entry) => sanitizeObject(entry, replaceWith));
    return target;
  }

  if (!isPlainObject(target)) {
    return target;
  }

  for (const key of Object.keys(target)) {
    const value = target[key];

    if (PROHIBITED_KEY_PATTERN.test(key)) {
      delete target[key];

      const sanitizedKey = String(key).replace(REPLACE_PATTERN, replaceWith);
      if (
        sanitizedKey &&
        sanitizedKey !== "__proto__" &&
        sanitizedKey !== "constructor" &&
        sanitizedKey !== "prototype"
      ) {
        target[sanitizedKey] = value;
        sanitizeObject(target[sanitizedKey], replaceWith);
      }

      continue;
    }

    sanitizeObject(value, replaceWith);
  }

  return target;
}

export function sanitizeRequest({
  replaceWith = "_",
  targets = ["body", "params", "query"],
} = {}) {
  return (req, _res, next) => {
    for (const target of targets) {
      if (req[target]) {
        sanitizeObject(req[target], replaceWith);
      }
    }

    next();
  };
}
