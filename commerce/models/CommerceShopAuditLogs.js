import mongoose from "mongoose";

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      index: true,
    },
    role: {
      type: String,
      trim: true,
      maxlength: 220,
    },
    target: {
      type: String,
      trim: true,
      maxlength: 240,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    ip: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    device: {
      type: String,
      trim: true,
      maxlength: 240,
    },
  },
  {
    timestamps: true,
  },
);

modelSchema.index({ club: 1, createdAt: -1 });
modelSchema.index({ user: 1, club: 1, createdAt: -1 });

const Entity =
  mongoose.models.CommerceShopAuditLogs ||
  mongoose.model("CommerceShopAuditLogs", modelSchema);

export default Entity;
