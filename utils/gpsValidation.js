/**
 * GPS Validation Utilities
 * Validates GPS coordinates for Philippine region
 */

/**
 * Validate GPS coordinates for Philippine region
 * @param {Object} coordinates - GPS coordinates
 * @param {number} coordinates.latitude - Latitude
 * @param {number} coordinates.longitude - Longitude
 * @param {number} coordinates.accuracy - GPS accuracy in meters
 * @returns {Object} Validation result
 */
function validateGPSCoordinates(coordinates) {
  const errors = [];
  
  // Check if coordinates exist
  if (!coordinates || typeof coordinates.latitude !== 'number' || typeof coordinates.longitude !== 'number') {
    errors.push('Valid latitude and longitude are required');
    return {
      isValid: false,
      errors
    };
  }
  
  // Check latitude range (Philippines: ~4°N to ~21°N)
  if (coordinates.latitude < 4 || coordinates.latitude > 21) {
    errors.push('Latitude outside Philippine range (4°N to 21°N)');
  }
  
  // Check longitude range (Philippines: ~117°E to ~127°E)
  if (coordinates.longitude < 117 || coordinates.longitude > 127) {
    errors.push('Longitude outside Philippine range (117°E to 127°E)');
  }
  
  // Check for invalid values
  if (isNaN(coordinates.latitude) || isNaN(coordinates.longitude)) {
    errors.push('Coordinates must be valid numbers');
  }
  
  // Check accuracy if provided
  if (coordinates.accuracy && (typeof coordinates.accuracy !== 'number' || coordinates.accuracy < 0)) {
    errors.push('GPS accuracy must be a positive number');
  }
  
  // Warn about poor accuracy
  if (coordinates.accuracy && coordinates.accuracy > 100) {
    errors.push('GPS accuracy is poor (>100m) - consider recapturing');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Calculate distance between two GPS points using Haversine formula
 * @param {Object} point1 - First GPS coordinates
 * @param {number} point1.latitude - Latitude
 * @param {number} point1.longitude - Longitude
 * @param {Object} point2 - Second GPS coordinates
 * @param {number} point2.latitude - Latitude
 * @param {number} point2.longitude - Longitude
 * @returns {number} Distance in kilometers
 */
function calculateAirDistance(point1, point2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(point2.latitude - point1.latitude);
  const dLon = toRadians(point2.longitude - point1.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(point1.latitude)) * Math.cos(toRadians(point2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 1000) / 1000; // Round to 3 decimal places
}

/**
 * Calculate velocity based on distance and time
 * @param {number} distance - Distance in kilometers
 * @param {string} liberationTime - Liberation timestamp
 * @param {string} arrivalTime - Arrival timestamp
 * @returns {Object} Velocity calculation
 */
function calculateVelocity(distance, liberationTime, arrivalTime) {
  const liberation = new Date(liberationTime);
  const arrival = new Date(arrivalTime);
  
  const flightTimeMs = arrival.getTime() - liberation.getTime();
  const flightTimeMinutes = flightTimeMs / (1000 * 60);
  
  if (flightTimeMinutes <= 0) {
    throw new Error('Invalid flight time: arrival must be after liberation');
  }
  
  // Convert distance to meters for velocity calculation
  const distanceMeters = distance * 1000;
  const velocityMpm = distanceMeters / flightTimeMinutes; // meters per minute
  const velocityKmh = (distance / (flightTimeMinutes / 60)); // km/h
  
  return {
    distance,
    flightTime: Math.round(flightTimeMinutes * 100) / 100,
    velocity: Math.round(velocityMpm * 100) / 100,
    velocityKmh: Math.round(velocityKmh * 100) / 100
  };
}

/**
 * Validate Philippine band format
 * @param {string} bandNumber - Band number to validate
 * @returns {Object} Validation result
 */
function validateBandFormat(bandNumber) {
  const errors = [];
  const philippineBandPattern = /^PH-\d{4}-\d{6}$/;
  
  if (!bandNumber || typeof bandNumber !== 'string') {
    errors.push('Band number is required');
    return {
      isValid: false,
      errors
    };
  }
  
  if (!philippineBandPattern.test(bandNumber)) {
    errors.push('Band format must be PH-YYYY-NNNNNN (e.g., PH-2026-000123)');
  }
  
  const year = parseInt(bandNumber.split('-')[1]);
  const currentYear = new Date().getFullYear();
  
  if (isNaN(year) || year < 2000 || year > currentYear + 1) {
    errors.push('Band year must be between 2000 and current year + 1');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Check if GPS coordinates are within reasonable distance of loft address
 * @param {Object} coordinates - GPS coordinates
 * @param {Object} address - Address object
 * @returns {Object} Validation result
 */
function validateCoordinatesVsAddress(coordinates, address) {
  const errors = [];
  
  // This is a simplified validation - in production, you might want to use
  // a geocoding service to validate the coordinates match the address
  
  if (!address || !address.province) {
    return {
      isValid: true,
      errors: []
    };
  }
  
  // Philippine province coordinate ranges (simplified)
  const provinceRanges = {
    'Ilocos Norte': { lat: [18, 19], lng: [120, 121] },
    'Ilocos Sur': { lat: [17, 18], lng: [120, 121] },
    'La Union': { lat: [16, 17], lng: [120, 121] },
    'Pangasinan': { lat: [15, 16], lng: [119, 121] },
    'Tarlac': { lat: [15, 16], lng: [120, 121] },
    'Nueva Ecija': { lat: [15, 16], lng: [120, 121] },
    'Pampanga': { lat: [14, 16], lng: [120, 121] },
    'Bulacan': { lat: [14, 15], lng: [120, 121] },
    'Benguet': { lat: [16, 17], lng: [120, 121] },
    'Batangas': { lat: [13, 14], lng: [120, 122] },
    'Cavite': { lat: [13, 14], lng: [120, 121] },
    'Laguna': { lat: [14, 15], lng: [121, 122] },
    'Quezon': { lat: [13, 15], lng: [121, 123] }
  };
  
  const range = provinceRanges[address.province];
  if (range) {
    if (coordinates.latitude < range.lat[0] || coordinates.latitude > range.lat[1] ||
        coordinates.longitude < range.lng[0] || coordinates.longitude > range.lng[1]) {
      errors.push(`GPS coordinates may not match ${address.province} province`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians) {
  return radians * (180 / Math.PI);
}

/**
 * Calculate bearing between two GPS points
 * @param {Object} from - Starting point
 * @param {Object} to - Destination point
 * @returns {number} Bearing in degrees (0-360)
 */
function calculateBearing(from, to) {
  const dLon = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  
  const y = Math.sin(dLon) * Math.cos(toLat);
  const x = 
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLon);
  
  const bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

export {
  validateGPSCoordinates,
  calculateAirDistance,
  calculateVelocity,
  validateBandFormat,
  validateCoordinatesVsAddress,
  calculateBearing,
  toRadians,
  toDegrees
};
