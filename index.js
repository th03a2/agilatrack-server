import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRouter from "./routes/auth.js";
import commerceRouter from "./commerce/routes.js";
import affiliationsRouter from "./routes/affiliations.js";
import clubManagementRouter from "./routes/clubManagement.js";
import clubsRouter from "./routes/clubs.js";
import cratesRouter from "./routes/crates.js";
import loftsRouter from "./routes/lofts.js";
import officersRouter from "./routes/officers.js";
import birdsRouter from "./routes/birds.js";
import raceEntriesRouter from "./routes/raceEntries.js";
import racesRouter from "./routes/races.js";
import { nbiRoutes, logNbiRoutes } from "./routes/index.js";
import usersRouter from "./routes/users.js";
import walletsRouter from "./routes/wallets.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env"), quiet: true });

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

app.use(cors());
app.use(express.json());

app.use((error, req, res, next) => {
  if (
    error instanceof SyntaxError &&
    "body" in error &&
    /JSON/i.test(error.message || "")
  ) {
    return res.status(400).json({
      error: "Invalid JSON payload",
      message: "Request body contains malformed JSON.",
    });
  }

  return next(error);
});

app.use("/nbi/auth", authRouter);
app.use("/nbi/commerce", commerceRouter);
app.use("/nbi/affiliations", affiliationsRouter);
app.use("/nbi/club-management", clubManagementRouter);
app.use("/nbi/clubs", clubsRouter);
app.use("/nbi/crates", cratesRouter);
app.use("/nbi/lofts", loftsRouter);
app.use("/nbi/officers", officersRouter);
app.use("/nbi/birds", birdsRouter);
app.use("/nbi/pigeons", birdsRouter);
app.use("/nbi/pegions", birdsRouter);
app.use("/nbi/race-entries", raceEntriesRouter);
app.use("/nbi/races", racesRouter);
app.use("/nbi/users", usersRouter);
app.use("/nbi/wallets", walletsRouter);

// Legacy aliases kept during route transition.
app.use("/api/auth", authRouter);
app.use("/api/commerce", commerceRouter);
app.use("/api/affiliations", affiliationsRouter);
app.use("/api/club-management", clubManagementRouter);
app.use("/api/clubs", clubsRouter);
app.use("/api/crates", cratesRouter);
app.use("/api/lofts", loftsRouter);
app.use("/api/officers", officersRouter);
app.use("/api/birds", birdsRouter);
app.use("/api/pigeons", birdsRouter);
app.use("/api/pegions", birdsRouter);
app.use("/api/race-entries", raceEntriesRouter);
app.use("/api/races", racesRouter);
app.use("/api/users", usersRouter);
app.use("/api/wallets", walletsRouter);

app.get("/nbi/routes", (req, res) => {
  res.json({
    success: "NBI routes fetched successfully",
    payload: nbiRoutes,
  });
});

app.get("/api/routes", (req, res) => {
  res.json({
    success: "Legacy API routes fetched successfully",
    payload: nbiRoutes,
  });
});

// test route
app.get("/", (req, res) => {
  res.json({
    success: "AgilaTrack NBI running",
    endpoints: {
      affiliations: "/nbi/affiliations",
      auth: "/nbi/auth/login",
      clubManagement: "/nbi/club-management",
      commerce: "/nbi/commerce",
      clubs: "/nbi/clubs",
      crates: "/nbi/crates",
      clubPyramid: "/nbi/clubs/pyramid",
      clubLevels: "/nbi/clubs/meta/levels",
      lofts: "/nbi/lofts",
      officers: "/nbi/officers (legacy alias)",
      birds: "/nbi/birds",
      pigeons: "/nbi/pigeons",
      raceEntries: "/nbi/race-entries",
      races: "/nbi/races",
      routes: "/nbi/routes",
      users: "/nbi/users",
      wallets: "/nbi/wallets",
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
  if (
    error?.name === "MongooseServerSelectionError" ||
    /querySrv|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|IP address/i.test(
      error?.message || "",
    )
  ) {
    const summary = getMongoConnectionSummary(MONGO_URI);

    console.error("MongoDB connection could not be reached.");
    if (summary) {
      console.error(
        `Trying to connect to "${summary.host}" as "${summary.user}".`,
      );
    }
    console.error(`Original error: ${error.message || error}`);
    console.error(
      "Check your internet connection, MongoDB Atlas Network Access IP whitelist, and the MONGO_URI value in server/.env.",
    );
    return;
  }

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

logNbiRoutes();

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
