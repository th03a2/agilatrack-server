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
    status: {
      type: String,
      enum: ["pending", "published", "locked", "disqualified"],
      default: "pending",
    },
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

const Entity = mongoose.model("RaceResults", modelSchema);

export default Entity;
