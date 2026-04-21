import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRouter from "./routes/auth.js";
import affiliationsRouter from "./routes/affiliations.js";
import clubsRouter from "./routes/clubs.js";
import loftsRouter from "./routes/lofts.js";
import officersRouter from "./routes/officers.js";
import pigeonsRouter from "./routes/pigeons.js";
import raceEntriesRouter from "./routes/raceEntries.js";
import racesRouter from "./routes/races.js";
import { apiRoutes, logApiRoutes } from "./routes/index.js";
import usersRouter from "./routes/users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/affiliations", affiliationsRouter);
app.use("/api/clubs", clubsRouter);
app.use("/api/lofts", loftsRouter);
app.use("/api/officers", officersRouter);
app.use("/api/pigeons", pigeonsRouter);
app.use("/api/pegions", pigeonsRouter);
app.use("/api/race-entries", raceEntriesRouter);
app.use("/api/races", racesRouter);
app.use("/api/users", usersRouter);

app.get("/api/routes", (req, res) => {
  res.json({
    success: "API routes fetched successfully",
    payload: apiRoutes,
  });
});

// test route
app.get("/", (req, res) => {
  res.json({
    success: "AgilaTrack API running",
    endpoints: {
      affiliations: "/api/affiliations",
      auth: "/api/auth/login",
      clubs: "/api/clubs",
      clubPyramid: "/api/clubs/pyramid",
      clubLevels: "/api/clubs/meta/levels",
      lofts: "/api/lofts",
      officers: "/api/officers",
      pigeons: "/api/pigeons",
      pegions: "/api/pegions",
      raceEntries: "/api/race-entries",
      races: "/api/races",
      routes: "/api/routes",
      users: "/api/users",
    },
  });
});

const getMongoConnectionSummary = (uri) => {
  try {
    const parsed = new URL(uri);

    return {
      user: parsed.username || "(missing)",
      host: parsed.host || "(missing)",
      database: parsed.pathname.replace("/", "") || "(none)",
      authSource: parsed.searchParams.get("authSource") || "(default)",
    };
  } catch {
    return null;
  }
};

const logMongoStartupError = (error) => {
  if (error?.codeName === "AtlasError" && /bad auth/i.test(error.message)) {
    const summary = getMongoConnectionSummary(MONGO_URI);

    console.error("MongoDB authentication failed.");
    if (summary) {
      console.error(
        `Using user "${summary.user}" on "${summary.host}", database "${summary.database}", authSource "${summary.authSource}".`,
      );
    }
    console.error(
      "Check the Atlas database user's username/password, make sure special characters in the password are URL-encoded, and try adding authSource=admin to MONGO_URI if the user was created in Atlas.",
    );
    return;
  }

  console.error("MongoDB connection failed:", error.message || error);
};

if (!MONGO_URI) {
  console.error("MONGO_URI is missing. Add it to server/.env.");
  process.exit(1);
}

logApiRoutes();

// connect mongo
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("Mongo connected");

    app.listen(PORT, () => {
      console.log(`Server running on ${PORT}`);
    });
  })
  .catch((err) => {
    logMongoStartupError(err);
    process.exit(1);
  });
