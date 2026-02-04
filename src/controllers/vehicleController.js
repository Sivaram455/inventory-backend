const { VehicleType, VehicleUsage } = require('../models');

exports.getAllVehicles = async (req, res) => {
    try {
        const vehicles = await VehicleType.findAll({
            order: [['vehicle_number', 'ASC']]
        });
        res.json(vehicles);
    } catch (error) {
        console.error('Get all vehicles error:', error);
        res.status(500).json({ message: 'Error fetching vehicles', error: error.message });
    }
};

exports.getActiveVehicles = async (req, res) => {
    try {
        const vehicles = await VehicleType.findAll({
            where: { status: 'Active' },
            order: [['vehicle_number', 'ASC']]
        });
        res.json(vehicles);
    } catch (error) {
        console.error('Get active vehicles error:', error);
        res.status(500).json({ message: 'Error fetching active vehicles', error: error.message });
    }
};

exports.createVehicle = async (req, res) => {
    try {
        const vehicleData = {
            ...req.body,
            created_by: req.user?.id || null,
            updated_by: req.user?.id || null
        };
        const vehicle = await VehicleType.create(vehicleData);
        res.status(201).json(vehicle);
    } catch (error) {
        console.error('Create vehicle error:', error);
        res.status(500).json({ message: 'Error creating vehicle', error: error.message });
    }
};

exports.updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const vehicleData = {
            ...req.body,
            updated_by: req.user?.id || null
        };
        const [updated] = await VehicleType.update(vehicleData, { where: { id } });
        if (updated) {
            const updatedVehicle = await VehicleType.findByPk(id);
            res.json(updatedVehicle);
        } else {
            res.status(404).json({ message: 'Vehicle not found' });
        }
    } catch (error) {
        console.error('Update vehicle error:', error);
        res.status(500).json({ message: 'Error updating vehicle', error: error.message });
    }
};

exports.deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await VehicleType.destroy({ where: { id } });
        if (deleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Vehicle not found' });
        }
    } catch (error) {
        console.error('Delete vehicle error:', error);
        res.status(500).json({ message: 'Error deleting vehicle', error: error.message });
    }
};

// Vehicle Usage
exports.getAllVehicleUsage = async (req, res) => {
    try {
        const usage = await VehicleUsage.findAll({
            include: [{ model: VehicleType }],
            order: [['usage_date', 'DESC']]
        });
        res.json(usage);
    } catch (error) {
        console.error('Get vehicle usage error:', error);
        res.status(500).json({ message: 'Error fetching vehicle usage', error: error.message });
    }
};

exports.createVehicleUsage = async (req, res) => {
    try {
        const usageData = {
            ...req.body,
            created_by: req.user?.id || null
        };
        const usage = await VehicleUsage.create(usageData);
        res.status(201).json(usage);
    } catch (error) {
        console.error('Create vehicle usage error:', error);
        res.status(500).json({ message: 'Error creating vehicle usage', error: error.message });
    }
};

exports.getVehicleUsageByVehicle = async (req, res) => {
    try {
        const { vehicleId } = req.params;
        const usage = await VehicleUsage.findAll({
            where: { vehicle_id: vehicleId },
            include: [{ model: VehicleType }],
            order: [['usage_date', 'DESC']]
        });
        res.json(usage);
    } catch (error) {
        console.error('Get vehicle usage by vehicle error:', error);
        res.status(500).json({ message: 'Error fetching vehicle usage', error: error.message });
    }
};
