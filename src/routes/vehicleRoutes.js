const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const authMiddleware = require('../middleware/authMiddleware');

// Optional auth middleware - tries to get user but doesn't block if not authenticated
const optionalAuth = (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (token) {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }
    } catch (error) {
        // Continue without user
    }
    next();
};

// Vehicle Routes
router.get('/vehicles', optionalAuth, vehicleController.getAllVehicles);
router.get('/vehicles/active', optionalAuth, vehicleController.getActiveVehicles);
router.post('/vehicles', authMiddleware, vehicleController.createVehicle);
router.put('/vehicles/:id', authMiddleware, vehicleController.updateVehicle);
router.delete('/vehicles/:id', authMiddleware, vehicleController.deleteVehicle);

// Vehicle Usage Routes
router.get('/usage', optionalAuth, vehicleController.getAllVehicleUsage);
router.get('/usage/vehicle/:vehicleId', optionalAuth, vehicleController.getVehicleUsageByVehicle);
router.post('/usage', authMiddleware, vehicleController.createVehicleUsage);

module.exports = router;
