export const BIRD_RING_NUMBER_PATTERN = /^[A-Z0-9][A-Z0-9 ./-]{0,39}$/;

export const normalizeBirdRingNumber = (value = "") =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();

export const isValidBirdRingNumber = (value = "") =>
  BIRD_RING_NUMBER_PATTERN.test(normalizeBirdRingNumber(value));

export const formatBirdRingNumber = (value = "") => normalizeBirdRingNumber(value);

export default {
  BIRD_RING_NUMBER_PATTERN,
  formatBirdRingNumber,
  isValidBirdRingNumber,
  normalizeBirdRingNumber,
};
