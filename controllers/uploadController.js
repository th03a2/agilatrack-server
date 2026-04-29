import cloudinary from "../config/cloudinary.js";
import {
  ensureClubManagementAccess,
  ensureOwnerOrClubManager,
} from "../middleware/auth.js";
<<<<<<< Updated upstream
=======
import Birds from "../models/Birds.js";
import Clubs from "../models/Clubs.js";
>>>>>>> Stashed changes
import Users from "../models/Users.js";
import { AppError } from "../utils/appError.js";

const uploadMessages = {
  "announcement-banner": "Announcement banner uploaded successfully.",
  "bird-image": "Bird image uploaded successfully.",
  "club-logo": "Club logo uploaded successfully.",
  "profile-photo": "Profile photo uploaded successfully.",
  "valid-id": "Valid ID uploaded successfully.",
};

<<<<<<< Updated upstream
const destroyUploadedAsset = async (file) => {
  const publicId = file?.filename || file?.public_id;

  if (!publicId) {
    return;
  }

  try {
    await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: "image",
    });
  } catch {
    // Ignore cleanup failures and keep the main error path intact.
  }
};
=======
const encodePathSegment = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "asset";
>>>>>>> Stashed changes

const assertUploadAccess = ({ assetType, auth, userId }) => {
  if (["profile-photo", "valid-id"].includes(assetType)) {
    if (!userId) {
      throw new AppError(400, "A userId is required for this upload.");
    }

    ensureOwnerOrClubManager(
      userId,
      auth,
      "You do not have permission to upload files for this user.",
    );
    return;
  }

  if (["club-logo", "announcement-banner"].includes(assetType)) {
    ensureClubManagementAccess(
      auth,
      "You do not have permission to upload this asset.",
    );
  }
};

<<<<<<< Updated upstream
const saveUploadToUser = async ({ assetType, file, userId }) => {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return null;
  }

  const user = await Users.findById(normalizedUserId);
=======
const buildPublicId = ({ assetType, birdId, clubId, photoType, userId }) => {
  if (assetType === "profile-photo" && userId) {
    return `${encodePathSegment(userId)}-profile`;
  }

  if (assetType === "valid-id" && userId) {
    return `${encodePathSegment(userId)}-valid-id`;
  }

  if (assetType === "club-logo" && clubId) {
    return `${encodePathSegment(clubId)}-club-logo`;
  }

  if (assetType === "bird-image" && birdId) {
    return `${encodePathSegment(birdId)}-${encodePathSegment(photoType)}`;
  }

  return undefined;
};

const saveUploadToUser = async ({ assetType, upload, uploadResult }) => {
  if (!upload.userId) {
    return null;
  }

  const user = await Users.findById(upload.userId);
>>>>>>> Stashed changes

  if (!user) {
    throw new AppError(404, "User not found for upload persistence.");
  }

  if (assetType === "profile-photo") {
<<<<<<< Updated upstream
    user.pid = file.filename || file.public_id || user.pid;
    user.profilePhoto = file.path;
  }

  if (assetType === "valid-id") {
    user.validIdImage = file.path;
=======
    user.pid = uploadResult.version
      ? String(uploadResult.version)
      : uploadResult.asset_id || user.pid;
    user.profilePhoto = uploadResult.secure_url;
    user.files = {
      ...(user.files?.toObject?.() || user.files || {}),
      profile: user.pid,
    };
    user.profile = {
      ...(user.profile?.toObject?.() || user.profile || {}),
      at: new Date(),
    };
  }

  if (assetType === "valid-id") {
    user.validIdImage = uploadResult.secure_url;
>>>>>>> Stashed changes
  }

  await user.save();

  return {
    id: String(user._id),
    pid: user.pid || "",
    profilePhoto: user.profilePhoto || "",
    validIdImage: user.validIdImage || "",
  };
};

<<<<<<< Updated upstream
export const createUploadSuccessHandler = (assetType) => async (req, res, next) => {
  try {
    if (!req.file?.path) {
      throw new AppError(
        400,
        'No image file was uploaded. Use multipart/form-data with the "image" field.',
=======
const saveUploadToClub = async ({ assetType, upload, uploadResult }) => {
  if (assetType !== "club-logo" || !upload.clubId) {
    return null;
  }

  const club = await Clubs.findById(upload.clubId);

  if (!club) {
    throw new AppError(404, "Club not found for upload persistence.");
  }

  club.clubLogo = uploadResult.secure_url;
  club.logo = {
    publicId: uploadResult.public_id,
    updatedAt: new Date(),
    url: uploadResult.secure_url,
    version: uploadResult.version ? String(uploadResult.version) : "",
  };

  await club.save();

  return {
    clubId: String(club._id),
    clubLogo: club.clubLogo || "",
    logo: club.logo || null,
  };
};

const saveUploadToBird = async ({ assetType, upload, uploadResult }) => {
  if (assetType !== "bird-image" || !upload.birdId) {
    return null;
  }

  const bird = await Birds.findById(upload.birdId);

  if (!bird) {
    throw new AppError(404, "Bird not found for upload persistence.");
  }

  const photo = {
    type: upload.photoType || "profile",
    label: upload.label || upload.photoType || "profile",
    source: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    ownerKey: encodePathSegment(bird.owner || upload.birdId),
    mimeType: `image/${upload.extension}`,
  };
  const existingPhotos = Array.isArray(bird.photos) ? bird.photos : [];
  const withoutSameType = existingPhotos.filter(
    (entry) => String(entry?.type || "") !== String(photo.type),
  );

  bird.photos = [...withoutSameType, photo];
  await bird.save();

  return {
    birdId: String(bird._id),
    photo,
  };
};

export const createUploadSuccessHandler = (assetType) => async (req, res, next) => {
  try {
    if (!req.upload?.source) {
      throw new AppError(
        400,
        'No image payload was provided. Send a base64 data URL in the "source" field.',
>>>>>>> Stashed changes
      );
    }

    assertUploadAccess({
      assetType,
      auth: req.auth,
<<<<<<< Updated upstream
      userId: req.body?.userId,
    });

    const user = await saveUploadToUser({
      assetType,
      file: req.file,
      userId: req.body?.userId,
    });

=======
      userId: req.upload.userId,
    });

    const uploadResult = await cloudinary.uploader.upload(req.upload.source, {
      folder: req.upload.folder,
      invalidate: true,
      overwrite: true,
      public_id: buildPublicId({
        assetType,
        birdId: req.upload.birdId,
        clubId: req.upload.clubId,
        photoType: req.upload.photoType,
        userId: req.upload.userId,
      }),
      resource_type: "image",
    });

    const [user, club, bird] = await Promise.all([
      saveUploadToUser({ assetType, upload: req.upload, uploadResult }),
      saveUploadToClub({ assetType, upload: req.upload, uploadResult }),
      saveUploadToBird({ assetType, upload: req.upload, uploadResult }),
    ]);

>>>>>>> Stashed changes
    res.status(201).json({
      success: true,
      message: uploadMessages[assetType] || "Upload completed successfully.",
      assetType,
<<<<<<< Updated upstream
      imageUrl: req.file.path,
      publicId: req.file.filename || req.file.public_id || "",
      user,
    });
  } catch (error) {
    await destroyUploadedAsset(req.file);
=======
      imageUrl: uploadResult.secure_url,
      publicId: uploadResult.public_id || "",
      bird,
      club,
      user,
    });
  } catch (error) {
>>>>>>> Stashed changes
    next(error);
  }
};
