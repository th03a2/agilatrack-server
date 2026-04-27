import mongoose from "mongoose";
import {
  baseSchemaOptions,
  clubSummarySchema,
} from "./operationsShared.js";

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    externalKey: {
      type: String,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    club: {
      type: clubSummarySchema,
      default: () => ({}),
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    level: {
      type: String,
      trim: true,
      lowercase: true,
    },
    location: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
    },
    sellerStatus: {
      type: String,
      trim: true,
      lowercase: true,
      default: "active",
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

modelSchema.index(
  { externalKey: 1 },
  {
    unique: true,
    partialFilterExpression: { externalKey: { $exists: true } },
  },
);
modelSchema.index({ name: 1 });
modelSchema.index({ sellerStatus: 1, level: 1, createdAt: -1 });
modelSchema.index({ "club.club": 1, sellerStatus: 1, createdAt: -1 });

const Entity = mongoose.model("Sellers", modelSchema);

export default Entity;

