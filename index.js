import express from "express";
import cors from "cors";
import dns from "node:dns";
import authRouter from "./routes/auth.js";
import affiliationsRouter from "./routes/affiliations.js";
import clubsRouter from "./routes/clubs.js";
import { getAllowedOrigins, corsOptions } from "./config/cors.js";
import { getCloudinaryStatus } from "./config/cloudinary.js";
import {
  connectDatabase,
  getDatabaseHealth,
  logMongoStartupError,
} from "./config/database.js";
import { env, validateCriticalEnv } from "./config/env.js";
import cratesRouter from "./routes/crates.js";
import { sanitizeRequest } from "./middleware/sanitizeRequest.js";
import {
  apiLimiter,
  helmetMiddleware,
} from "./middleware/security.js";
import loftsRouter from "./routes/lofts.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import officersRouter from "./routes/officers.js";
<<<<<<< Updated upstream
import ordersRouter from "./routes/orders.js";
import paymentsRouter from "./routes/payments.js";
import pigeonsRouter from "./routes/pigeons.js";
=======
import birdsRouter from "./routes/birds.js";
import avianHealthProfilesRouter from "./routes/avianHealthProfiles.js";
import ordersRouter from "./routes/orders.js";
import paymentsRouter from "./routes/payments.js";
>>>>>>> Stashed changes
import payoutsRouter from "./routes/payouts.js";
import productsRouter from "./routes/products.js";
import raceEntriesRouter from "./routes/raceEntries.js";
import racesRouter from "./routes/races.js";
import sellersRouter from "./routes/sellers.js";
import shipmentsRouter from "./routes/shipments.js";
import supportRouter from "./routes/support.js";
import uploadRouter from "./routes/upload.js";
<<<<<<< Updated upstream
import { apiRoutes, logApiRoutes } from "./routes/index.js";
import usersRouter from "./routes/users.js";
=======
import { apiRoutes, logApiRoutes, logNbiRoutes, nbiRoutes } from "./routes/index.js";
import usersRouter from "./routes/users.js";
import walletsRouter from "./routes/wallets.js";
import { getAllowedOrigins, corsOptions } from "./config/cors.js";
import { getCloudinaryStatus } from "./config/cloudinary.js";
import {
  connectDatabase,
  getDatabaseHealth,
  logMongoStartupError,
} from "./config/database.js";
import { env, validateCriticalEnv } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { sanitizeRequest } from "./middleware/sanitizeRequest.js";
import { apiLimiter, helmetMiddleware } from "./middleware/security.js";
>>>>>>> Stashed changes

dns.setServers(["1.1.1.1", "8.8.8.8"]);

validateCriticalEnv();

const app = express();
const PORT = env.PORT;

app.disable("x-powered-by");
app.set("trust proxy", env.IS_PRODUCTION ? 1 : false);

app.use(helmetMiddleware);
app.use(cors(corsOptions));
app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: env.REQUEST_BODY_LIMIT }));
app.use(sanitizeRequest);
app.use("/api", apiLimiter);
<<<<<<< Updated upstream

