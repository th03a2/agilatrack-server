import express from "express";
import cors from "cors";
import dns from "node:dns";
import authRouter from "./routes/auth.js";
import affiliationsRouter from "./routes/affiliations.js";
import clubsRouter from "./routes/clubs.js";
import { getAllowedOrigins, corsOptions } from "./config/cors.js";
import { getCloudinaryStatus } from "./config/cloudinary.js";
import { connectDatabase, logMongoStartupError } from "./config/database.js";
import { env } from "./config/env.js";
import cratesRouter from "./routes/crates.js";
import loftsRouter from "./routes/lofts.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import officersRouter from "./routes/officers.js";
import pigeonsRouter from "./routes/pigeons.js";
import raceEntriesRouter from "./routes/raceEntries.js";
import racesRouter from "./routes/races.js";
import uploadRouter from "./routes/upload.js";
import { apiRoutes, logApiRoutes } from "./routes/index.js";
import usersRouter from "./routes/users.js";

dns.setServers(["1.1.1.1", "8.8.8.8"]);

const app = express();
const PORT = env.PORT;

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/auth", authRouter);
app.use("/api/affiliations", affiliationsRouter);
app.use("/api/clubs", clubsRouter);
app.use("/api/crates", cratesRouter);
app.use("/api/lofts", loftsRouter);
app.use("/api/officers", officersRouter);
app.use("/api/pigeons", pigeonsRouter);
app.use("/api/pegions", pigeonsRouter);
app.use("/api/race-entries", raceEntriesRouter);
app.use("/api/races", racesRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/users", usersRouter);

app.get("/api/routes", (req, res) => {
  res.json({
    success: "API routes fetched successfully",
    payload: apiRoutes,
  });
});

app.get("/", (req, res) => {
  res.json({
    success: "AgilaTrack API running",
    cors: {
      allowedOrigins: getAllowedOrigins(),
    },
    cloudinary: getCloudinaryStatus(),
    endpoints: {
      affiliations: "/api/affiliations",
      auth: "/api/auth/login",
      clubs: "/api/clubs",
      crates: "/api/crates",
      clubPyramid: "/api/clubs/pyramid",
      clubLevels: "/api/clubs/meta/levels",
      lofts: "/api/lofts",
      officers: "/api/officers",
      pigeons: "/api/pigeons",
      raceEntries: "/api/race-entries",
      races: "/api/races",
      routes: "/api/routes",
      upload: "/api/upload/profile-photo",
      users: "/api/users",
    },
  });
});

logApiRoutes();
console.log("Cloudinary status:", getCloudinaryStatus());

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
