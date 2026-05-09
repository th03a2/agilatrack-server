import mongoose from "mongoose";

const { Schema } = mongoose;

export const COMMERCE_FEE_TYPES = ["bird_registration", "race"];

const feeRuleSchema = new Schema(
  {
    classification: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const modelSchema = new Schema(
  {
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
    },
    feeType: {
      type: String,
      enum: COMMERCE_FEE_TYPES,
      required: true,
    },
    defaultAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "PHP",
      uppercase: true,
      trim: true,
    },
    rules: {
      type: [feeRuleSchema],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
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

modelSchema.methods.resolveAmount = function resolveAmount(classification) {
  const normalized = String(classification || "")
    .trim()
    .toLowerCase();

  if (!normalized) return this.defaultAmount;

  const match = this.rules.find((rule) => rule.classification === normalized);
  return match ? match.amount : this.defaultAmount;
};

modelSchema.index(
  { club: 1, feeType: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
  },
);
modelSchema.index({ club: 1, isActive: 1, deletedAt: 1 });

const Entity = mongoose.model("CommerceFeeProfiles", modelSchema);

export default Entity;
