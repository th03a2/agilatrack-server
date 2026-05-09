import mongoose from "mongoose";

const { Schema } = mongoose;

export const BET_STATUSES = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "won",
  "lost",
  "void",
  "paid",
];

const moneySchema = new Schema(
  {
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: "PHP",
      minlength: 3,
      maxlength: 3,
    },
  },
  { _id: false },
);

const bettorSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["user", "guest"],
      default: "guest",
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required() {
        return this.type === "user";
      },
    },
    guest: {
      name: {
        type: String,
        trim: true,
      },
      mobile: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      reference: { type: String, trim: true },
    },
    eligibility: {
      isOfLegalAge: {
        type: Boolean,
        default: false,
      },
      jurisdiction: {
        type: String,
        trim: true,
        default: "PH",
      },
      acceptedRulesAt: { type: Date },
    },
  },
  { _id: false },
);

const modelSchema = new Schema(
  {
    betCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 40,
      match: [
        /^[A-Z0-9][A-Z0-9.-]*$/,
        "Bet code must use uppercase letters, numbers, dashes, and dots only.",
      ],
    },
    race: {
      type: Schema.Types.ObjectId,
      ref: "Races",
      required: true,
    },
    market: {
      type: Schema.Types.ObjectId,
      ref: "BettingMarkets",
      required: true,
    },
    raceEntry: {
      type: Schema.Types.ObjectId,
      ref: "RaceEntries",
      required: true,
    },
    bettor: {
      type: bettorSchema,
      required: true,
    },
    stake: {
      type: moneySchema,
      required: true,
    },
    odds: {
      decimal: {
        type: Number,
        required: true,
        min: 1.01,
      },
      capturedAt: {
        type: Date,
        default: Date.now,
      },
    },
    payout: {
      potential: moneySchema,
      actual: moneySchema,
      paidAt: { type: Date },
      paidBy: {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
    },
    placedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: { type: Date },
    settledAt: { type: Date },
    status: {
      type: String,
      enum: BET_STATUSES,
      default: "pending",
    },
    settlement: {
      reason: { type: String, trim: true },
      settledBy: {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
    },
    notes: { type: String, trim: true },
    deletedAt: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

modelSchema.virtual("potentialPayout").get(function getPotentialPayout() {
  if (!this.stake?.amount || !this.odds?.decimal) return null;

  return {
    amount: this.stake.amount * this.odds.decimal,
    currency: this.stake.currency || "PHP",
  };
});

modelSchema.virtual("potentialProfit").get(function getPotentialProfit() {
  if (!this.stake?.amount || !this.odds?.decimal) return null;

  return {
    amount: this.stake.amount * this.odds.decimal - this.stake.amount,
    currency: this.stake.currency || "PHP",
  };
});

modelSchema.pre("validate", function normalizeBet(next) {
  if (this.bettor?.type === "guest" && !this.bettor?.guest?.name) {
    return next(new Error("Guest bettor name is required."));
  }

  if (this.bettor?.type === "guest" && !this.bettor?.eligibility?.isOfLegalAge) {
    return next(new Error("Guest bettor legal-age confirmation is required."));
  }

  if (!this.payout?.potential && this.stake?.amount && this.odds?.decimal) {
    this.payout = {
      ...(this.payout || {}),
      potential: {
        amount: this.stake.amount * this.odds.decimal,
        currency: this.stake.currency || "PHP",
      },
    };
  }

  if (this.status === "accepted" && !this.acceptedAt) {
    this.acceptedAt = new Date();
  }

  if (["won", "lost", "void", "paid"].includes(this.status) && !this.settledAt) {
    this.settledAt = new Date();
  }

  next();
});

modelSchema.index({ race: 1, status: 1, deletedAt: 1 });
modelSchema.index({ market: 1, raceEntry: 1, status: 1 });
modelSchema.index({ "bettor.user": 1, createdAt: -1 });
modelSchema.index({ "bettor.guest.mobile": 1, createdAt: -1 });

const Entity = mongoose.model("Bets", modelSchema);

export default Entity;
