import mongoose from "mongoose";

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    domain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    module: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    entityId: {
      type: String,
      required: true,
      trim: true,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    meta: {
      type: Schema.Types.Mixed,
      default: {},
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

modelSchema.index(
  { domain: 1, module: 1, entityType: 1, entityId: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
  },
);
modelSchema.index({ domain: 1, module: 1, deletedAt: 1, updatedAt: -1 });
modelSchema.index({ club: 1, domain: 1, module: 1, deletedAt: 1 });

const Entity = mongoose.model("PortalStates", modelSchema);

export default Entity;
