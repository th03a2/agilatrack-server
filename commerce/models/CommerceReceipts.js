import mongoose from "mongoose";

const { Schema } = mongoose;

export const COMMERCE_RECEIPT_STATUSES = ["issued", "void"];

const itemSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  { _id: false },
);

const modelSchema = new Schema(
  {
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    wallet: {
      type: Schema.Types.ObjectId,
      ref: "CommerceWallets",
      required: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
    },
    type: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
    },
    items: {
      type: [itemSchema],
      default: [],
    },
    amount: {
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
    status: {
      type: String,
      enum: COMMERCE_RECEIPT_STATUSES,
      default: "issued",
    },
    notes: {
      type: String,
      trim: true,
    },
    issuedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
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

modelSchema.index({ wallet: 1, createdAt: -1 });
modelSchema.index({ club: 1, createdAt: -1, status: 1 });

const Entity = mongoose.model("CommerceReceipts", modelSchema);

export default Entity;
