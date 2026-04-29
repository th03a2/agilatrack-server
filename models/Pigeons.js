<<<<<<< Updated upstream
import mongoose from "mongoose";

const { Schema } = mongoose;

export const PIGEON_SEXES = ["cock", "hen", "unknown"];
export const PIGEON_STATUSES = [
  "active",
  "breeding",
  "training",
  "retired",
  "lost",
  "deceased",
  "sold",
  "archived",
];
=======
export {
  BIRD_SEXES as PIGEON_SEXES,
  BIRD_STATUSES as PIGEON_STATUSES,
  default,
} from "./Birds.js";
>>>>>>> Stashed changes

export const PIGEON_HEALTH_STATUSES = [
  "Excellent",
  "Good",
  "Fair",
  "Poor",
];
<<<<<<< Updated upstream

const parentSchema = new Schema(
  {
    pigeon: {
      type: Schema.Types.ObjectId,
      ref: "Pigeons",
    },
    bandNumber: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 40,
    },
    name: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const healthRecordSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["vaccination", "medication", "checkup", "injury", "other"],
      default: "other",
    },
    name: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    administeredBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const modelSchema = new Schema(
  {
    bandNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 40,
      match: [
        /^[A-Z0-9][A-Z0-9 ./-]*$/,
        "Band number must use uppercase letters, numbers, spaces, dashes, slashes, and dots only.",
      ],
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    birdImage: {
      type: String,
      trim: true,
    },
    sex: {
      type: String,
      enum: PIGEON_SEXES,
      default: "unknown",
    },
    color: {
      type: String,
      trim: true,
    },
    healthStatus: {
      type: String,
      enum: PIGEON_HEALTH_STATUSES,
      default: "Good",
    },
    strain: {
      type: String,
      trim: true,
    },
    hatchDate: {
      type: Date,
    },
    hatchYear: {
      type: Number,
      min: 1900,
      max: 2200,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    affiliation: {
      type: Schema.Types.ObjectId,
      ref: "Affiliations",
    },
    loft: {
      type: Schema.Types.ObjectId,
      ref: "Lofts",
    },
    breeder: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    parents: {
      sire: {
        type: parentSchema,
        default: () => ({}),
      },
      dam: {
        type: parentSchema,
        default: () => ({}),
      },
    },
    pedigree: {
      familyName: {
        type: String,
        trim: true,
      },
      notes: {
        type: String,
        trim: true,
      },
    },
    healthRecords: {
      type: [healthRecordSchema],
      default: [],
    },
    status: {
      type: String,
      enum: PIGEON_STATUSES,
      default: "active",
    },
    remarks: {
      type: [String],
      default: [],
    },
    deletedAt: {
      type: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

modelSchema.virtual("isRaceEligible").get(function getIsRaceEligible() {
  return ["active", "training"].includes(this.status) && !this.deletedAt;
});

modelSchema.pre("validate", function normalizePigeon(next) {
  if (!this.hatchYear && this.hatchDate) {
    this.hatchYear = this.hatchDate.getFullYear();
  }

  next();
});

modelSchema.index(
  { club: 1, bandNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
  },
);
modelSchema.index({ owner: 1, status: 1, deletedAt: 1 });
modelSchema.index({ affiliation: 1, status: 1, deletedAt: 1 });
modelSchema.index({ loft: 1, status: 1, deletedAt: 1 });
modelSchema.index({ club: 1, status: 1, createdAt: -1 });

const Entity = mongoose.model("Pigeons", modelSchema);

export default Entity;
=======
>>>>>>> Stashed changes
