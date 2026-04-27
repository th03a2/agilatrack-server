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
      default: "manual_catalog",
    },
    category: {
      type: String,
      trim: true,
      lowercase: true,
      default: "merchandise",
    },
    name: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    reference: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      trim: true,
      lowercase: true,
      default: "active",
    },
    inventoryCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    pricing: {
      type: moneySchema,
      default: () => ({ amount: 0, currency: "PHP" }),
    },
    club: {
      type: clubSummarySchema,
      default: () => ({}),
    },
    owner: {
      type: ownerSummarySchema,
      default: () => ({}),
    },
    description: {
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

modelSchema.pre("validate", function normalizeProduct(next) {
  if (!this.reference) {
    this.reference = createResourceCode("PRODUCT", this._id);
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
modelSchema.index({ status: 1, category: 1, createdAt: -1 });
modelSchema.index({ source: 1, status: 1, createdAt: -1 });
modelSchema.index({ "club.club": 1, status: 1, createdAt: -1 });
modelSchema.index({ reference: 1 });

const Entity = mongoose.model("Products", modelSchema);

export default Entity;

