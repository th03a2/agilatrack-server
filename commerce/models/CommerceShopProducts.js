import mongoose from "mongoose";

const { Schema } = mongoose;

export const SHOP_PRODUCT_CATEGORIES = [
  "race_essentials",
  "supplies",
  "merchandise",
];

export const SHOP_PRODUCT_TYPES = [
  "rfid_rings",
  "prepaid_race_stickers",
  "race_slots",
  "feeds",
  "vitamins",
  "breeding_boxes",
  "loft_supplies",
  "club_tshirts",
  "jackets",
  "caps",
  "stickers",
  "mugs",
  "other",
];

export const SHOP_PRODUCT_STATUSES = [
  "in_stock",
  "low_stock",
  "out_of_stock",
  "preorder",
  "archived",
];

const priceSchema = new Schema(
  {
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
  },
  { _id: false },
);

const imageSchema = new Schema(
  {
    url: {
      type: String,
      trim: true,
    },
    alt: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const rfidSchema = new Schema(
  {
    autoAssign: {
      type: Boolean,
      default: false,
    },
    prefix: {
      type: String,
      default: "AGT-RFID",
      trim: true,
      uppercase: true,
    },
    nextSerial: {
      type: Number,
      default: 1,
      min: 1,
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
      index: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    category: {
      type: String,
      enum: SHOP_PRODUCT_CATEGORIES,
      required: true,
      index: true,
    },
    productType: {
      type: String,
      enum: SHOP_PRODUCT_TYPES,
      default: "other",
      trim: true,
      lowercase: true,
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    images: {
      type: [imageSchema],
      default: [],
    },
    price: {
      type: priceSchema,
      required: true,
    },
    stockQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    status: {
      type: String,
      enum: SHOP_PRODUCT_STATUSES,
      default: "in_stock",
      index: true,
    },
    pickupLocation: {
      type: String,
      trim: true,
      maxlength: 240,
    },
    tags: {
      type: [String],
      default: [],
    },
    rfid: {
      type: rfidSchema,
      default: () => ({}),
    },
    salesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    revenue: {
      type: Number,
      default: 0,
      min: 0,
    },
    archivedAt: {
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

modelSchema.pre("validate", function normalizeInventoryState(next) {
  if (this.status !== "archived" && this.status !== "preorder") {
    if (Number(this.stockQuantity || 0) <= 0) {
      this.status = "out_of_stock";
    } else if (Number(this.stockQuantity || 0) <= Number(this.lowStockThreshold || 0)) {
      this.status = "low_stock";
    } else {
      this.status = "in_stock";
    }
  }

  next();
});

modelSchema.index(
  { club: 1, sku: 1 },
  {
    partialFilterExpression: {
      deletedAt: { $exists: false },
      sku: { $exists: true, $type: "string" },
    },
    unique: true,
  },
);
modelSchema.index({ club: 1, category: 1, status: 1, deletedAt: 1 });
modelSchema.index({ club: 1, createdAt: -1 });

const Entity =
  mongoose.models.CommerceShopProducts ||
  mongoose.model("CommerceShopProducts", modelSchema);

export default Entity;
