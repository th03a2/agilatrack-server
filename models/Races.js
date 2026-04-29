import mongoose from "mongoose";

const { Schema } = mongoose;

export const RACE_STATUSES = [
  "draft",
  "booking_open",
  "booking_closed",
  "check_in",
  "boarding",
  "departed",
  "completed",
  "cancelled",
];

export const RACE_CATEGORIES = ["training", "race", "derby"];

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
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
    },
    organizer: {
      type: Schema.Types.ObjectId,
      ref: "Users",
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
    status: {
      type: String,
      enum: RACE_STATUSES,
      default: "draft",
    },
    notes: { type: String, trim: true },
    deletedAt: { type: String },
  },
  {
    timestamps: true,
  },
);

modelSchema.pre("validate", function setDepartureGeoPoint(next) {
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
modelSchema.index({ status: 1, raceDate: -1 });
modelSchema.index({ "departure.geo": "2dsphere" });

const Entity = mongoose.model("Races", modelSchema);

export default Entity;
