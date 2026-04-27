const blockedKeyPattern = /(^\$)|\./;

const findPropertyDescriptor = (target, key) => {
  let currentTarget = target;

  while (currentTarget) {
    const descriptor = Object.getOwnPropertyDescriptor(currentTarget, key);

    if (descriptor) {
      return descriptor;
    }

    currentTarget = Object.getPrototypeOf(currentTarget);
  }

  return undefined;
};

const sanitizeValue = (value) => {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      value[index] = sanitizeValue(value[index]);
    }

    return value;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => {
      if (blockedKeyPattern.test(key)) {
        delete value[key];
        return;
      }

      value[key] = sanitizeValue(entry);
    });

    return value;
  }

  if (typeof value === "string") {
    return value.replace(/\0/g, "");
  }

  return value;
};

const setRequestValue = (req, key, value, descriptor) => {
  if (!descriptor || descriptor.writable || descriptor.set) {
    req[key] = value;
    return;
  }

  Object.defineProperty(req, key, {
    configurable: true,
    enumerable: descriptor.enumerable ?? true,
    value,
    writable: true,
  });
};

const sanitizeRequestValue = (req, key) => {
  const descriptor = findPropertyDescriptor(req, key);
  const currentValue = req[key];
  const sanitizedValue = sanitizeValue(currentValue);
  const usesGetterWithoutSetter = Boolean(
    descriptor?.get && !descriptor.set && descriptor.writable !== true,
  );

  if (sanitizedValue !== currentValue || usesGetterWithoutSetter) {
    setRequestValue(req, key, sanitizedValue, descriptor);
  }
};

export const sanitizeRequest = (req, res, next) => {
  sanitizeRequestValue(req, "body");
  sanitizeRequestValue(req, "params");
  sanitizeRequestValue(req, "query");
  next();
};
