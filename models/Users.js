import mongoose from "mongoose";
import { compare, genSalt, hash } from "bcryptjs";

const { Schema } = mongoose;

const AddressSchema = new mongoose.Schema({
  hn: { type: String, trim: true },
  street: { type: String, trim: true },
  purok: { type: String, trim: true }, //Purok or Sitio
  sitio: { type: String, trim: true },
  //Subdivision
  subdivision: { type: String, trim: true },
  block: { type: String, trim: true },
  lot: { type: String, trim: true },
  barangay: { type: String, trim: true },
  city: { type: String, trim: true },
  province: { type: String, trim: true },
  region: { type: String, trim: true },
  zip: { type: String, trim: true },
  unRegistered: { type: Boolean, default: false },
});

const parentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "Users" },
    // if not registered
    fname: { type: String },
    mname: { type: String, trim: true },
    lname: { type: String },
    suffix: { type: String },
    maiden: { type: String },
  },
  { _id: false }, // para hindi gumawa ng sariling _id si father/mother
);

const userSchema = new Schema(
  {
    //Profile ID in Cloudinary
    pid: { type: String },
    profile: {
      status: {
        type: String,
        enum: ["pending", "approved", "denied"],
        default: "pending",
      },
      reason: { type: String },
      at: { type: Date },
      by: {
        type: Schema.Types.ObjectId,
        ref: "Users",
      },
    },

    // corporate portrait photography
    cpid: { type: String },
    email: {
      type: String,
      unique: true,
    },
    password: {
      type: String,
      minlength: 8,
    },
    fullName: {
      fname: { type: String },
      mname: { type: String, trim: true },
      lname: { type: String },
      suffix: { type: String },
      nickname: { type: String },
      title: { type: String },
      //Maiden Name
      maiden: { type: String },
      postnominal: { type: String },
    },

    work: {
      title: { type: String },
      company: { type: String },
      province: { type: String },
      createdAt: { type: Date },
    },

    activePlatform: {
      _id: { type: Schema.Types.ObjectId, ref: "Affiliations" },
      club: { type: Schema.Types.ObjectId, ref: "Clubs" },
      role: { type: Schema.Types.Mixed },
      portal: {
        type: String,
        trim: true,
      },
      access: [
        {
          type: String,
        },
      ],
    },
    address: AddressSchema,
    parents: {
      father: parentSchema,
      mother: parentSchema,
    },
    //For Parents
    childrens: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],

    declaredChildrens: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
    declinedChildrens: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
      },
    ],
    requests: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Users",
        },
        relationship: { type: String },
      },
    ],
    siblings: [{ type: Schema.Types.ObjectId, ref: "Users" }],
    credentials: {
      //Post Graduate Degree
      pgd: { type: String },
      specialization: { type: String },
      minor: { type: String },
      lrn: { type: String },
      psa: { type: String },
      // Pantawid Pamilyang Pilipino Program (4P's)
      pppp: { type: String },

      //birth certificate
      bc: { type: String },
    },
    mobile: { type: String },
    membership: {
      type: String,
      trim: true,
      lowercase: true,
      default: "regular",
    },
    isMale: {
      type: Boolean,
      default: false,
    },
    state: [
      {
        type: String,
        enum: [
          "patron",
          "guest",
          "observer",
          "student",
          "parent",
          "guardian",
          "employee",
          "department-head",
          "school-admin",
          "scl-partner",
          "scl-agent",
          "scl-consultant",
        ],
        default: "patron",
      },
    ],
    // Personally Identifiable Information
    pii: {
      dob: { type: String },
      religion: { type: String },
      // place /municipality of birth
      pob: { type: String },
      civilStatus: {
        type: String,
        enum: {
          values: [
            "single",
            "married",
            "divorced",
            "widowed",
            "separated",
            "annulled",
          ],
          message: "Please choose a valid type from the predefined options.",
        },
      },
      bt: { type: String }, //blood Type
      ip: { type: String }, //Indigenous personal
      pwd: { type: String }, // person with disability
      //Mother Tongue
      mt: { type: String },
    },

    // this files is id in cloudinary
    files: {
      //PHASE 1 ENROLLMENT (ASSESSMENT)
      signature: { type: String }, //signature and profile
      //APPLICATION FORM
      application: { type: String },
      resume: { type: String },
      medical: { type: String },
    },
    // ✅ SOCIAL PROVIDERS
    providers: {
      google: {
        id: { type: String },
      },
      facebook: {
        id: { type: String },
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    expoPushTokens: {
      type: [String],
    },
    isGuardian: {
      type: Boolean,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

userSchema.virtual("name").get(function getName() {
  const title = String(this?.fullName?.title || "").trim();
  const fname = String(this?.fullName?.fname || "").trim();
  const mname = String(this?.fullName?.mname || "").trim();
  const lname = String(this?.fullName?.lname || "").trim();
  const suffix = String(this?.fullName?.suffix || "").trim();
  const postnominal = String(this?.fullName?.postnominal || "").trim();

  const middleInitial = mname ? `${mname.charAt(0)}.` : "";
  const baseName = [title, fname, middleInitial, lname, suffix]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return [baseName, postnominal].filter(Boolean).join(", ") || this.email || "";
});

userSchema.methods.matchPassword = function (password) {
  return compare(password, this.password);
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  const salt = await genSalt(10);
  this.password = await hash(this.password, salt);
});

userSchema.statics.findByEmail = async function (email) {
  return this.findOne({ email });
};

const Entity = mongoose.model("Users", userSchema);

export default Entity;
