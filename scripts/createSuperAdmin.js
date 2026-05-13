import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { genSalt, hash } from "bcryptjs";
import Users from "../models/Users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const {
  MONGO_URI,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  SUPER_ADMIN_FNAME,
  SUPER_ADMIN_LNAME,
} = process.env;

const required = {
  MONGO_URI,
  SUPER_ADMIN_EMAIL,
  SUPER_ADMIN_PASSWORD,
  SUPER_ADMIN_FNAME,
  SUPER_ADMIN_LNAME,
};

for (const [key, value] of Object.entries(required)) {
  if (!value) {
    console.error(`❌ ${key} is missing from .env file`);
    process.exit(1);
  }
}

async function createOrUpdateSuperAdmin() {
  try {
    console.log("🔐 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const email = SUPER_ADMIN_EMAIL.toLowerCase().trim();
    const username = email.split("@")[0];

    console.log("🔒 Hashing password...");
    const salt = await genSalt(10);
    const hashedPassword = await hash(SUPER_ADMIN_PASSWORD, salt);

    const payload = {
      email,
      username,
      password: hashedPassword,

      fullName: {
        fname: SUPER_ADMIN_FNAME.trim(),
        lname: SUPER_ADMIN_LNAME.trim(),
      },

      role: "super_admin",
      membershipStatus: "active",
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      profileCompleted: true,
      isActive: true,
      membership: "premium",
      state: ["verified"],

      activePlatform: {
        _id: null,
        access: [
          "super_admin",
          "admin",
          "owner",
          "secretary",
          "operator",
          "member",
          "fancier",
        ],
        club: null,
        portal: "super_admin",
        role: "super_admin",
      },

      profile: {
        status: "approved",
        at: new Date(),
      },
    };

    console.log("👤 Creating/updating super admin account...");

    const superAdmin = await Users.findOneAndUpdate(
      { email },
      { $set: payload },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    console.log("✅ Super admin account is ready!");
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Name: ${superAdmin.fullName?.fname} ${superAdmin.fullName?.lname}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   Portal: ${superAdmin.activePlatform?.portal}`);
    console.log("   Password: [HIDDEN - Check your .env file]");
  } catch (error) {
    console.error("❌ Error creating/updating super admin:", error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected from MongoDB");
  }
}

createOrUpdateSuperAdmin();