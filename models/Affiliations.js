import mongoose from "mongoose";

const { Schema } = mongoose;

export const AFFILIATION_STATUSES = [
  "draft",
  "pending",
  "approved",
  "rejected",
  "deactivated",
];

const deactivationSchema = new Schema(
  {
    by: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    at: { type: String },
    for: {
      type: Schema.Types.ObjectId,
      ref: "Violations",
    },
  },
  { _id: false },
);

const approvalSchema = new Schema(
  {
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: { type: Date },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    rejectedAt: { type: Date },
    rejectedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    reason: { type: String, trim: true },
  },
  { _id: false },
);

const applicationSchema = new Schema(
  {
    address: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    loftName: {
      type: String,
      trim: true,
    },
    birdOwnerType: {
      type: String,
      trim: true,
    },
    photos: {
      type: [String],
      default: [],
    },
    recommenderName: {
      type: String,
      trim: true,
    },
    reasonForJoining: {
      type: String,
      trim: true,
    },
    signatureDate: {
      type: String,
      trim: true,
    },
    signatureName: {
      type: String,
      trim: true,
    },
    validIdImage: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const modelSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
    },
    memberCode: {
      type: String,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
      match: [
        /^[A-Z0-9][A-Z0-9.-]*$/,
        "Member code must use uppercase letters, numbers, dashes, and dots only.",
      ],
    },
    membershipType: {
      type: String,
      trim: true,
      lowercase: true,
      default: "racer",
    },
    roles: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    mobile: { type: String },
    primaryLoft: {
      type: Schema.Types.ObjectId,
      ref: "Lofts",
    },
    lofts: [
      {
        type: Schema.Types.ObjectId,
        ref: "Lofts",
      },
    ],
    racing: {
      licenseNumber: {
        type: String,
        trim: true,
        uppercase: true,
      },
      bandPrefix: {
        type: String,
        trim: true,
        uppercase: true,
      },
      clockSystem: {
        type: String,
        trim: true,
      },
      clockId: {
        type: String,
        trim: true,
        uppercase: true,
      },
    },
    application: {
      type: applicationSchema,
      default: () => ({}),
    },
    approval: {
      type: approvalSchema,
      default: () => ({}),
    },
    status: {
      type: String,
      enum: {
        values: AFFILIATION_STATUSES,
        message: "Please choose a valid affiliation status.",
      },
      default: "pending",
    },
    deactivated: {
      type: deactivationSchema,
      default: () => ({}),
    },
    remarks: { type: [String], default: [] },
    deletedAt: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

modelSchema.virtual("isApproved").get(function getIsApproved() {
  return this.status === "approved" && !this.deletedAt;
});

modelSchema.pre("validate", function normalizeAffiliation(next) {
  if (!this.roles?.length) {
    this.roles = [this.membershipType || "racer"];
  }

  if (this.primaryLoft) {
    const hasPrimaryLoft = this.lofts?.some(
      (loft) => String(loft) === String(this.primaryLoft),
    );

    if (!hasPrimaryLoft) {
      this.lofts = [...(this.lofts || []), this.primaryLoft];
    }
  }

  if (this.status === "approved" && !this.approval?.approvedAt) {
    this.approval = {
      ...(this.approval || {}),
      approvedAt: new Date(),
    };
  }

  if (this.status === "rejected" && !this.approval?.rejectedAt) {
    this.approval = {
      ...(this.approval || {}),
      rejectedAt: new Date(),
    };
  }

  next();
});

modelSchema.index({ user: 1, club: 1, status: 1, createdAt: -1 });
modelSchema.index(
  { club: 1, memberCode: 1 },
  {
    unique: true,
    partialFilterExpression: {
      memberCode: { $exists: true },
      deletedAt: { $exists: false },
    },
  },
);
modelSchema.index({ club: 1, status: 1, membershipType: 1 });
modelSchema.index({ user: 1, status: 1 });
modelSchema.index({ primaryLoft: 1 });

const Entity = mongoose.model("Affiliations", modelSchema);

export default Entity;