app.use("/api/auth", authRouter);
app.use("/api/affiliations", affiliationsRouter);
app.use("/api/clubs", clubsRouter);
app.use("/api/crates", cratesRouter);
app.use("/api/lofts", loftsRouter);
app.use("/api/officers", officersRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/pigeons", pigeonsRouter);
app.use("/api/pegions", pigeonsRouter);
app.use("/api/payouts", payoutsRouter);
app.use("/api/products", productsRouter);
app.use("/api/race-entries", raceEntriesRouter);
app.use("/api/races", racesRouter);
app.use("/api/sellers", sellersRouter);
app.use("/api/shipments", shipmentsRouter);
app.use("/api/support", supportRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/users", usersRouter);
=======
app.use("/nbi", apiLimiter);

const registerRouteGroup = (prefix) => {
  app.use(`${prefix}/auth`, authRouter);
  app.use(`${prefix}/commerce`, commerceRouter);
  app.use(`${prefix}/affiliations`, affiliationsRouter);
  app.use(`${prefix}/club-management`, clubManagementRouter);
  app.use(`${prefix}/clubs`, clubsRouter);
  app.use(`${prefix}/crates`, cratesRouter);
  app.use(`${prefix}/lofts`, loftsRouter);
  app.use(`${prefix}/officers`, officersRouter);
  app.use(`${prefix}/birds`, birdsRouter);
  app.use(`${prefix}/ahp`, avianHealthProfilesRouter);
  app.use(`${prefix}/avian-health-profiles`, avianHealthProfilesRouter);
  app.use(`${prefix}/pigeons`, birdsRouter);
  app.use(`${prefix}/pegions`, birdsRouter);
  app.use(`${prefix}/orders`, ordersRouter);
  app.use(`${prefix}/payments`, paymentsRouter);
  app.use(`${prefix}/payouts`, payoutsRouter);
  app.use(`${prefix}/products`, productsRouter);
  app.use(`${prefix}/race-entries`, raceEntriesRouter);
  app.use(`${prefix}/races`, racesRouter);
  app.use(`${prefix}/sellers`, sellersRouter);
  app.use(`${prefix}/shipments`, shipmentsRouter);
  app.use(`${prefix}/support`, supportRouter);
  app.use(`${prefix}/upload`, uploadRouter);
  app.use(`${prefix}/users`, usersRouter);
  app.use(`${prefix}/wallets`, walletsRouter);
};

registerRouteGroup("/api");
registerRouteGroup("/nbi");
>>>>>>> Stashed changes

const buildHealthPayload = () => ({
  environment: env.NODE_ENV,
  status: "ok",
  timestamp: new Date().toISOString(),
  uptimeSeconds: Math.round(process.uptime()),
  database: getDatabaseHealth(),
<<<<<<< Updated upstream
=======
});

app.get("/nbi/routes", (req, res) => {
  res.json({
    success: "NBI routes fetched successfully",
    payload: nbiRoutes,
  });
>>>>>>> Stashed changes
});

app.get("/api/routes", (req, res) => {
  res.json({
    success: "API routes fetched successfully",
    payload: apiRoutes,
  });
});

app.get("/health", (req, res) => {
  res.json({
    success: "AgilaTrack API running",
    payload: buildHealthPayload(),
  });
});

app.get("/", (req, res) => {
  const payload = buildHealthPayload();

  if (!env.IS_PRODUCTION) {
    payload.cors = {
      allowedOrigins: getAllowedOrigins(),
    };
    payload.cloudinary = getCloudinaryStatus();
    payload.endpoints = {
      affiliations: "/api/affiliations",
      auth: "/api/auth/login",
<<<<<<< Updated upstream
      clubs: "/api/clubs",
=======
      authSession: "/api/auth/me",
      clubManagement: "/api/club-management",
      clubs: "/api/clubs",
      commerce: "/api/commerce",
>>>>>>> Stashed changes
      crates: "/api/crates",
      clubPyramid: "/api/clubs/pyramid",
      clubLevels: "/api/clubs/meta/levels",
      health: "/health",
      lofts: "/api/lofts",
      officers: "/api/officers",
<<<<<<< Updated upstream
      orders: "/api/orders",
      payments: "/api/payments",
      pigeons: "/api/pigeons",
=======
      birds: "/api/birds",
      pigeons: "/api/pigeons",
      avianHealthProfiles: "/api/ahp",
      orders: "/api/orders",
      payments: "/api/payments",
>>>>>>> Stashed changes
      payouts: "/api/payouts",
      products: "/api/products",
      raceEntries: "/api/race-entries",
      races: "/api/races",
      routes: "/api/routes",
      sellers: "/api/sellers",
      shipments: "/api/shipments",
      support: "/api/support",
      upload: "/api/upload/profile-photo",
      users: "/api/users",
<<<<<<< Updated upstream
=======
      wallets: "/api/wallets",
>>>>>>> Stashed changes
    };
  }

  res.json({
    success: "AgilaTrack API running",
    payload,
  });
});

if (!env.IS_PRODUCTION) {
  logApiRoutes();
<<<<<<< Updated upstream
=======
  logNbiRoutes();
  console.log("Allowed CORS origins:", getAllowedOrigins());
>>>>>>> Stashed changes
  console.log("Cloudinary status:", getCloudinaryStatus());
}

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

app.use(notFoundHandler);
app.use(errorHandler);

connectDatabase()
  .then(() => {
    const server = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });

    server.on("error", (err) => {
      console.error("Server error:", err.message, err);
    });

    server.on("listening", () => {
      console.log("Server is listening");
      console.log("Bound to:", server.address());
    });
  })
  .catch((err) => {
    logMongoStartupError(err);
    process.exit(1);
  });
