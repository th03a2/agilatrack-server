import mongoose from "mongoose";

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
      index: true,
    },
    fancier: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true,
      index: true,
    },
    affiliation: {
      type: Schema.Types.ObjectId,
      ref: "Affiliations",
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: "CommerceShopOrders",
      required: true,
      index: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "CommerceShopProducts",
    },
    loftName: {
      type: String,
      trim: true,
    },
    serialNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["assigned", "synced", "void"],
      default: "assigned",
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    syncNotes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  },
);

modelSchema.index({ club: 1, serialNumber: 1 }, { unique: true });
modelSchema.index({ fancier: 1, club: 1, createdAt: -1 });

const Entity =
  mongoose.models.CommerceRfidAssignments ||
  mongoose.model("CommerceRfidAssignments", modelSchema);

export default Entity;
