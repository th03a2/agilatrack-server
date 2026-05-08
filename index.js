import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getHealth } from "./controllers/liveOps.js";
import { apiNotFoundHandler, errorHandler } from "./middlewares/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { sanitizeRequest } from "./middleware/sanitizeRequest.js";
import AffiliationsRouter from "./routes/affiliations.js";
import authRouter from "./routes/auth.js";
import avianHealthProfilesRouter from "./routes/avianHealthProfiles.js";
import birdsRouter from "./routes/birds.js";
import chatbotRouter from "./routes/chatbot.js";
import clubManagementRouter from "./routes/clubManagement.js";
import clubsRouter from "./routes/clubs.js";
import clubApplicationsRouter from "./routes/clubApplications.js";
import commerceRouter from "./commerce/routes.js";
import cratesRouter from "./routes/crates.js";
import dashboardRouter from "./routes/dashboard.js";
import { nbiRoutes, logNbiRoutes } from "./routes/index.js";
import liveOpsRouter from "./routes/liveOps.js";
import loftsRouter from "./routes/lofts.js";
import ownerZoneRouter from "./routes/ownerZone.js";
import officersRouter from "./routes/officers.js";
import portalStateRouter from "./routes/portalState.js";
import raceEntriesRouter from "./routes/raceEntries.js";
import racesRouter from "./routes/races.js";
import uploadsRouter from "./routes/uploads.js";
import usersRouter from "./routes/users.js";
import walletsRouter from "./routes/wallets.js";
import testEmailRouter from "./routes/test-email.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || "0.0.0.0";
const MONGO_URI = process.env.MONGO_URI;
const NODE_ENV = process.env.NODE_ENV || "development";

const buildAllowedOrigins = () => {
  const configuredOrigins = [
    process.env.CLIENT_URL,
    process.env.CLIENT_URLS,
    process.env.CORS_ORIGINS,
  ]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  const defaultOrigins = [
    "http://localhost:4173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:5173",
  ];

  return Array.from(new Set([...configuredOrigins, ...defaultOrigins]));
};

const allowedOrigins = buildAllowedOrigins();

const corsOptions = {
  allowedHeaders: ["Authorization", "Content-Type", "X-Device-Id", "X-Owner-Zone-Token"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      Object.assign(new Error("Origin is not allowed by CORS policy."), {
        status: 403,
      }),
    );
  },
};

const getMongoConnectionSummary = (uri) => {
  try {
    const parsed = new URL(uri);

    return {
      authSource: parsed.searchParams.get("authSource") || "(default)",
      database: parsed.pathname.replace("/", "") || "(none)",
      host: parsed.host || "(missing)",
      user: parsed.username || "(missing)",
    };
  } catch {
    return null;
  }
};

const logMongoStartupError = (error) => {
  if (
    error?.name === "MongooseServerSelectionError" ||
    /querySrv|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|IP address/i.test(error?.message || "")
  ) {
    const summary = getMongoConnectionSummary(MONGO_URI);

    console.error("[startup] MongoDB connection could not be reached.");
    if (summary) {
      console.error(`[startup] Trying to connect to "${summary.host}" as "${summary.user}".`);
    }
    console.error(`[startup] Original error: ${error.message || error}`);
    console.error(
      "[startup] Check your internet connection, MongoDB Atlas Network Access IP whitelist, and the MONGO_URI value in server/.env.",
    );
    return;
  }

  if (error?.codeName === "AtlasError" && /bad auth/i.test(error.message || "")) {
    const summary = getMongoConnectionSummary(MONGO_URI);

    console.error("[startup] MongoDB authentication failed.");
    if (summary) {
      console.error(
        `[startup] Using user "${summary.user}" on "${summary.host}", database "${summary.database}", authSource "${summary.authSource}".`,
      );
    }
    console.error(
      "[startup] Check the Atlas database user credentials, make sure special characters are URL-encoded, and confirm authSource if needed.",
    );
    return;
  }

  console.error("[startup] MongoDB connection failed:", error.message || error);
};

if (!MONGO_URI) {
  console.error("[startup] MONGO_URI is missing. Add it to server/.env.");
  process.exit(1);
}

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);
app.use(cors(corsOptions));
app.use(requestLogger({ skip: () => NODE_ENV === "test" }));
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(sanitizeRequest({ replaceWith: "_" }));

