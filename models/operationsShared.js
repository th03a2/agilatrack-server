import mongoose from "mongoose";

const { Schema } = mongoose;

export const baseSchemaOptions = {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
};

export const moneySchema = new Schema(
  {
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: "PHP",
      minlength: 3,
      maxlength: 3,
    },
  },
  { _id: false },
);

export const ownerSummarySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    mobile: { type: String, trim: true },
  },
  { _id: false },
);

export const clubSummarySchema = new Schema(
  {
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
    },
    name: { type: String, trim: true },
    code: { type: String, trim: true, uppercase: true },
    abbr: { type: String, trim: true },
    level: { type: String, trim: true, lowercase: true },
    location: { type: String, trim: true },
  },
  { _id: false },
);

export const birdSummarySchema = new Schema(
  {
    pigeon: {
      type: Schema.Types.ObjectId,
      ref: "Pigeons",
    },
    bandNumber: { type: String, trim: true, uppercase: true },
    name: { type: String, trim: true },
  },
  { _id: false },
);

export const raceSummarySchema = new Schema(
  {
    race: {
      type: Schema.Types.ObjectId,
      ref: "Races",
    },
    code: { type: String, trim: true, uppercase: true },
    name: { type: String, trim: true },
    raceDate: { type: Date },
    status: { type: String, trim: true, lowercase: true },
  },
  { _id: false },
);

export const itemSummarySchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Products",
    },
    category: { type: String, trim: true, lowercase: true },
    bandNumber: { type: String, trim: true, uppercase: true },
    name: { type: String, trim: true },
    quantity: {
      type: Number,
      min: 0,
      default: 1,
    },
    reference: { type: String, trim: true, uppercase: true },
  },
  { _id: false },
);

export const createResourceCode = (prefix, value) =>
  `${prefix}-${String(value || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8)
    .toUpperCase() || "00000000"}`;

