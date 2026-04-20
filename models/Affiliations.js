import mongoose from "mongoose";

const { Schema } = mongoose;

const deactivationSchema = new Schema(
  {
    by: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    at: {
      type: String,
    },
    for: {
      type: Schema.Types.ObjectId,
      ref: "Violations",
    },
  },
  { _id: false },
);

const scopedAssignmentSchema = new Schema(
  {
    type: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    refId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    refModel: {
      type: String,
      trim: true,
    },
    role: { type: Number },
    scope: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected", "inactive"],
        message: "Please choose a valid assignment status.",
      },
      default: "pending",
    },
    remarks: { type: Array, default: [] },
    meta: { type: Schema.Types.Mixed, default: null },
    deactivated: {
      type: deactivationSchema,
      default: () => ({}),
    },
  },
  {
    _id: false,
  },
);

const modelSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clubs",
    },
    mobile: { type: String },
    activePlatform: {
      _id: { type: Schema.Types.ObjectId, ref: "Affiliations" },
      club: { type: Schema.Types.ObjectId, ref: "Clubs" },
      role: { type: Number },
      portal: {
        type: String,
        trim: true,
      },
      // access to the primary portals
      access: [{ type: Number }],
    },
    validation: {
      academicValidator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Affiliations",
      },
      academicValidatees: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Affiliations",
        },
      ],
    },
    // Employee only
    tagline: { type: String },
    // Personalized card template
    ct: { type: String },
    dfp: { type: String },
    status: {
      type: String,
      enum: {
        values: ["draft", "pending", "approved", "rejected", "deactivated"],
        message: "Please choose a valid type from the predefined options.",
      },
      default: "draft",
    },
    deactivated: {
      by: {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
      at: {
        type: String,
      },
      for: {
        type: Schema.Types.ObjectId,
        ref: "Violations",
      },
    },

    remarks: { type: Array },
  },
  {
    timestamps: true,
  },
);

const Entity = mongoose.model("Affiliations", modelSchema);

export default Entity;
