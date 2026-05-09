import mongoose from "mongoose";

const { Schema } = mongoose;

export const BETTING_MARKET_TYPES = [
  "winner",
  "top_3",
  "head_to_head",
  "custom",
];

export const BETTING_MARKET_STATUSES = [
  "draft",
  "open",
  "suspended",
  "closed",
  "settled",
  "cancelled",
];

const selectionSchema = new Schema(
  {
    raceEntry: {
      type: Schema.Types.ObjectId,
      ref: "RaceEntries",
      required: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    odds: {
      decimal: {
        type: Number,
        required: true,
        min: 1.01,
      },
      numerator: {
        type: Number,
        min: 1,
      },
      denominator: {
        type: Number,
        min: 1,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    status: {
      type: String,
      enum: ["open", "suspended", "won", "lost", "void"],
      default: "open",
    },
    resultRank: {
      type: Number,
      min: 1,
    },
  },
  { timestamps: true },
);

const modelSchema = new Schema(
  {
    race: {
      type: Schema.Types.ObjectId,
      ref: "Races",
      required: true,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 40,
      match: [
        /^[A-Z0-9][A-Z0-9.-]*$/,
        "Betting market code must use uppercase letters, numbers, dashes, and dots only.",
      ],
    },
    type: {
      type: String,
      enum: BETTING_MARKET_TYPES,
      default: "winner",
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: "PHP",
      minlength: 3,
      maxlength: 3,
    },
    bettingWindow: {
      opensAt: { type: Date },
      closesAt: { type: Date },
    },
    selections: [selectionSchema],
    status: {
      type: String,
      enum: BETTING_MARKET_STATUSES,
      default: "draft",
    },
    settledAt: { type: Date },
    settledBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    notes: { type: String, trim: true },
    deletedAt: { type: String },
  },
  {
    timestamps: true,
  },
);

modelSchema.pre("validate", function validateMarket(next) {
  if (!this.selections?.length) {
    return next(new Error("At least one betting market selection is required."));
  }

  const selectionIds = this.selections.map((selection) =>
    String(selection.raceEntry),
  );
  const uniqueSelectionIds = new Set(selectionIds);

  if (selectionIds.length !== uniqueSelectionIds.size) {
    return next(new Error("Betting market selections must be unique."));
  }

  const opensAt = this.bettingWindow?.opensAt;
  const closesAt = this.bettingWindow?.closesAt;

  if (opensAt && closesAt && closesAt <= opensAt) {
    return next(new Error("Betting window close time must be after open time."));
  }

  next();
});

modelSchema.index({ race: 1, status: 1, deletedAt: 1 });
modelSchema.index({ club: 1, status: 1, createdAt: -1 });
modelSchema.index({ "selections.raceEntry": 1 });

const Entity = mongoose.model("BettingMarkets", modelSchema);

export default Entity;
