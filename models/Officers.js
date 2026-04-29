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

    authorization: {
      type: String,
      required: true,
    },

    deletedAt: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

<<<<<<< Updated upstream
modelSchema.query.byUser = function (user) {
  return this.where({ user });
};

modelSchema.query.byClub = function (club) {
=======
modelSchema.query.byUser = function byUser(user) {
  return this.where({ user });
};

modelSchema.query.byClub = function byClub(club) {
>>>>>>> Stashed changes
  return this.where({ club });
};

const Entity = mongoose.model("Officers", modelSchema);

export default Entity;
