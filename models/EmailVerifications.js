import mongoose from "mongoose";

const { Schema } = mongoose;

const emailVerificationSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Entity = mongoose.model("EmailVerifications", emailVerificationSchema);

export default Entity;
