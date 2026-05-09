import mongoose from "mongoose";

const { Schema } = mongoose;

export const AHP_RECORD_TYPES = [
  "vaccination",
  "medication",
  "checkup",
  "injury",
  "other",
];

const healthRecordSchema = new Schema(
  {
    type: {
      type: String,
      enum: AHP_RECORD_TYPES,
      default: "other",
    },
    name: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    administeredBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false },
);

const modelSchema = new Schema(
  {
    bird: {
      type: Schema.Types.ObjectId,
      ref: "Birds",
      required: true,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    affiliation: {
      type: Schema.Types.ObjectId,
      ref: "Affiliations",
    },
    loft: {
      type: Schema.Types.ObjectId,
      ref: "Lofts",
    },
    records: {
      type: [healthRecordSchema],
      default: [],
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 500,
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

modelSchema.virtual("latestRecord").get(function getLatestRecord() {
  if (!Array.isArray(this.records) || this.records.length === 0) return null;

  return [...this.records].sort((left, right) => {
    const leftDate = new Date(left.date || 0).getTime();
    const rightDate = new Date(right.date || 0).getTime();
    return rightDate - leftDate;
  })[0];
});

modelSchema.index(
  { bird: 1 },
  {
    unique: true,
    partialFilterExpression: { deletedAt: { $exists: false } },
  },
);
modelSchema.index({ club: 1, owner: 1, deletedAt: 1 });
modelSchema.index({ affiliation: 1, deletedAt: 1 });
modelSchema.index({ loft: 1, deletedAt: 1 });

const Entity = mongoose.model("AvianHealthProfiles", modelSchema);

export default Entity;
