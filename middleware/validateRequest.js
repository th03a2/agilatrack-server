export const validateRequest = (schema, source = "body") => (req, res, next) => {
  const target = req[source] || {};
  const { error, value } = schema.validate(target, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
    stripUnknown: false,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      error: "Validation error",
      errors: error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      })),
    });
  }

  req[source] = value;
  return next();
};

export default validateRequest;
