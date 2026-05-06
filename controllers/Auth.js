import {
  getCurrentUser as getCurrentUserService,
  login as loginService,
  register as registerService,
  sendVerificationCode as sendVerificationCodeService,
  update as updateService,
  uploadProfile as uploadProfileService,
  validateRefresh as validateRefreshService,
  verifyEmailCode as verifyEmailCodeService,
} from "../services/authService.js";

export const login = (req, res) => loginService(req, res);

export const getCurrentUser = (req, res) => getCurrentUserService(req, res);

export const validateRefresh = (req, res) => validateRefreshService(req, res);

export const sendVerificationCode = (req, res) => sendVerificationCodeService(req, res);

export const verifyEmailCode = (req, res) => verifyEmailCodeService(req, res);

export const register = (req, res) => registerService(req, res);

export const update = (req, res) => updateService(req, res);

export const uploadProfile = (req, res) => uploadProfileService(req, res);
