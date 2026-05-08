import mongoose from "mongoose";

const { Schema } = mongoose;

export const OWNER_AUDIT_ACTIONS = [
  "Owner Zone Verification",
  "Payout Action",
  "Withdrawal Action",
  "Payroll Change",
  "Product Change",
  "Gateway Change",
  "Refund Action",
  "Report Export",
  "Owner Action",
];

const ownerAuditLogSchema = new Schema(
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
    device: {
      type: String,
      trim: true,
      maxlength: 220,
    },
    ip: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    operator: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    target: {
      type: String,
      trim: true,
      maxlength: 240,
    },
  },
  {
    timestamps: true,
  },
);

ownerAuditLogSchema.index({ club: 1, createdAt: -1 });
ownerAuditLogSchema.index({ operator: 1, club: 1, createdAt: -1 });

const Entity =
  mongoose.models.OwnerAuditLogs ||
  mongoose.model("OwnerAuditLogs", ownerAuditLogSchema);

export default Entity;
