import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/roleCheck.js';
import Loft from '../models/Loft.js';
import { validateGPSCoordinates } from '../utils/gpsValidation.js';

const router = express.Router();

/**
 * PUT /api/lofts/:id/coordinates
 * Update loft GPS coordinates
 */
router.put('/:id/coordinates', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { coordinates } = req.body;
    
    if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
      return res.status(400).json({
        success: false,
        message: 'GPS coordinates are required'
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

    // Find and update loft
    const loft = await Loft.findById(id);
    if (!loft) {
      return res.status(404).json({
        success: false,
        message: 'Loft not found'
      });
    }

    // Check permissions (owner or operator can update)
    const isOwner = loft.manager?._id.toString() === req.user.id;
    const isOperator = req.user.role === 'operator' || req.user.role === 'admin';
    
    if (!isOwner && !isOperator) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied'
      });
    }

    // Update coordinates
    loft.coordinates = {
      ...coordinates,
      timestamp: new Date().toISOString(),
      source: coordinates.source || 'manual-pin'
    };

    // Reset verification if coordinates changed
    if (loft.gpsVerification?.isVerified) {
      loft.gpsVerification.isVerified = false;
      loft.gpsVerification.verificationNotes = 'Coordinates updated - re-verification required';
    }

    await loft.save();

    res.json({
      success: true,
      message: 'Loft coordinates updated successfully',
      data: {
        coordinates: loft.coordinates,
        gpsVerification: loft.gpsVerification
      }
    });
  } catch (error) {
    console.error('Error updating loft coordinates:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/lofts/:id/verify-gps
 * Verify loft GPS coordinates (operator only)
 */
router.post('/:id/verify-gps', authMiddleware, roleMiddleware(['operator', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { coordinates, verificationNotes } = req.body;
    
    if (!coordinates || !coordinates.latitude || !coordinates.longitude) {
      return res.status(400).json({
        success: false,
        message: 'GPS coordinates are required'
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

    // Find loft
    const loft = await Loft.findById(id);
    if (!loft) {
      return res.status(404).json({
        success: false,
        message: 'Loft not found'
      });
    }

    // Update coordinates and verification
    loft.coordinates = {
      ...coordinates,
      timestamp: new Date().toISOString(),
      source: 'admin-verified'
    };

    loft.gpsVerification = {
      isVerified: true,
      verifiedByOperator: req.user.name || req.user.email,
      verificationDate: new Date().toISOString(),
      verificationNotes: verificationNotes || 'Verified by operator'
    };

    await loft.save();

    res.json({
      success: true,
      message: 'Loft GPS verified successfully',
      data: {
        coordinates: loft.coordinates,
        gpsVerification: loft.gpsVerification
      }
    });
  } catch (error) {
    console.error('Error verifying loft GPS:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/lofts/:id/gps-status
 * Get loft GPS verification status
 */
router.get('/:id/gps-status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const loft = await Loft.findById(id).select('coordinates gpsVerification name manager');
    if (!loft) {
      return res.status(404).json({
        success: false,
        message: 'Loft not found'
      });
    }

    // Check permissions
    const isOwner = loft.manager?._id.toString() === req.user.id;
    const isOperator = req.user.role === 'operator' || req.user.role === 'admin';
    const isClubMember = req.user.affiliation?.club?._id === loft.club?._id;
    
    if (!isOwner && !isOperator && !isClubMember) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied'
      });
    }

    res.json({
      success: true,
      data: {
        loftId: loft._id,
        loftName: loft.name,
        coordinates: loft.coordinates,
        gpsVerification: loft.gpsVerification
      }
    });
  } catch (error) {
    console.error('Error getting loft GPS status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/lofts/:id/reset-gps-verification
 * Reset GPS verification (operator only)
 */
router.post('/:id/reset-gps-verification', authMiddleware, roleMiddleware(['operator', 'admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const loft = await Loft.findById(id);
    if (!loft) {
      return res.status(404).json({
        success: false,
        message: 'Loft not found'
      });
    }

    // Reset verification
    if (loft.gpsVerification) {
      loft.gpsVerification.isVerified = false;
      loft.gpsVerification.verificationNotes = `Verification reset: ${reason || 'Reason not provided'}`;
      loft.gpsVerification.verifiedByOperator = undefined;
      loft.gpsVerification.verificationDate = undefined;
    }

    await loft.save();

    res.json({
      success: true,
      message: 'GPS verification reset successfully',
      data: {
        gpsVerification: loft.gpsVerification
      }
    });
  } catch (error) {
    console.error('Error resetting GPS verification:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
