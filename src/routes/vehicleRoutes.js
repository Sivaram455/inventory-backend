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

const { checkPrivilege } = require('../middleware/privilegeMiddleware');

// Vehicle Routes
router.get('/vehicles', authMiddleware, checkPrivilege('Vehicle Type', 'view'), vehicleController.getAllVehicles);
router.get('/vehicles/active', authMiddleware, checkPrivilege('Vehicle Type', 'view'), vehicleController.getActiveVehicles);
router.post('/vehicles', authMiddleware, checkPrivilege('Vehicle Type', 'add'), vehicleController.createVehicle);
router.put('/vehicles/:id', authMiddleware, checkPrivilege('Vehicle Type', 'edit'), vehicleController.updateVehicle);
router.delete('/vehicles/:id', authMiddleware, checkPrivilege('Vehicle Type', 'delete'), vehicleController.deleteVehicle);

// Vehicle Usage Routes
router.get('/usage', authMiddleware, checkPrivilege('Vehicle Usage', 'view'), vehicleController.getAllVehicleUsage);
router.get('/usage/vehicle/:vehicleId', authMiddleware, checkPrivilege('Vehicle Usage', 'view'), vehicleController.getVehicleUsageByVehicle);
router.post('/usage', authMiddleware, checkPrivilege('Vehicle Usage', 'add'), vehicleController.createVehicleUsage);

module.exports = router;
