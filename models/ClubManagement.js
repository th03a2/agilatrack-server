import mongoose from "mongoose";

mongoose.set("strictQuery", false);

const modelSchema = new mongoose.Schema(
  {
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clubs",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    authorization: {
      type: String,
      trim: true,
    },

    deletedAt: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

modelSchema.pre("validate", function normalizeLegacyTitle(next) {
  const normalizedTitle = this.title || this.authorization;

  if (normalizedTitle) {
    this.title = normalizedTitle;
    this.authorization = normalizedTitle;
  }

  next();
});

modelSchema.query.byUser = function (user) {
  return this.where({ user });
};

modelSchema.query.byClub = function (club) {
  return this.where({ club });
};

const Entity =
  mongoose.models.ClubManagement ||
  mongoose.model("ClubManagement", modelSchema, "officers");

export default Entity;
