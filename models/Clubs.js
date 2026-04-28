import mongoose from "mongoose";
const { Schema } = mongoose;

export const CLUB_LEVELS = [
  "municipality",
  "provincial",
  "regional",
  "national",
];
export const CLUB_TYPES = ["club", "operator"];
export const CLUB_OWNERSHIP_TYPES = ["sole", "multiple"];

export const CLUB_PARENT_LEVEL = {
  municipality: "provincial",
  provincial: "regional",
  regional: "national",
  national: null,
};

export const getClubTypeFromLevel = (level) =>
  level === "municipality" ? "club" : "operator";

const modelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
      match: [
        /^[A-Z0-9][A-Z0-9.-]*$/,
        "Club code must use uppercase letters, numbers, dashes, and dots only.",
      ],
    },
    abbr: { type: String, trim: true },
    lid: { type: String },
    bid: { type: String },

    level: {
      type: String,
      enum: CLUB_LEVELS,
      required: true,
    },

    type: {
      type: String,
      enum: CLUB_TYPES,
      required: true,
      default: "club",
    },

    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clubs",
      default: null,
      validate: {
        validator(value) {
          if (this.level === "national") return value === null;
          return value != null;
        },
        message:
          "Only national clubs may have no parent; municipality, provincial, and regional clubs must have a parent.",
      },
    },

    // Pyramid scope:
    // municipality -> province -> region -> national
    location: {
      region: {
        type: String,
        trim: true,
        required() {
          return ["municipality", "provincial", "regional"].includes(
            this.level,
          );
        },
      },
      regionCode: {
        type: String,
        uppercase: true,
        trim: true,
        required() {
          return ["municipality", "provincial", "regional"].includes(
            this.level,
          );
        },
        match: [
          /^[A-Z0-9]{2,4}$/,
          "Region code must be 2 to 4 uppercase letters or numbers.",
        ],
      },
      province: {
        type: String,
        trim: true,
        required() {
          return ["municipality", "provincial"].includes(this.level);
        },
      },
      provinceCode: {
        type: String,
        uppercase: true,
        trim: true,
        required() {
          return ["municipality", "provincial"].includes(this.level);
        },
        match: [
          /^[A-Z0-9]{2,4}$/,
          "Province code must be 2 to 4 uppercase letters or numbers.",
        ],
      },
      municipality: {
        type: String,
        trim: true,
        required() {
          return this.level === "municipality";
        },
      },
      municipalityCode: {
        type: String,
        uppercase: true,
        trim: true,
        required() {
          return this.level === "municipality";
        },
        match: [
          /^[A-Z0-9]{2,4}$/,
          "Municipality code must be 2 to 4 uppercase letters or numbers.",
        ],
      },
      barangayCode: {
        type: String,
        trim: true,
        match: [/^\d{4}$/, "Barangay code must be exactly 4 digits."],
      },
    },

    management: {
      owner: {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Users",
        },
      },
      secretary: {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Users",
        },
      },
      coordinator: {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Users",
        },
        source: {
          type: String,
          enum: ["secretary", "owner"],
        },
      },
    },
    ownershipType: {
      type: String,
      enum: CLUB_OWNERSHIP_TYPES,
      default: "sole",
      trim: true,
      lowercase: true,
    },

    contacts: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },

    address: {
      street: { type: String },
      zip: { type: String },
      latitude: { type: String },
      longitude: { type: String },
    },

    isActive: { type: Boolean, default: true },
    population: { type: Number },

    status: {
      type: String,
      enum: ["draft", "pending", "approved", "declined"],
      default: "draft",
    },

    tagline: { type: String },
    history: { type: String },
    message: { type: String },
    social: {
      fb: { type: String },
      ig: { type: String },
      x: { type: String },
    },
    logo: {
      url: { type: String },
      publicId: { type: String },
      version: { type: String },
      updatedAt: { type: Date },
    },

    deletedAt: { type: String },
  },
  {
    timestamps: true,
  },
);

modelSchema.pre("validate", function resolveCoordinator(next) {
  this.type = getClubTypeFromLevel(this.level);

  const secretaryUser = this.management?.secretary?.user || null;
  const ownerUser = this.management?.owner?.user || null;
  const coordinatorUser = secretaryUser || ownerUser || null;

  if (!this.management) {
    this.management = {};
  }

  if (coordinatorUser) {
    this.management.coordinator = {
      user: coordinatorUser,
      source: secretaryUser ? "secretary" : "owner",
    };
  } else if (this.management.coordinator) {
    this.management.coordinator = undefined;
  }

  next();
});

modelSchema.index({ level: 1, parent: 1, deletedAt: 1 });
modelSchema.index({
  "location.region": 1,
  "location.regionCode": 1,
  "location.province": 1,
  "location.provinceCode": 1,
  "location.municipality": 1,
  "location.municipalityCode": 1,
  "location.barangayCode": 1,
});

const Entity = mongoose.model("Clubs", modelSchema);

export default Entity;
