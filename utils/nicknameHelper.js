import Users from "../models/Users.js";

/**
 * Check if a nickname is already taken (case-insensitive)
 * @param {string} nickname - The nickname to check
 * @param {string} excludeUserId - Optional user ID to exclude from check (for updates)
 * @returns {Promise<boolean>} - True if nickname is taken
 */
export async function isNicknameTaken(nickname, excludeUserId = null) {
  if (!nickname) return false;
  
  const normalizedNickname = nickname.trim().toLowerCase();
  const query = { 
    $or: [
      { normalizedNickname: normalizedNickname },
      { username: { $regex: `^${normalizedNickname}$`, $options: 'i' } }
    ]
  };
  
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }
  
  const existingUser = await Users.findOne(query);
  return !!existingUser;
}

/**
 * Generate available nickname suggestions
 * @param {string} baseNickname - The base nickname to generate suggestions for
 * @param {number} count - Number of suggestions to generate (default: 3)
 * @param {string} excludeUserId - Optional user ID to exclude from check
 * @returns {Promise<string[]>} - Array of available nickname suggestions
 */
export async function generateNicknameSuggestions(baseNickname, count = 3, excludeUserId = null) {
  if (!baseNickname) return [];
  
  const suggestions = [];
  const trimmedBase = baseNickname.trim();
  let counter = 1;
  
  while (suggestions.length < count && counter <= 100) { // Prevent infinite loop
    const suggestion = `${trimmedBase}${counter}`;
    const isTaken = await isNicknameTaken(suggestion, excludeUserId);
    
    if (!isTaken) {
      suggestions.push(suggestion);
    }
    
    counter++;
  }
  
  return suggestions;
}

/**
 * Validate nickname and provide suggestions if taken
 * @param {string} nickname - The nickname to validate
 * @param {string} excludeUserId - Optional user ID to exclude from check
 * @returns {Promise<Object>} - Validation result with suggestions if needed
 */
export async function validateNickname(nickname, excludeUserId = null) {
  if (!nickname || nickname.trim().length === 0) {
    return {
      isValid: false,
      error: "Nickname is required.",
      suggestions: []
    };
  }
  
  const trimmedNickname = nickname.trim();
  
  if (trimmedNickname.length < 2) {
    return {
      isValid: false,
      error: "Nickname must be at least 2 characters long.",
      suggestions: []
    };
  }
  
  if (trimmedNickname.length > 32) {
    return {
      isValid: false,
      error: "Nickname must be less than 33 characters long.",
      suggestions: []
    };
  }
  
  const isTaken = await isNicknameTaken(trimmedNickname, excludeUserId);
  
  if (isTaken) {
    const suggestions = await generateNicknameSuggestions(trimmedNickname, 3, excludeUserId);
    return {
      isValid: false,
      error: "Nickname is already taken.",
      suggestions
    };
  }
  
  return {
    isValid: true,
    error: null,
    suggestions: []
  };
}

/**
 * Get the normalized version of a nickname for storage
 * @param {string} nickname - The nickname to normalize
 * @returns {string} - Normalized nickname
 */
export function normalizeNickname(nickname) {
  return nickname ? nickname.trim().toLowerCase() : '';
}
