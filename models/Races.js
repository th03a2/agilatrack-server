import mongoose from "mongoose";

const { Schema } = mongoose;

export const RACE_STATUSES = [
  "draft",
  "open",
  "closed",
  "booking_open",
  "booking_closed",
  "basketing",
  "check_in",
  "boarding",
  "liberated",
  "departed",
  "completed",
  "cancelled",
];

export const RACE_CATEGORIES = ["training", "race", "derby"];
export const RACE_TYPES = [
  "training_toss",
  "official_race",
  "derby",
  "federation_event",
];

export const normalizeRaceType = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (normalized.includes("training")) return "training_toss";
  if (normalized.includes("derby")) return "derby";
  if (normalized.includes("federation")) return "federation_event";
  if (normalized.includes("official")) return "official_race";

  return normalized.replace(/\s+/g, "_") || "official_race";
};

export const normalizeRaceCategory = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized) return "race";
  if (normalized === "competition") return "race";
  if (normalized.includes("training")) return "training";
  if (["derby", "futurity"].includes(normalized)) return "derby";
  if (["old bird", "young bird", "open", "race"].includes(normalized))
    return "race";

  return normalized;
};

export const normalizeRaceStatus = (value = "") => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  if (normalized === "open") return "booking_open";
  if (normalized === "closed") return "booking_closed";
  if (normalized === "basketing") return "boarding";
  if (normalized === "liberated") return "departed";

  return normalized.replace(/\s+/g, "_") || "draft";
};

const coordinateSchema = new Schema(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
  },
  { _id: false },
);

const modelSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      match: [
        /^[A-Z0-9][A-Z0-9.-]*$/,
        "Race code must use uppercase letters, numbers, dashes, and dots only.",
      ],
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    raceName: {
      type: String,
      trim: true,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
    },
    clubId: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
    },
    organizer: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    raceType: {
      type: String,
      enum: RACE_TYPES,
      default: "official_race",
      trim: true,
      set: normalizeRaceType,
    },
    category: {
      type: String,
      trim: true,
      enum: RACE_CATEGORIES,
      default: "race",
      lowercase: true,
      set: normalizeRaceCategory,
    },
    entryFee: {
      amount: {
        type: Number,
        min: 0,
        default: 0,
      },
      currency: {
        type: String,
        trim: true,
        uppercase: true,
        default: "PHP",
        minlength: 3,
        maxlength: 8,
      },
    },
    minimumRacers: {
      type: Number,
      min: 1,
    },
    raceDate: {
      type: Date,
      required: true,
    },
    scheduledDate: {
      type: Date,
    },
    basketingDate: {
      type: Date,
    },
    booking: {
      opensAt: { type: Date },
      closesAt: { type: Date },
    },
    checkIn: {
      startsAt: { type: Date },
      endsAt: { type: Date },
      location: { type: String, trim: true },
    },
    boarding: {
      startsAt: { type: Date },
      endsAt: { type: Date },
      location: { type: String, trim: true },
    },
    departure: {
      siteName: {
        type: String,
        required: true,
        trim: true,
      },
      departedAt: {
        type: Date,
      },
      coordinates: {
        type: coordinateSchema,
        required: true,
      },
      geo: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number],
          default: undefined,
        },
      },
      address: {
        municipality: { type: String, trim: true },
        province: { type: String, trim: true },
        region: { type: String, trim: true },
      },
    },
    weather: {
      condition: { type: String, trim: true },
      wind: { type: String, trim: true },
      temperatureC: { type: Number },
      notes: { type: String, trim: true },
    },
    distance: {
      value: { type: Number, min: 0 },
      unit: {
        type: String,
        enum: ["meters", "kilometers", "yards", "miles"],
        default: "kilometers",
      },
    },
    birdLimit: { type: Number, min: 1 },
    assignedOperators: [
      {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
    rules: { type: String, trim: true },
    results: {
      publishedAt: { type: Date },
      publishedBy: {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
      lockedAt: { type: Date },
      lockedBy: {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
      speedUnit: {
        type: String,
        default: "meters_per_minute",
      },
    },
    status: {
      type: String,
      enum: RACE_STATUSES,
      default: "draft",
      set: normalizeRaceStatus,
    },
    notes: { type: String, trim: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    deletedAt: { type: String },
  },
  {
    timestamps: true,
  },
);

modelSchema.pre("validate", function setDepartureGeoPoint(next) {
  if (!this.clubId && this.club) {
    this.clubId = this.club;
  }

  if (!this.club && this.clubId) {
    this.club = this.clubId;
  }

  if (!this.raceName && this.name) {
    this.raceName = this.name;
  }

  if (!this.name && this.raceName) {
    this.name = this.raceName;
  }

  if (!this.scheduledDate && this.raceDate) {
    this.scheduledDate = this.raceDate;
  }

  const latitude = this.departure?.coordinates?.latitude;
  const longitude = this.departure?.coordinates?.longitude;

  if (latitude !== undefined && longitude !== undefined) {
    this.departure.geo = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
  }

  next();
});

modelSchema.index({ club: 1, raceDate: -1, deletedAt: 1 });
modelSchema.index({ clubId: 1, raceDate: -1, deletedAt: 1 });
modelSchema.index({ status: 1, raceDate: -1 });
modelSchema.index({ "departure.geo": "2dsphere" });

const Entity = mongoose.model("Races", modelSchema);

export default Entity;
