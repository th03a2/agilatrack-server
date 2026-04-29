import mongoose from "mongoose";

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
      match: [
        /^[A-Z0-9][A-Z0-9.-]*$/,
        "Loft code must use uppercase letters, numbers, dashes, and dots only.",
      ],
    },
    name: { type: String, required: true, trim: true },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
    },
    manager: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    device: {
      deviceId: { type: String, trim: true },
      label: { type: String, trim: true },
      brand: { type: String, trim: true },
      manufacturer: { type: String, trim: true },
      modelName: { type: String, trim: true },
      deviceName: { type: String, trim: true },
      osName: { type: String, trim: true },
      osVersion: { type: String, trim: true },
      osBuildId: { type: String, trim: true },
      platformApiLevel: { type: Number },
      isDevice: { type: Boolean, default: true },
      capturedAt: { type: Date },
      role: {
        type: String,
        enum: ["loft_registration", "race_nfc_scanner"],
        default: "race_nfc_scanner",
      },
    },
    coordinates: {
      latitude: {
        type: Number,
        required() {
          return this.status !== "draft";
        },
        min: -90,
        max: 90,
      },
      longitude: {
        type: Number,
        required() {
          return this.status !== "draft";
        },
        min: -180,
        max: 180,
      },
    },
    geo: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    address: {
      street: { type: String, trim: true },
      barangay: { type: String, trim: true },
      barangayCode: {
        type: String,
        trim: true,
        match: [/^\d{4}$/, "Barangay code must be exactly 4 digits."],
      },
      municipality: { type: String, trim: true },
      municipalityCode: {
        type: String,
        uppercase: true,
        required: true,
        trim: true,
        match: [
          /^[A-Z0-9]{2,4}$/,
          "Municipality code must be 2 to 4 uppercase letters or numbers.",
        ],
      },
      province: { type: String, trim: true },
      provinceCode: {
        type: String,
        uppercase: true,
        required: true,
        trim: true,
        match: [
          /^[A-Z0-9]{2,4}$/,
          "Province code must be 2 to 4 uppercase letters or numbers.",
        ],
      },
      region: { type: String, trim: true },
      regionCode: {
        type: String,
        uppercase: true,
        required: true,
        trim: true,
        match: [
          /^[A-Z0-9]{2,4}$/,
          "Region code must be 2 to 4 uppercase letters or numbers.",
        ],
      },
      zip: { type: String, trim: true },
    },
    capacity: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["draft", "active", "inactive", "archived"],
      default: "active",
    },
    notes: { type: String, trim: true },
    deletedAt: { type: String },
  },
  {
    timestamps: true,
  },
);

modelSchema.pre("validate", function setGeoPoint(next) {
  const latitude = this.coordinates?.latitude;
  const longitude = this.coordinates?.longitude;

  if (latitude !== undefined && longitude !== undefined) {
    this.geo = {
      type: "Point",
      coordinates: [longitude, latitude],
    };
  } else {
    this.geo = undefined;
  }

  next();
});

modelSchema.index({ club: 1, deletedAt: 1 });
modelSchema.index({
  "address.regionCode": 1,
  "address.provinceCode": 1,
  "address.municipalityCode": 1,
  "address.barangayCode": 1,
});
modelSchema.index({ geo: "2dsphere" });

const Entity = mongoose.model("Lofts", modelSchema);

export default Entity;
