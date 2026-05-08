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
    arrivalTime: { type: Date, required: true },
    source: {
      type: String,
      enum: ["nfc", "rfid", "qr", "manual"],
      default: "manual",
    },
    status: {
      type: String,
      enum: ["valid", "duplicate", "late", "disqualified", "pending_review"],
      default: "valid",
    },
    remarks: { type: String, trim: true },
    encodedBy: {
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

modelSchema.index({ raceId: 1, pigeonId: 1 }, { unique: true, sparse: true });
modelSchema.index({ clubId: 1, status: 1, arrivalTime: 1 });

const Entity = mongoose.model("ArrivalRecords", modelSchema);

export default Entity;
