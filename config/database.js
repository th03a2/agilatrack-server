import mongoose from "mongoose";
import { env } from "./env.js";

const readyStateLabel = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

let listenersRegistered = false;

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

export const logMongoStartupError = (error) => {
  if (
    error?.name === "MongooseServerSelectionError" ||
    /querySrv|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|IP address/i.test(error?.message || "")
  ) {
    const summary = getMongoConnectionSummary(env.MONGO_URI);

    console.error("MongoDB connection could not be reached.");
    if (summary) {
      console.error(`Trying to connect to "${summary.host}" as "${summary.user}".`);
    }
    console.error(`Original error: ${error.message || error}`);
    console.error(
      "Check your internet connection, MongoDB Atlas Network Access IP whitelist, and the MONGO_URI value in server/.env.",
    );
    return;
  }

  if (error?.codeName === "AtlasError" && /bad auth/i.test(error.message)) {
    const summary = getMongoConnectionSummary(env.MONGO_URI);
    const hasAtlasAuthShape =
      summary?.database !== "(none)" && summary?.authSource === "admin";

    console.error("MongoDB authentication failed.");
    if (summary) {
      console.error(
        `Using user "${summary.user}" on "${summary.host}", database "${summary.database}", authSource "${summary.authSource}".`,
      );
    }
    console.error(
      hasAtlasAuthShape
        ? "Atlas is reachable, but it rejected the database user's credentials. Reset the Atlas Database Access password, update MONGO_URI, and URL-encode any special characters in the password."
        : "Check the Atlas database user's username/password, make sure special characters in the password are URL-encoded, and add a database path with authSource=admin to MONGO_URI if the user was created in Atlas.",
    );
    return;
  }

  console.error("MongoDB connection failed:", error.message || error);
};

export const connectDatabase = async () => {
  if (!env.MONGO_URI) {
    throw new Error("MONGO_URI is missing. Add it to server/.env.");
  }

  if (!listenersRegistered) {
    mongoose.connection.on("connected", () => {
      console.log("Mongo connected");
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("Mongo disconnected");
    });

    mongoose.connection.on("error", (error) => {
      console.error("Mongo runtime error:", error.message || error);
    });

    listenersRegistered = true;
  }

  await mongoose.connect(env.MONGO_URI, {
    autoIndex: !env.IS_PRODUCTION,
    maxPoolSize: env.MONGO_MAX_POOL_SIZE,
    serverSelectionTimeoutMS: env.MONGO_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS: env.MONGO_SOCKET_TIMEOUT_MS,
  });

  return mongoose.connection;
};

export const getDatabaseHealth = () => ({
  state: readyStateLabel[mongoose.connection.readyState] || "unknown",
});
