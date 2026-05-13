import express from 'express';
import { requireSessionUser, requireAnyRoleBucket } from '../middleware/sessionAuth.js';
import RaceStation from '../models/RaceStation.js';
import LiberationRecord from '../models/LiberationRecord.js';
import { validateGPSCoordinates, calculateAirDistance } from '../utils/gpsValidation.js';

const router = express.Router();

/**
 * GET /api/race-stations
 * Get all race stations
 */
router.get('/', requireSessionUser, async (req, res) => {
  try {
    const { page = 1, limit = 20, region, province, isActive } = req.query;
    
    const filter = {};
    if (region) filter.region = region;
    if (province) filter.province = province;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const stations = await RaceStation.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('createdBy', 'name email');
    
    const total = await RaceStation.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        payload: stations,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching race stations:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/race-stations/:id
 * Get single race station
 */
router.get('/:id', requireSessionUser, async (req, res) => {
  try {
    const station = await RaceStation.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Race station not found'
      });
    }
    
    res.json({
      success: true,
      data: station
    });
  } catch (error) {
    console.error('Error fetching race station:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/race-stations
 * Create new race station (operator/admin only)
 */
router.post('/', requireSessionUser, requireAnyRoleBucket('operator', 'platform_admin'), async (req, res) => {
  try {
    const {
      stationName,
      coordinates,
      region,
      province,
      description
    } = req.body;
    
    // Validate required fields
    if (!stationName || !coordinates || !region || !province) {
      return res.status(400).json({
        success: false,
        message: 'Station name, coordinates, region, and province are required'
      });
    }
    
    // Validate GPS coordinates
    const validation = validateGPSCoordinates(coordinates);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS coordinates',
        errors: validation.errors
      });
    }
    
    // Check for duplicate station name
    const existingStation = await RaceStation.findOne({ stationName });
    if (existingStation) {
      return res.status(400).json({
        success: false,
        message: 'A station with this name already exists'
      });
    }
    
    const station = new RaceStation({
      stationName,
      coordinates,
      region,
      province,
      description,
      isActive: true,
      createdBy: req.auth.userId
    });
    
    await station.save();
    await station.populate('createdBy', 'name email');
    
    res.status(201).json({
      success: true,
      message: 'Race station created successfully',
      data: station
    });
  } catch (error) {
    console.error('Error creating race station:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/race-stations/:id
 * Update race station (operator/admin only)
 */
router.put('/:id', requireSessionUser, requireAnyRoleBucket('operator', 'platform_admin'), async (req, res) => {
  try {
    const updates = req.body;
    
    // Validate coordinates if provided
    if (updates.coordinates) {
      const validation = validateGPSCoordinates(updates.coordinates);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid GPS coordinates',
          errors: validation.errors
        });
      }
    }
    
    const station = await RaceStation.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email');
    
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Race station not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Race station updated successfully',
      data: station
    });
  } catch (error) {
    console.error('Error updating race station:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/race-stations/:id
 * Delete race station (admin only)
 */
router.delete('/:id', requireSessionUser, requireAnyRoleBucket('platform_admin'), async (req, res) => {
  try {
    const station = await RaceStation.findById(req.params.id);
    
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Race station not found'
      });
    }
    
    // Check if station has liberation records
    const liberationCount = await LiberationRecord.countDocuments({ stationId: req.params.id });
    if (liberationCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete station with liberation records'
      });
    }
    
    await RaceStation.findByIdAndDelete(req.params.id);
    
    res.json({
      success: true,
      message: 'Race station deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting race station:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/race-stations/:id/liberation
 * Record liberation at race station (operator only)
 */
router.post('/:id/liberation', requireSessionUser, requireAnyRoleBucket('operator', 'platform_admin'), async (req, res) => {
  try {
    const { raceId, weatherConditions, notes, totalBirdsReleased, cratesReleased } = req.body;
    
    if (!raceId || !weatherConditions || !totalBirdsReleased || !cratesReleased) {
      return res.status(400).json({
        success: false,
        message: 'Race ID, weather conditions, total birds, and crates are required'
      });
    }
    
    const station = await RaceStation.findById(req.params.id);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Race station not found'
      });
    }
    
    // Create liberation record
    const liberation = new LiberationRecord({
      raceId,
      stationId: req.params.id,
      timestamp: new Date().toISOString(),
      liberatedByOperator: req.auth.user.name || req.auth.user.email,
      weatherConditions,
      notes,
      totalBirdsReleased,
      cratesReleased,
      createdAt: new Date().toISOString()
    });
    
    await liberation.save();
    
    // Update station with liberation info
    station.liberation = {
      timestamp: liberation.timestamp,
      liberatedByOperator: liberation.liberatedByOperator,
      weatherConditions: liberation.weatherConditions,
      notes: liberation.notes,
      totalBirdsReleased: liberation.totalBirdsReleased,
      cratesReleased: liberation.cratesReleased
    };
    
    await station.save();
    
    res.status(201).json({
      success: true,
      message: 'Liberation recorded successfully',
      data: liberation
    });
  } catch (error) {
    console.error('Error recording liberation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/race-stations/:id/weather
 * Update weather conditions at race station (operator only)
 */
router.put('/:id/weather', requireSessionUser, requireAnyRoleBucket('operator', 'platform_admin'), async (req, res) => {
  try {
    const { temperature, humidity, windDirection, windSpeed, conditions } = req.body;
    
    const station = await RaceStation.findById(req.params.id);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Race station not found'
      });
    }
    
    station.weather = {
      temperature,
      humidity,
      windDirection,
      windSpeed,
      conditions,
      lastUpdated: new Date().toISOString()
    };
    
    await station.save();
    
    res.json({
      success: true,
      message: 'Weather conditions updated successfully',
      data: station.weather
    });
  } catch (error) {
    console.error('Error updating weather:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/race-stations/:id/distance/:loftId
 * Calculate distance from station to loft
 */
router.get('/:id/distance/:loftId', requireSessionUser, async (req, res) => {
  try {
    const station = await RaceStation.findById(req.params.id);
    if (!station) {
      return res.status(404).json({
        success: false,
        message: 'Race station not found'
      });
    }
    
    // Get loft coordinates (this would need to be implemented based on your loft model)
    const loft = await Loft.findById(req.params.loftId).select('coordinates name');
    if (!loft || !loft.coordinates) {
      return res.status(404).json({
        success: false,
        message: 'Loft not found or no GPS coordinates available'
      });
    }
    
    const distance = calculateAirDistance(station.coordinates, loft.coordinates);
    
    res.json({
      success: true,
      data: {
        stationId: station._id,
        stationName: station.stationName,
        loftId: loft._id,
        loftName: loft.name,
        distance,
        stationCoordinates: station.coordinates,
        loftCoordinates: loft.coordinates
      }
    });
  } catch (error) {
    console.error('Error calculating distance:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/race-stations/regions
 * Get list of available regions
 */
router.get('/regions/list', requireSessionUser, async (req, res) => {
  try {
    const regions = await RaceStation.distinct('region');
    
    res.json({
      success: true,
      data: regions
    });
  } catch (error) {
    console.error('Error fetching regions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/race-stations/provinces/:region
 * Get list of provinces in a region
 */
router.get('/provinces/:region', requireSessionUser, async (req, res) => {
  try {
    const { region } = req.params;
    const provinces = await RaceStation.distinct('province', { region });
    
    res.json({
      success: true,
      data: provinces
    });
  } catch (error) {
    console.error('Error fetching provinces:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
