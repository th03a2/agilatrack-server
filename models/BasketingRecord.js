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
    },
    pigeonId: {
      type: Schema.Types.ObjectId,
      ref: "Birds",
    },
    fancierId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    basketNumber: { type: String, trim: true, uppercase: true },
    scanCode: { type: String, trim: true, uppercase: true },
    basketedAt: { type: Date, default: Date.now },
    basketedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "basketed", "disqualified", "released"],
      default: "basketed",
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

modelSchema.index({ raceId: 1, pigeonId: 1 }, { unique: true, sparse: true });

const Entity = mongoose.model("BasketingRecords", modelSchema);

export default Entity;
