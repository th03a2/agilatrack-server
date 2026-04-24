import Users from "../models/Users.js";
import { AppError } from "../utils/appError.js";

const uploadMessages = {
  "announcement-banner": "Announcement banner uploaded successfully.",
  "bird-image": "Bird image uploaded successfully.",
  "club-logo": "Club logo uploaded successfully.",
  "profile-photo": "Profile photo uploaded successfully.",
  "valid-id": "Valid ID uploaded successfully.",
};

const saveUploadToUser = async ({ assetType, file, userId }) => {
  const normalizedUserId = String(userId || "").trim();

  if (!normalizedUserId) {
    return null;
  }

  const user = await Users.findById(normalizedUserId);

  if (!user) {
    throw new AppError(404, "User not found for upload persistence.");
  }

  if (assetType === "profile-photo") {
    user.pid = file.filename || file.public_id || user.pid;
    user.profilePhoto = file.path;
  }

  if (assetType === "valid-id") {
    user.validIdImage = file.path;
  }

  await user.save();

  return {
    id: String(user._id),
    pid: user.pid || "",
    profilePhoto: user.profilePhoto || "",
    validIdImage: user.validIdImage || "",
  };
};

export const createUploadSuccessHandler = (assetType) => async (req, res, next) => {
  try {
    if (!req.file?.path) {
      throw new AppError(
        400,
        'No image file was uploaded. Use multipart/form-data with the "image" field.',
      );
    }

    const user = await saveUploadToUser({
      assetType,
      file: req.file,
      userId: req.body?.userId,
    });

    res.status(201).json({
      success: true,
      message: uploadMessages[assetType] || "Upload completed successfully.",
      assetType,
      imageUrl: req.file.path,
      publicId: req.file.filename || req.file.public_id || "",
      user,
    });
  } catch (error) {
    next(error);
  }
};
