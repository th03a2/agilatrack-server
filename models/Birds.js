import mongoose from "mongoose";
import {
  BIRD_RING_NUMBER_PATTERN,
  isValidBirdRingNumber,
  normalizeBirdRingNumber,
} from "../utils/birdRingNumber.js";

const { Schema } = mongoose;

export const BIRD_SEXES = ["cock", "hen", "unknown"];
export const BIRD_CATEGORIES = [
  "racer",
  "breeder",
  "young-bird",
  "old-bird",
  "stock-bird",
  "show-bird",
  "other",
];
export const BIRD_SPECIES = ["pigeon", "bird", "other"];
export const BIRD_HEALTH_STATUSES = ["Excellent", "Good", "Fair", "Poor"];
export const BIRD_STATUSES = [
  "active",
  "breeding",
  "training",
  "injured",
  "retired",
  "lost",
  "deceased",
  "sold",
  "archived",
];
export const BIRD_IMAGE_FIELDS = [
  {
    key: "mainPhoto",
    label: "Main Bird Photo",
    required: true,
    type: "profile",
  },
  {
    key: "eyePhoto",
    label: "Eye Photo",
    required: true,
    type: "eye",
  },
  {
    key: "wingPhoto",
    label: "Wing Photo",
    required: true,
    type: "wing",
  },
  {
    key: "bandPhoto",
    label: "Band / Ring Number Photo",
    required: false,
    type: "band",
  },
  {
    key: "frontPhoto",
    label: "Front View Photo",
    required: false,
    type: "front",
  },
  {
    key: "sidePhoto",
    label: "Side View Photo",
    required: false,
    type: "side",
  },
];
export const BIRD_PHOTO_TYPES = [
  ...new Set([...BIRD_IMAGE_FIELDS.map((field) => field.type), "pedigree-doc"]),
];
export const BIRD_APPROVAL_STATUSES = ["pending", "approved", "rejected"];

const BIRD_IMAGE_KEY_BY_TYPE = Object.fromEntries(
  BIRD_IMAGE_FIELDS.map((field) => [field.type, field.key]),
);

const buildCloudinaryAssetUrl = ({ publicId = "", source = "" } = {}) => {
  const normalizedSource = String(source || "").trim();

  if (
    /^(https?:)?\/\//i.test(normalizedSource) ||
    normalizedSource.startsWith("data:image/") ||
    normalizedSource.startsWith("/")
  ) {
    return normalizedSource;
  }

  const normalizedPublicId = String(publicId || "").trim();
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const uploadTarget = normalizedSource || normalizedPublicId;

  if (!uploadTarget || !cloudName) {
    return normalizedSource;
  }

  return `https://res.cloudinary.com/${cloudName}/image/upload/${uploadTarget.replace(
    /^\/+/,
    "",
  )}`;
};

export function createEmptyBirdImageMap() {
  return BIRD_IMAGE_FIELDS.reduce(
    (imageMap, field) => ({
      ...imageMap,
      [field.key]: "",
    }),
    {},
  );
}

export function buildBirdImageMap(source = {}) {
  const images = {
    ...createEmptyBirdImageMap(),
  };

  if (source?.images && typeof source.images === "object") {
    BIRD_IMAGE_FIELDS.forEach(({ key }) => {
      const value = source.images[key];

      if (typeof value === "string" && value.trim()) {
        images[key] = value.trim();
      }
    });
  }

  if (Array.isArray(source?.photos)) {
    source.photos.forEach((photo) => {
      if (!photo || typeof photo !== "object") {
        return;
      }

      const type = String(photo.type || "").trim();
      const key = BIRD_IMAGE_KEY_BY_TYPE[type];
      const imageUrl = buildCloudinaryAssetUrl({
        publicId: photo.publicId,
        source: photo.source,
      });

      if (key && imageUrl) {
        images[key] = imageUrl;
      }
    });
  }

  if (!images.mainPhoto && typeof source?.birdImage === "string" && source.birdImage.trim()) {
    images.mainPhoto = buildCloudinaryAssetUrl({
      source: source.birdImage,
    });
  }

  return images;
}

export function buildBirdPhotosFromImageMap(imageMap = {}) {
  const normalizedImageMap = {
    ...createEmptyBirdImageMap(),
    ...(imageMap || {}),
  };

  return BIRD_IMAGE_FIELDS.flatMap(({ key, label, type }) => {
    const source = String(normalizedImageMap[key] || "").trim();

    return source
      ? [
          {
            label,
            source,
            type,
          },
        ]
      : [];
  });
}

export function getMissingRequiredBirdImages(imageMap = {}) {
  const normalizedImageMap = {
    ...createEmptyBirdImageMap(),
    ...(imageMap || {}),
  };

  return BIRD_IMAGE_FIELDS.filter(
    ({ key, required }) => required && !String(normalizedImageMap[key] || "").trim(),
  ).map(({ label }) => label);
}

