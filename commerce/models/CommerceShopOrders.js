import mongoose from "mongoose";

const { Schema } = mongoose;

export const SHOP_PAYMENT_METHODS = [
  "gcash",
  "maya",
  "cash_on_pickup",
  "club_credit",
];

export const SHOP_ORDER_STATUSES = [
  "pending",
  "paid",
  "ready_for_pickup",
  "delivered",
  "cancelled",
  "refunded",
];

export const SHOP_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded",
];

const orderItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "CommerceShopProducts",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    productType: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    rfidSerials: {
      type: [String],
      default: [],
    },
  },
  { _id: true },
);

const qrSchema = new Schema(
  {
    token: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const fulfillmentSchema = new Schema(
  {
    pickupLocation: {
      type: String,
      trim: true,
      maxlength: 240,
    },
    releasedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    releasedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false },
);

const raceEssentialsSchema = new Schema(
  {
    selectedLoftName: {
      type: String,
      trim: true,
      maxlength: 180,
    },
    registeredAccount: {
      type: String,
      trim: true,
      maxlength: 180,
    },
    fancierProfileLinked: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const modelSchema = new Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
      index: true,
    },
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    affiliation: {
      type: Schema.Types.ObjectId,
      ref: "Affiliations",
    },
    items: {
      type: [orderItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalAmount: {
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
    paymentMethod: {
      type: String,
      enum: SHOP_PAYMENT_METHODS,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: SHOP_PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },
    orderStatus: {
      type: String,
      enum: SHOP_ORDER_STATUSES,
      default: "pending",
      index: true,
    },
    paymentReference: {
      type: String,
      trim: true,
      maxlength: 160,
    },
    qr: {
      type: qrSchema,
      required: true,
    },
    fulfillment: {
      type: fulfillmentSchema,
      default: () => ({}),
    },
    raceEssentials: {
      type: raceEssentialsSchema,
      default: () => ({}),
    },
    cancelledAt: {
      type: Date,
    },
    refundedAt: {
      type: Date,
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

modelSchema.index({ club: 1, createdAt: -1 });
modelSchema.index({ buyer: 1, club: 1, createdAt: -1 });
modelSchema.index({ "qr.token": 1, club: 1 }, { unique: true });

const Entity =
  mongoose.models.CommerceShopOrders ||
  mongoose.model("CommerceShopOrders", modelSchema);

export default Entity;
