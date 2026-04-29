import mongoose from "mongoose";
import {
  baseSchemaOptions,
  clubSummarySchema,
  createResourceCode,
  moneySchema,
  ownerSummarySchema,
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
    status: {
      type: String,
      trim: true,
      lowercase: true,
      default: "pending",
    },
    amount: {
      type: moneySchema,
      default: () => ({ amount: 0, currency: "PHP" }),
    },
    reference: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 64,
    },
    owner: {
      type: ownerSummarySchema,
      default: () => ({}),
    },
    club: {
      type: clubSummarySchema,
      default: () => ({}),
    },
    verification: {
      type: String,
      trim: true,
      lowercase: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    submittedLabel: {
      type: String,
      trim: true,
    },
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

modelSchema.pre("validate", function normalizePayment(next) {
  if (!this.reference) {
    this.reference = createResourceCode("PAY", this._id);
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
modelSchema.index({ status: 1, source: 1, createdAt: -1 });
modelSchema.index({ "owner.user": 1, status: 1, createdAt: -1 });
modelSchema.index({ "club.club": 1, status: 1, createdAt: -1 });
modelSchema.index({ reference: 1 });

const Entity = mongoose.model("Payments", modelSchema);

export default Entity;
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
