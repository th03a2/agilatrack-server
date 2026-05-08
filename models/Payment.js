import mongoose from "mongoose";

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    clubId: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    raceId: {
      type: Schema.Types.ObjectId,
      ref: "Races",
    },
    purpose: {
      type: String,
      enum: ["membership_dues", "race_fee", "prize_pool", "expense", "payout"],
      required: true,
    },
    amount: { type: Number, min: 0, required: true },
    currency: { type: String, uppercase: true, trim: true, default: "PHP" },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected", "paid", "cancelled"],
      default: "pending",
    },
    referenceNumber: { type: String, trim: true },
    verifiedAt: { type: Date },
    verifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    deletedAt: { type: String },
  },
  { timestamps: true },
);

modelSchema.index({ clubId: 1, purpose: 1, status: 1, createdAt: -1 });

const Entity = mongoose.model("Payments", modelSchema);

export default Entity;