const parentSchema = new Schema(
  {
    bird: {
      type: Schema.Types.ObjectId,
      ref: "Birds",
      alias: "pigeon",
    },
    bandNumber: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 40,
    },
    name: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const photoSchema = new Schema(
  {
    type: {
      type: String,
      enum: BIRD_PHOTO_TYPES,
      required: true,
    },
    label: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    source: {
      type: String,
      trim: true,
      required: true,
    },
    publicId: {
      type: String,
      trim: true,
    },
    ownerKey: {
      type: String,
      trim: true,
    },
    mimeType: {
      type: String,
      trim: true,
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

const birdDocumentItemSchema = new Schema(
  {
    number: {
      type: String,
      trim: true,
    },
    resolutionNo: {
      type: String,
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
    },
    issuedAt: {
      type: Date,
    },
    issuedBy: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const modelSchema = new Schema(
  {
    bandNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      maxlength: 40,
      set: normalizeBirdRingNumber,
      match: [
        BIRD_RING_NUMBER_PATTERN,
        "Band number must use uppercase letters, numbers, spaces, dashes, slashes, and dots only.",
      ],
      validate: {
        message:
          "Band number must use uppercase letters, numbers, spaces, dashes, slashes, and dots only.",
        validator: isValidBirdRingNumber,
      },
    },
    name: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    sex: {
      type: String,
      enum: BIRD_SEXES,
      default: "unknown",
    },
    color: {
      type: String,
      trim: true,
    },
    nationalBirdId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    strain: {
      type: String,
      trim: true,
    },
    breed: {
      type: String,
      trim: true,
    },
    bloodline: {
      type: String,
      trim: true,
    },
    species: {
      type: String,
      enum: BIRD_SPECIES,
      default: "pigeon",
    },
    category: {
      type: String,
      enum: BIRD_CATEGORIES,
      default: "racer",
    },
    hatchDate: {
      type: Date,
    },
    hatchYear: {
      type: Number,
      min: 1900,
      max: 2200,
    },
    club: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
      required: false, // Optional for guest pigeons
    },
    clubId: {
      type: Schema.Types.ObjectId,
      ref: "Clubs",
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true, // Always required for ownership tracking
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "Users",
      required: true, // Always required for ownership tracking
    },
    affiliation: {
      type: Schema.Types.ObjectId,
      ref: "Affiliations",
      required: false, // Optional for guest pigeons
    },
    loft: {
      type: Schema.Types.ObjectId,
      ref: "Lofts",
    },
    breeder: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    parents: {
      sire: {
        type: parentSchema,
        default: () => ({}),
      },
      dam: {
        type: parentSchema,
        default: () => ({}),
      },
    },
    pedigree: {
      familyName: {
        type: String,
        trim: true,
      },
      notes: {
        type: String,
        trim: true,
      },
    },
    vaccinationRecords: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    raceHistory: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    nfcTagId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    rfidTagId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    qrCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    healthStatus: {
      type: String,
      enum: BIRD_HEALTH_STATUSES,
      default: "Good",
    },
    status: {
      type: String,
      enum: BIRD_STATUSES,
      default: "active",
    },
    approvalStatus: {
      type: String,
      enum: BIRD_APPROVAL_STATUSES,
      default: "pending",
    },
    approval: {
      type: approvalSchema,
      default: () => ({}),
    },
    birdDocuments: {
      wmp: {
        type: birdDocumentItemSchema,
        default: () => ({}),
      },
      barangay: {
        type: birdDocumentItemSchema,
        default: () => ({}),
      },
      qbr: {
        type: birdDocumentItemSchema,
        default: () => ({}),
      },
    },
    remarks: {
      type: [String],
      default: [],
    },
    photos: {
      type: [photoSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Users",
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

modelSchema.virtual("isRaceEligible").get(function getIsRaceEligible() {
  return ["active", "training"].includes(this.status) && !this.deletedAt;
});

modelSchema.virtual("images").get(function getBirdImages() {
  return buildBirdImageMap({
    birdImage: this.birdImage,
    photos: this.photos,
  });
});

modelSchema.virtual("birdImage").get(function getLegacyBirdImage() {
  const images = buildBirdImageMap({
    birdImage: this.get?.("birdImage"),
    photos: this.photos,
  });

  return images.mainPhoto || "";
});

modelSchema.pre("validate", function normalizeBird(next) {
  if (!this.ownerId && this.owner) {
    this.ownerId = this.owner;
  }

  if (!this.owner && this.ownerId) {
    this.owner = this.ownerId;
  }

  if (!this.clubId && this.club) {
    this.clubId = this.club;
  }

  if (!this.club && this.clubId) {
    this.club = this.clubId;
  }

  if (!this.hatchYear && this.hatchDate) {
    this.hatchYear = this.hatchDate.getFullYear();
  }

  if (!this.strain && this.breed) {
    this.strain = this.breed;
  }

  if (!this.breed && this.strain) {
    this.breed = this.strain;
  }

  if (this.approvalStatus === "approved" && !this.approval?.approvedAt) {
    this.approval = {
      ...(this.approval || {}),
      approvedAt: new Date(),
      rejectedAt: undefined,
      rejectedBy: undefined,
    };
  }

  if (this.approvalStatus === "rejected" && !this.approval?.rejectedAt) {
    this.approval = {
      ...(this.approval || {}),
      rejectedAt: new Date(),
      approvedAt: undefined,
      approvedBy: undefined,
    };
  }

  next();
});

modelSchema.index(
  { club: 1, bandNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { 
      deletedAt: { $exists: false },
      club: { $exists: true, $ne: null } // Only enforce uniqueness for club-affiliated birds
    },
  },
);
modelSchema.index({ owner: 1, status: 1, deletedAt: 1 });
modelSchema.index({ ownerId: 1, status: 1, deletedAt: 1 });
modelSchema.index({ affiliation: 1, status: 1, deletedAt: 1 });
modelSchema.index({ loft: 1, status: 1, deletedAt: 1 });
modelSchema.index({ club: 1, status: 1, createdAt: -1 });
modelSchema.index({ clubId: 1, status: 1, createdAt: -1 });

const Entity = mongoose.model("Birds", modelSchema);

export default Entity;
