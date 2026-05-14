import mongoose from 'mongoose';

const coordinatesSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90
  },
  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180
  },
  accuracy: {
    type: Number,
    min: 0
  }
}, { _id: false });

const weatherSchema = new mongoose.Schema({
  temperature: {
    type: Number,
    min: -50,
    max: 60
  },
  humidity: {
    type: Number,
    min: 0,
    max: 100
  },
  windDirection: {
    type: String,
    enum: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'Variable']
  },
  windSpeed: {
    type: Number,
    min: 0
  },
  conditions: {
    type: String,
    enum: ['Clear', 'Partly Cloudy', 'Cloudy', 'Overcast', 'Light Rain', 'Rain', 'Heavy Rain', 'Storm', 'Fog', 'Mist']
  },
  lastUpdated: {
    type: String
  }
}, { _id: false });

const liberationSchema = new mongoose.Schema({
  timestamp: {
    type: String,
    required: true
  },
  liberatedByOperator: {
    type: String,
    required: true
  },
  weatherConditions: {
    type: String,
    required: true
  },
  notes: {
    type: String
  },
  totalBirdsReleased: {
    type: Number,
    required: true,
    min: 0
  },
  cratesReleased: {
    type: Number,
    required: true,
    min: 0
  }
}, { _id: false });

const raceStationSchema = new mongoose.Schema({
  stationName: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  coordinates: {
    type: coordinatesSchema,
    required: true
  },
  region: {
    type: String,
    required: true,
    trim: true
  },
  province: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  weather: {
    type: weatherSchema
  },
  liberation: {
    type: liberationSchema
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Users',
    required: true
  },
  createdAt: {
    type: String,
    default: () => new Date().toISOString()
  },
  updatedAt: {
    type: String,
    default: () => new Date().toISOString()
  }
}, {
  timestamps: false,
  collection: 'racestations'
});

// Index for efficient queries
raceStationSchema.index({ region: 1, province: 1 });
raceStationSchema.index({ isActive: 1 });

// Update updatedAt on save
raceStationSchema.pre('save', function(next) {
  this.updatedAt = new Date().toISOString();
  next();
});

// Static method to get stations by region
raceStationSchema.statics.getByRegion = function(region) {
  return this.find({ region, isActive: true }).sort({ stationName: 1 });
};

// Static method to get stations by province
raceStationSchema.statics.getByProvince = function(province) {
  return this.find({ province, isActive: true }).sort({ stationName: 1 });
};

// Instance method to check if station has active liberation
raceStationSchema.methods.hasActiveLiberation = function() {
  if (!this.liberation) return false;
  
  const liberationTime = new Date(this.liberation.timestamp);
  const now = new Date();
  const hoursSinceLiberation = (now - liberationTime) / (1000 * 60 * 60);
  
  // Consider liberation active for 24 hours
  return hoursSinceLiberation <= 24;
};

// Instance method to get distance to a point
raceStationSchema.methods.getDistanceTo = function(coordinates) {
  if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
    throw new Error('Valid coordinates required');
  }
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coordinates.latitude - this.coordinates.latitude);
  const dLon = toRadians(coordinates.longitude - this.coordinates.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(this.coordinates.latitude)) * Math.cos(toRadians(coordinates.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 1000) / 1000; // Round to 3 decimal places
};

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

const RaceStation = mongoose.model('RaceStation', raceStationSchema);

export default RaceStation;
