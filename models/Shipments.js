import mongoose from "mongoose";
import {
  baseSchemaOptions,
  clubSummarySchema,
  createResourceCode,
  raceSummarySchema,
} from "./operationsShared.js";

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    externalKey: {
      type: String,
      trim: true,
    },
    trackingReference: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    shipmentStatus: {
      type: String,
      trim: true,
      lowercase: true,
      default: "draft",
    },
    club: {
      type: clubSummarySchema,
      default: () => ({}),
    },
    race: {
      type: raceSummarySchema,
      default: () => ({}),
    },
    departureSite: {
      type: String,
      trim: true,
    },
    booked: {
      type: Number,
      min: 0,
      default: 0,
    },
    staged: {
      type: Number,
      min: 0,
      default: 0,
    },
    departed: {
      type: Number,
      min: 0,
      default: 0,
    },
    received: {
      type: Number,
      min: 0,
      default: 0,
    },
    scheduledAt: { type: Date },
    departedAt: { type: Date },
    deliveredAt: { type: Date },
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

modelSchema.pre("validate", function normalizeShipment(next) {
  if (!this.trackingReference) {
    this.trackingReference = createResourceCode("SHIP", this._id);
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
modelSchema.index({ trackingReference: 1 });
modelSchema.index({ shipmentStatus: 1, createdAt: -1 });
modelSchema.index({ "race.race": 1, shipmentStatus: 1, createdAt: -1 });
modelSchema.index({ "club.club": 1, shipmentStatus: 1, createdAt: -1 });

const Entity = mongoose.model("Shipments", modelSchema);

export default Entity;
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
