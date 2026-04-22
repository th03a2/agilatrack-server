import mongoose from "mongoose";

const { Schema } = mongoose;

export const CRATE_STATUSES = [
  "available",
  "assigned",
  "in_transit",
  "maintenance",
  "retired",
  "archived",
];

export const CRATE_TYPES = ["standard", "training", "race", "quarantine"];

const conditionCheckSchema = new Schema(
  {
    checkedAt: {
      type: Date,
      default: Date.now,
    },
    checkedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    condition: {
      type: String,
      enum: ["good", "needs_cleaning", "needs_repair", "unsafe"],
      default: "good",
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
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      match: [
        /^[A-Z0-9][A-Z0-9.-]*$/,
        "Crate code must use uppercase letters, numbers, dashes, and dots only.",
      ],
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    type: {
      type: String,
      enum: CRATE_TYPES,
      default: "standard",
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
    },
    loft: {
      type: Schema.Types.ObjectId,
      ref: "Lofts",
    },
    handler: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    capacity: {
      type: Number,
      min: 0,
      default: 0,
    },
    occupiedSlots: {
      type: Number,
      min: 0,
      default: 0,
    },
    sealNumber: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 40,
    },
    nfcTag: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 80,
    },
    status: {
      type: String,
      enum: CRATE_STATUSES,
      default: "available",
    },
    conditionChecks: {
      type: [conditionCheckSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
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

modelSchema.virtual("availableSlots").get(function getAvailableSlots() {
  return Math.max((this.capacity || 0) - (this.occupiedSlots || 0), 0);
});

modelSchema.pre("validate", function normalizeCrate(next) {
  if (this.occupiedSlots > this.capacity) {
    this.occupiedSlots = this.capacity;
  }

  next();
});

modelSchema.index(
  { club: 1, code: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
  },
);
modelSchema.index({ club: 1, status: 1, deletedAt: 1 });
modelSchema.index({ loft: 1, status: 1, deletedAt: 1 });
modelSchema.index({ handler: 1, status: 1, deletedAt: 1 });

const Entity = mongoose.model("Crates", modelSchema);

export default Entity;
