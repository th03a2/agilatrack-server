import { randomUUID } from "node:crypto";

const getDurationMs = (startedAt) => {
  const duration = process.hrtime.bigint() - startedAt;
  return Number(duration / 1_000_000n);
};

export const requestLogger = ({ skip = () => false } = {}) => (req, res, next) => {
  const requestId =
    String(req.headers["x-request-id"] || "").trim() ||
    (typeof randomUUID === "function" ? randomUUID() : `${Date.now()}-${Math.random()}`);
  const startedAt = process.hrtime.bigint();

  req.id = requestId;
  res.setHeader("X-Request-Id", requestId);

  if (!skip(req)) {
    res.on("finish", () => {
      const contentLength = res.getHeader("content-length") || 0;

      console.info(
        `[http] ${requestId} ${req.method} ${req.originalUrl} ${res.statusCode} ${getDurationMs(
          startedAt,
        )} ms - ${contentLength}`,
      );
    });
  }

  next();
};

export default requestLogger;
