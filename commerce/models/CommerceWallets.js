import mongoose from "mongoose";

const { Schema } = mongoose;

export const COMMERCE_OWNER_TYPES = [
  "coordinator",
  "fancier",
  "club",
  "admin",
  "system",
];
export const COMMERCE_WALLET_STATUSES = ["active", "suspended", "closed"];
export const COMMERCE_TRANSACTION_TYPES = [
  "opening_balance",
  "preload",
  "load_transfer",
  "bird_registration_fee",
  "race_fee",
  "recharge_request",
  "recharge_approval",
  "adjustment",
];
export const COMMERCE_TRANSACTION_DIRECTIONS = ["credit", "debit"];
export const COMMERCE_TRANSACTION_STATUSES = [
  "pending",
  "completed",
  "cancelled",
  "approved",
  "rejected",
];

const transactionSchema = new Schema(
  {
    referenceNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: COMMERCE_TRANSACTION_TYPES,
      required: true,
    },
    direction: {
      type: String,
      enum: COMMERCE_TRANSACTION_DIRECTIONS,
      required: true,
    },
    status: {
      type: String,
      enum: COMMERCE_TRANSACTION_STATUSES,
      default: "completed",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceBefore: {
      type: Number,
      default: 0,
      min: 0,
    },
    balanceAfter: {
      type: Number,
      default: 0,
      min: 0,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    counterpartyWallet: {
      type: Schema.Types.ObjectId,
      ref: "CommerceWallets",
    },
    receipt: {
      type: Schema.Types.ObjectId,
      ref: "CommerceReceipts",
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
    },
    affiliation: {
      type: Schema.Types.ObjectId,
      ref: "Affiliations",
    },
    race: {
      type: Schema.Types.ObjectId,
      ref: "Races",
    },
    pigeon: {
      type: Schema.Types.ObjectId,
      ref: "Birds",
    },
    classification: {
      type: String,
      trim: true,
      lowercase: true,
    },
    gcashReference: {
      type: String,
      trim: true,
    },
    requiresCall: {
      type: Boolean,
      default: false,
    },
    remarks: {
      type: String,
      trim: true,
    },
    meta: {
      type: Schema.Types.Mixed,
    },
    transactedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

const modelSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
    },
    affiliation: {
      type: Schema.Types.ObjectId,
      ref: "Affiliations",
    },
    ownerType: {
      type: String,
      enum: COMMERCE_OWNER_TYPES,
      required: true,
      lowercase: true,
      trim: true,
    },
    balance: {
      type: Number,
      default: 0,
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
      enum: COMMERCE_WALLET_STATUSES,
      default: "active",
    },
    settings: {
      allowTransfers: {
        type: Boolean,
        default: true,
      },
      requireCallForRechargeApproval: {
        type: Boolean,
        default: true,
      },
      autoIssueReceipt: {
        type: Boolean,
        default: true,
      },
      minimumBalanceAlert: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    transactions: {
      type: [transactionSchema],
      default: [],
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

modelSchema.virtual("availableBalance").get(function getAvailableBalance() {
  return this.balance;
});

modelSchema.methods.buildTransaction = function buildTransaction(transaction) {
  const amount = Number(transaction.amount || 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Transaction amount must be greater than zero.");
  }

  const balanceBefore = Number(this.balance || 0);
  const signedAmount =
    transaction.direction === "credit" ? amount : amount * -1;
  const balanceAfter = balanceBefore + signedAmount;

  if (balanceAfter < 0) {
    throw new Error("Insufficient wallet balance.");
  }

  return {
    ...transaction,
    amount,
    balanceBefore,
    balanceAfter,
  };
};

modelSchema.methods.applyTransaction = function applyTransaction(transaction) {
  const prepared = this.buildTransaction(transaction);
  this.transactions.push(prepared);
  this.balance = prepared.balanceAfter;
  return this.transactions[this.transactions.length - 1];
};

modelSchema.index(
  { user: 1, club: 1, ownerType: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
  },
);
modelSchema.index({ club: 1, ownerType: 1, status: 1, deletedAt: 1 });
modelSchema.index({ affiliation: 1, status: 1, deletedAt: 1 });
modelSchema.index({ user: 1, status: 1, deletedAt: 1 });

const Entity = mongoose.model("CommerceWallets", modelSchema);

export default Entity;
