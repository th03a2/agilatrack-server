import express from 'express';
import { requireSessionUser, requireAnyRoleBucket } from '../middleware/sessionAuth.js';
import Race from '../models/Races.js';
import RaceResult from '../models/RaceResult.js';
import Bird from '../models/Birds.js';
import Loft from '../models/Lofts.js';
import User from '../models/Users.js';
import { calculateAirDistance, calculateVelocity, validateBandFormat } from '../utils/gpsValidation.js';

const router = express.Router();

/**
 * POST /api/races/:raceId/results/compute
 * Compute race results for all participants
 */
router.post('/:raceId/results/compute', requireSessionUser, requireAnyRoleBucket('operator', 'platform_admin'), async (req, res) => {
  try {
    const { raceId } = req.params;
    const { stationCoordinates, liberationTimestamp } = req.body;
    
    if (!stationCoordinates || !liberationTimestamp) {
      return res.status(400).json({
        success: false,
        message: 'Station coordinates and liberation timestamp are required'
      });
    }
    
    // Get race details
    const race = await Race.findById(raceId);
    if (!race) {
      return res.status(404).json({
        success: false,
        message: 'Race not found'
      });
    }
    
    // Get all participants for this race
    const participants = await RaceResult.find({ raceId, status: { $ne: 'disqualified' } })
      .populate('birdId', 'bandNumber name')
      .populate('fancierId', 'name')
      .populate('loftId', 'name coordinates');
    
    if (participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No participants found for this race'
      });
    }
    
    // Calculate results for each participant
    const velocityCalculations = participants.map(participant => {
      if (!participant.loftId.coordinates || !participant.arrivalTimestamp) {
        return null;
      }
      
      try {
        // Calculate air distance from loft to release station
        const distance = calculateAirDistance(participant.loftId.coordinates, stationCoordinates);
        
        // Calculate velocity based on flight time
        const velocityCalc = calculateVelocity(distance, liberationTimestamp, participant.arrivalTimestamp);
        
        return {
          participantId: participant._id,
          birdId: participant.birdId._id,
          bandNumber: participant.birdId.bandNumber,
          birdName: participant.birdId.name,
          fancierId: participant.fancierId._id,
          fancierName: participant.fancierId.name,
          loftId: participant.loftId._id,
          loftName: participant.loftId.name,
          distance,
          ...velocityCalc
        };
      } catch (error) {
        console.error('Error calculating velocity for participant:', participant._id, error);
        return null;
      }
    }).filter(Boolean);
    
    // Generate rankings based on velocity
    const rankedResults = generateRankings(velocityCalculations);
    
    // Update race results in database
    for (const result of rankedResults) {
      await RaceResult.findByIdAndUpdate(result.participantId, {
        distance: result.distance,
        flightTime: result.flightTime,
        velocity: result.velocity,
        velocityKmh: result.velocityKmh,
        ranking: result.ranking,
        status: 'pending',
        computedAt: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Race results computed successfully',
      data: {
        totalParticipants: participants.length,
        computedResults: rankedResults.length,
        results: rankedResults
      }
    });
  } catch (error) {
    console.error('Error computing race results:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/races/:raceId/results
 * Get race results
 */
router.get('/:raceId/results', requireSessionUser, async (req, res) => {
  try {
    const { raceId } = req.params;
    const { status, page = 1, limit = 50 } = req.query;
    
    const filter = { raceId };
    if (status) filter.status = status;
    
    const results = await RaceResult.find(filter)
      .populate('birdId', 'bandNumber name')
      .populate('fancierId', 'name')
      .populate('loftId', 'name')
      .sort({ ranking: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await RaceResult.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        payload: results,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page),
        total
      }
    });
  } catch (error) {
    console.error('Error fetching race results:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/race-results/:resultId/validate
 * Validate race result (operator only)
 */
router.post('/race-results/:resultId/validate', requireSessionUser, requireAnyRoleBucket('operator', 'platform_admin'), async (req, res) => {
  try {
    const { resultId } = req.params;
    const { validatedBy, validatedAt, notes } = req.body;
    
    const result = await RaceResult.findById(resultId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Race result not found'
      });
    }
    
    result.status = 'validated';
    result.validatedBy = validatedBy;
    result.validatedAt = validatedAt;
    result.notes = notes;
    
    await result.save();
    
    res.json({
      success: true,
      message: 'Race result validated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error validating race result:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/race-results/:resultId/protest
 * Protest race result
 */
router.post('/race-results/:resultId/protest', requireSessionUser, async (req, res) => {
  try {
    const { resultId } = req.params;
    const { protestReason, protestedBy, protestedAt } = req.body;
    
    if (!protestReason) {
      return res.status(400).json({
        success: false,
        message: 'Protest reason is required'
      });
    }
    
    const result = await RaceResult.findById(resultId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Race result not found'
      });
    }
    
    result.status = 'protested';
    result.protestReason = protestReason;
    result.protestedBy = protestedBy;
    result.protestedAt = protestedAt;
    
    await result.save();
    
    res.json({
      success: true,
      message: 'Race result protested successfully',
      data: result
    });
  } catch (error) {
    console.error('Error protesting race result:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/race-results/:resultId/disqualify
 * Disqualify participant (operator only)
 */
router.post('/race-results/:resultId/disqualify', requireSessionUser, requireAnyRoleBucket('operator', 'platform_admin'), async (req, res) => {
  try {
    const { resultId } = req.params;
    const { reason, disqualifiedBy, disqualifiedAt } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Disqualification reason is required'
      });
    }
    
    const result = await RaceResult.findById(resultId);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Race result not found'
      });
    }
    
    result.status = 'disqualified';
    result.disqualificationReason = reason;
    result.disqualifiedBy = disqualifiedBy;
    result.disqualifiedAt = disqualifiedAt;
    result.ranking = null; // Remove ranking
    
    await result.save();
    
    res.json({
      success: true,
      message: 'Participant disqualified successfully',
      data: result
    });
  } catch (error) {
    console.error('Error disqualifying participant:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/races/:raceId/publish-results
 * Publish official race results (operator only)
 */
router.post('/:raceId/publish-results', requireSessionUser, requireAnyRoleBucket('operator', 'platform_admin'), async (req, res) => {
  try {
    const { raceId } = req.params;
    const { publishedBy, publishedAt } = req.body;
    
    const race = await Race.findById(raceId);
    if (!race) {
      return res.status(404).json({
        success: false,
        message: 'Race not found'
      });
    }
    
    // Check if all results are validated
    const unvalidatedResults = await RaceResult.countDocuments({ 
      raceId, 
      status: { $in: ['pending', 'under_review'] }
    });
    
    if (unvalidatedResults > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish results while some are still pending validation'
      });
    }
    
    // Update all validated results to official
    await RaceResult.updateMany(
      { raceId, status: 'validated' },
      { 
        status: 'official',
        publishedBy,
        publishedAt
      }
    );
    
    // Update race status
    race.status = 'published';
    race.publishedAt = publishedAt;
    await race.save();
    
    res.json({
      success: true,
      message: 'Race results published successfully'
    });
  } catch (error) {
    console.error('Error publishing race results:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/races/:raceId/recompute-rankings
 * Recompute rankings after validation/disqualification changes
 */
router.post('/:raceId/recompute-rankings', requireSessionUser, requireAnyRoleBucket('operator', 'platform_admin'), async (req, res) => {
  try {
    const { raceId } = req.params;
    
    // Get all non-disqualified results
    const results = await RaceResult.find({ 
      raceId, 
      status: { $ne: 'disqualified' }
    }).sort({ velocity: -1 });
    
    // Recompute rankings
    const rankedResults = results.map((result, index) => ({
      ...result.toObject(),
      ranking: index + 1
    }));
    
    // Update rankings in database
    for (const result of rankedResults) {
      await RaceResult.findByIdAndUpdate(result._id, {
        ranking: result.ranking
      });
    }
    
    res.json({
      success: true,
      message: 'Rankings recomputed successfully',
      data: {
        totalResults: rankedResults.length,
        rankings: rankedResults.map(r => ({
          resultId: r._id,
          ranking: r.ranking,
          bandNumber: r.bandNumber,
          velocity: r.velocity
        }))
      }
    });
  } catch (error) {
    console.error('Error recomputing rankings:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/races/:raceId/participants
 * Add participant to race
 */
router.post('/:raceId/participants', requireSessionUser, async (req, res) => {
  try {
    const { raceId } = req.params;
    const { birdId, arrivalTimestamp, timingMethod, scannedBy } = req.body;
    
    if (!birdId || !arrivalTimestamp || !timingMethod || !scannedBy) {
      return res.status(400).json({
        success: false,
        message: 'Bird ID, arrival timestamp, timing method, and scanned by are required'
      });
    }
    
    // Get bird details
    const bird = await Bird.findById(birdId).populate('fancierId loftId');
    if (!bird) {
      return res.status(404).json({
        success: false,
        message: 'Bird not found'
      });
    }
    
    // Validate band format
    const bandValidation = validateBandFormat(bird.bandNumber);
    if (!bandValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid band format',
        errors: bandValidation.errors
      });
    }
    
    // Check if already participated
    const existingResult = await RaceResult.findOne({ raceId, birdId });
    if (existingResult) {
      return res.status(400).json({
        success: false,
        message: 'Bird already participated in this race'
      });
    }
    
    // Create race result
    const raceResult = new RaceResult({
      raceId,
      birdId,
      fancierId: bird.fancierId._id,
      loftId: bird.loftId._id,
      bandNumber: bird.bandNumber,
      birdName: bird.name,
      fancierName: bird.fancierId.name,
      loftName: bird.loftId.name,
      arrivalTimestamp,
      timingMethod,
      scannedBy,
      status: 'pending'
    });
    
    await raceResult.save();
    
    res.status(201).json({
      success: true,
      message: 'Participant added successfully',
      data: raceResult
    });
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/races/:raceId/statistics
 * Get race statistics
 */
router.get('/:raceId/statistics', requireSessionUser, async (req, res) => {
  try {
    const { raceId } = req.params;
    
    const stats = await RaceResult.aggregate([
      { $match: { raceId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgVelocity: { $avg: '$velocity' },
          avgDistance: { $avg: '$distance' },
          avgFlightTime: { $avg: '$flightTime' }
        }
      }
    ]);
    
    const totalParticipants = await RaceResult.countDocuments({ raceId });
    const completedRaces = await RaceResult.countDocuments({ raceId, status: { $ne: 'pending' } });
    
    res.json({
      success: true,
      data: {
        totalParticipants,
        completedRaces,
        statusBreakdown: stats,
        completionRate: totalParticipants > 0 ? (completedRaces / totalParticipants * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching race statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
