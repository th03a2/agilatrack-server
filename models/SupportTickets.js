import mongoose from "mongoose";
import {
  baseSchemaOptions,
  clubSummarySchema,
  ownerSummarySchema,
} from "./operationsShared.js";

const { Schema } = mongoose;

const SUPPORT_SEVERITIES = ["slate", "sky", "amber", "emerald", "violet", "rose"];

const modelSchema = new Schema(
  {
    externalKey: {
      type: String,
      trim: true,
    },
    sourceType: {
      type: String,
      trim: true,
      lowercase: true,
      default: "manual",
    },
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 140,
    },
    detail: {
      type: String,
      trim: true,
      required: true,
    },
    source: {
      type: String,
      trim: true,
    },
    severity: {
      type: String,
      enum: SUPPORT_SEVERITIES,
      default: "slate",
    },
    status: {
      type: String,
      trim: true,
      lowercase: true,
      default: "open",
    },
    openedAt: { type: Date },
    resolvedAt: { type: Date },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    owner: {
      type: ownerSummarySchema,
      default: () => ({}),
    },
    club: {
      type: clubSummarySchema,
      default: () => ({}),
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

modelSchema.index(
  { externalKey: 1 },
  {
    unique: true,
    partialFilterExpression: { externalKey: { $exists: true } },
  },
);
modelSchema.index({ status: 1, severity: 1, createdAt: -1 });
modelSchema.index({ sourceType: 1, status: 1, createdAt: -1 });
modelSchema.index({ "club.club": 1, status: 1, createdAt: -1 });
modelSchema.index({ "owner.user": 1, status: 1, createdAt: -1 });

const Entity = mongoose.model("SupportTickets", modelSchema);

export default Entity;

