import mongoose from "mongoose";
import {
  baseSchemaOptions,
  birdSummarySchema,
  clubSummarySchema,
  createResourceCode,
  moneySchema,
  ownerSummarySchema,
  raceSummarySchema,
} from "./operationsShared.js";

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    externalKey: {
      type: String,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
      lowercase: true,
      default: "manual",
    },
    amount: {
      type: moneySchema,
      default: () => ({ amount: 0, currency: "PHP" }),
    },
    bird: {
      type: birdSummarySchema,
      default: () => ({}),
    },
    club: {
      type: clubSummarySchema,
      default: () => ({}),
    },
    owner: {
      type: ownerSummarySchema,
      default: () => ({}),
    },
    payoutReference: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    payoutStatus: {
      type: String,
      trim: true,
      lowercase: true,
      default: "draft",
    },
    race: {
      type: raceSummarySchema,
      default: () => ({}),
    },
    rank: {
      type: Number,
      min: 0,
      default: 0,
    },
    recordedAt: { type: Date },
    notes: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({}),
    },
    deletedAt: { type: String },
  },
  baseSchemaOptions,
);

modelSchema.pre("validate", function normalizePayout(next) {
  if (!this.payoutReference) {
    this.payoutReference = createResourceCode("PAYOUT", this._id);
  }

  next();
});

modelSchema.index(
  { externalKey: 1 },
  {
    unique: true,
    partialFilterExpression: { externalKey: { $exists: true } },
  },
);
modelSchema.index({ payoutStatus: 1, rank: 1, createdAt: -1 });
modelSchema.index({ "race.race": 1, payoutStatus: 1, createdAt: -1 });
modelSchema.index({ "club.club": 1, payoutStatus: 1, createdAt: -1 });
modelSchema.index({ payoutReference: 1 });

const Entity = mongoose.model("Payouts", modelSchema);

export default Entity;
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
