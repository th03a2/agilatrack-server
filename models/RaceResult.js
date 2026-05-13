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
    raceId: {
      type: Schema.Types.ObjectId,
      ref: "Races",
      required: true,
      index: true,
    },
    raceEntryId: {
      type: Schema.Types.ObjectId,
      ref: "RaceEntries",
      required: true,
    },
    pigeonId: {
      type: Schema.Types.ObjectId,
      ref: "Birds",
    },
    fancierId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    rank: { type: Number, min: 1 },
    distanceMeters: { type: Number, min: 0 },
    flightDurationMinutes: { type: Number, min: 0 },
    speedMetersPerMinute: { type: Number, min: 0 },
    
    // GPS computation fields
    distance: { type: Number, min: 0 }, // in kilometers
    flightTime: { type: Number, min: 0 }, // in minutes
    velocity: { type: Number, min: 0 }, // in meters per minute
    velocityKmh: { type: Number, min: 0 }, // in km/h
    ranking: { type: Number, min: 1 },
    
    // Timing and arrival
    arrivalTimestamp: { type: String, required: true },
    timingMethod: {
      type: String,
      enum: ['manual', 'rfid', 'nfc', 'ets'],
      required: true
    },
    scannedBy: { type: String, required: true },
    
    // Extended status options
    status: {
      type: String,
      enum: ["pending", "validated", "published", "locked", "disqualified", "protested", "under_review"],
      default: "pending",
    },
    
    // Validation fields
    validatedBy: { type: String },
    validatedAt: { type: String },
    notes: { type: String },
    
    // Protest fields
    protestReason: { type: String },
    protestedBy: { type: String },
    protestedAt: { type: String },
    
    // Disqualification fields
    disqualificationReason: { type: String },
    disqualifiedBy: { type: String },
    disqualifiedAt: { type: String },
    
    // Computation tracking
    computedAt: { type: String },
    publishedBy: { type: String },
    publishedAt: { type: String },
    
    // Bird details for easier access
    bandNumber: { type: String, trim: true },
    birdName: { type: String, trim: true },
    fancierName: { type: String, trim: true },
    loftName: { type: String, trim: true },
    
    // Points and scoring
    points: { type: Number, min: 0, default: 0 },
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

modelSchema.index({ raceId: 1, rank: 1 });
modelSchema.index({ clubId: 1, raceId: 1, status: 1 });

// GPS computation indexes
modelSchema.index({ raceId: 1, status: 1 });
modelSchema.index({ raceId: 1, ranking: 1 });
modelSchema.index({ fancierId: 1, raceId: 1 });
modelSchema.index({ loftId: 1, raceId: 1 });
modelSchema.index({ bandNumber: 1, raceId: 1 });
modelSchema.index({ velocity: -1 }); // For top performers

const Entity = mongoose.model("RaceResults", modelSchema);

export default Entity;
