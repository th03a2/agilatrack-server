import mongoose from "mongoose";
import {
  baseSchemaOptions,
  clubSummarySchema,
  createResourceCode,
  itemSummarySchema,
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
      default: "manual_order",
    },
    orderReference: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    status: {
      type: String,
      trim: true,
      lowercase: true,
      default: "draft",
    },
    customer: {
      type: ownerSummarySchema,
      default: () => ({}),
    },
    club: {
      type: clubSummarySchema,
      default: () => ({}),
    },
    item: {
      type: itemSummarySchema,
      default: () => ({ quantity: 1 }),
    },
    race: {
      type: raceSummarySchema,
      default: () => ({}),
    },
    total: {
      type: moneySchema,
      default: () => ({ amount: 0, currency: "PHP" }),
    },
    bookedAt: {
      type: Date,
      default: Date.now,
    },
    fulfilledAt: { type: Date },
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

modelSchema.pre("validate", function normalizeOrder(next) {
  if (!this.orderReference) {
    this.orderReference = createResourceCode("ORDER", this._id);
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
modelSchema.index({ orderReference: 1 });
modelSchema.index({ status: 1, source: 1, createdAt: -1 });
modelSchema.index({ "customer.user": 1, status: 1, createdAt: -1 });
modelSchema.index({ "race.race": 1, status: 1, createdAt: -1 });

const Entity = mongoose.model("Orders", modelSchema);

export default Entity;
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
