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
    liberationPoint: { type: String, trim: true, required: true },
    liberationDateTime: { type: Date, required: true },
    weatherNote: { type: String, trim: true },
    delayReason: { type: String, trim: true },
    status: {
      type: String,
      enum: ["scheduled", "delayed", "liberated", "cancelled"],
      default: "liberated",
    },
    releasedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
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

modelSchema.index({ clubId: 1, raceId: 1, status: 1 });

const Entity = mongoose.model("LiberationRecords", modelSchema);

export default Entity;
