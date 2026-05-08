import mongoose from "mongoose";

const { Schema } = mongoose;

const tenantAccessLogSchema = new Schema(
  {
    action: {
      type: String,
      default: "blocked_cross_club_access",
      trim: true,
      maxlength: 120,
    },
    attemptedClubId: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    endpoint: {
      type: String,
      trim: true,
      maxlength: 260,
    },
    ip: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    method: {
      type: String,
      trim: true,
      maxlength: 16,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    role: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 260,
    },
  },
  {
    timestamps: true,
  },
);

tenantAccessLogSchema.index({ attemptedClubId: 1, createdAt: -1 });
tenantAccessLogSchema.index({ user: 1, createdAt: -1 });

const Entity =
  mongoose.models.TenantAccessLogs ||
  mongoose.model("TenantAccessLogs", tenantAccessLogSchema);

export default Entity;