app.use((error, req, res, next) => {
  if (
    error instanceof SyntaxError &&
    "body" in error &&
    /JSON/i.test(error.message || "")
  ) {
    return res.status(400).json({
      success: false,
      error: "Invalid JSON payload",
      message: "Request body contains malformed JSON.",
    });
  }

  return next(error);
});

app.use("/nbi/auth", authRouter);
app.use("/api/auth", authRouter);

app.use("/nbi/commerce", commerceRouter);
app.use("/nbi/affiliations", AffiliationsRouter);
app.use("/nbi/club-management", clubManagementRouter);
app.use("/nbi/club-applications", clubApplicationsRouter);
app.use("/nbi/clubs", clubsRouter);
app.use("/nbi/crates", cratesRouter);
app.use("/nbi/dashboard", dashboardRouter);
app.use("/nbi/lofts", loftsRouter);
app.use("/nbi/officers", officersRouter);
app.use("/nbi/owner-zone", ownerZoneRouter);
app.use("/nbi/birds", birdsRouter);
app.use("/nbi/ahp", avianHealthProfilesRouter);
app.use("/nbi/avian-health-profiles", avianHealthProfilesRouter);
app.use("/nbi/pigeons", birdsRouter);
app.use("/nbi/upload", uploadsRouter);
app.use("/nbi/race-entries", raceEntriesRouter);
app.use("/nbi/races", racesRouter);
app.use("/nbi/users", usersRouter);
app.use("/nbi/wallets", walletsRouter);
app.use("/nbi/portal-state", portalStateRouter);
app.use("/nbi/chatbot", chatbotRouter);
app.use("/nbi", liveOpsRouter);

app.use("/api/commerce", commerceRouter);
app.use("/api/affiliations", AffiliationsRouter);
app.use("/api/club-management", clubManagementRouter);
app.use("/api/club-applications", clubApplicationsRouter);
app.use("/api/clubs", clubsRouter);
app.use("/api/crates", cratesRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/lofts", loftsRouter);
app.use("/api/officers", officersRouter);
app.use("/api/owner-zone", ownerZoneRouter);
app.use("/api/birds", birdsRouter);
app.use("/api/ahp", avianHealthProfilesRouter);
app.use("/api/avian-health-profiles", avianHealthProfilesRouter);
app.use("/api/pigeons", birdsRouter);
app.use("/api/upload", uploadsRouter);
app.use("/api/race-entries", raceEntriesRouter);
app.use("/api/races", racesRouter);
app.use("/api/users", usersRouter);
app.use("/api/wallets", walletsRouter);
app.use("/api/portal-state", portalStateRouter);
app.use("/api/chatbot", chatbotRouter);
app.use("/api/test-email", testEmailRouter);
app.use("/api", liveOpsRouter);

app.get("/health", getHealth);

app.get("/nbi/routes", (req, res) => {
  res.json({
    payload: nbiRoutes,
    success: "NBI routes fetched successfully",
  });
});

app.get("/api/routes", (req, res) => {
  res.json({
    payload: nbiRoutes,
    success: "Legacy API routes fetched successfully",
  });
});

app.use(apiNotFoundHandler);
app.use(express.static(path.join(__dirname, "view")));

app.get(/^(?!\/(?:api|nbi)(?:\/|$)).*/, (_, res) => {
  res.sendFile(path.join(__dirname, "view", "index.html"));
});

app.use(errorHandler);

logNbiRoutes();

mongoose.connection.on("error", (error) => {
  console.error("[mongo] connection error:", error.message || error);
});

mongoose.connection.on("disconnected", () => {
  console.warn("[mongo] disconnected");
});

mongoose
  .connect(MONGO_URI, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 15000),
  })
  .then(() => {
    const summary = getMongoConnectionSummary(MONGO_URI);

    console.info("[startup] MongoDB connected");
    if (summary) {
      console.info(
        `[startup] Database "${summary.database}" on "${summary.host}" authenticated as "${summary.user}".`,
      );
    }
    console.info(`[startup] Environment: ${NODE_ENV}`);
    console.info(
      `[startup] Allowed client origins: ${allowedOrigins.length ? allowedOrigins.join(", ") : "(none configured)"}`,
    );

    app.listen(PORT, HOST, () => {
      console.info(`[startup] Server running on http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    logMongoStartupError(error);
    process.exit(1);
  });
