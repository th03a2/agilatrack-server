import mongoose from "mongoose";

const { Schema } = mongoose;

export const WALLET_OWNER_TYPES = ["coordinator", "fancier", "admin", "system"];
export const WALLET_STATUSES = ["active", "suspended", "closed"];
export const WALLET_TRANSACTION_TYPES = [
  "opening_balance",
  "preload",
  "load_transfer",
  "bird_registration_fee",
  "race_fee",
  "recharge_request",
  "adjustment",
];
export const WALLET_TRANSACTION_DIRECTIONS = ["credit", "debit"];
export const WALLET_TRANSACTION_STATUSES = ["pending", "completed", "cancelled"];

const transactionSchema = new Schema(
  {
    type: {
      type: String,
      enum: WALLET_TRANSACTION_TYPES,
      required: true,
    },
    direction: {
      type: String,
      enum: WALLET_TRANSACTION_DIRECTIONS,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: WALLET_TRANSACTION_STATUSES,
      default: "completed",
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
    counterpartyWallet: {
      type: Schema.Types.ObjectId,
      ref: "Wallets",
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
    },
    affiliation: {
      type: Schema.Types.ObjectId,
      ref: "Affiliations",
    },
    pigeon: {
      type: Schema.Types.ObjectId,
      ref: "Birds",
    },
    race: {
      type: Schema.Types.ObjectId,
      ref: "Races",
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
      enum: WALLET_OWNER_TYPES,
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
      enum: WALLET_STATUSES,
      default: "active",
    },
    settings: {
      allowTransfers: {
        type: Boolean,
        default: true,
      },
      requiresCoordinatorCallForRecharge: {
        type: Boolean,
        default: true,
      },
      defaultBirdRegistrationFee: {
        type: Number,
        default: 50,
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

modelSchema.methods.addTransaction = function addTransaction(transaction) {
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

  this.transactions.push({
    ...transaction,
    amount,
    balanceBefore,
    balanceAfter,
  });
  this.balance = balanceAfter;

  return this.transactions[this.transactions.length - 1];
};

modelSchema.index(
  { user: 1, club: 1, ownerType: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
  },
);
modelSchema.index({ affiliation: 1, status: 1, deletedAt: 1 });
modelSchema.index({ club: 1, ownerType: 1, status: 1, deletedAt: 1 });
modelSchema.index({ user: 1, status: 1, deletedAt: 1 });

const Entity = mongoose.model("Wallets", modelSchema);

export default Entity;
