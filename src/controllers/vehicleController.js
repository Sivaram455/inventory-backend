const { VehicleType, VehicleUsage } = require('../models');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const exceljs = require('exceljs');

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
        
        if (req.file) {
            vehicleData.image = `/uploads/${req.file.filename}`;
        }

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

        if (req.file) {
            vehicleData.image = `/uploads/${req.file.filename}`;
        }

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

exports.bulkUpload = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    try {
        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        const vehiclesToCreate = data.map(item => ({
            name: item.Name || item.name,
            mode: item.Mode || item.mode || '4-Wheeler',
            make: item.Make || item.make,
            vehicle_number: item['Vehicle Number'] || item.vehicle_number,
            status: item.Status || item.status || 'Active',
            created_by: req.user?.id || null,
            updated_by: req.user?.id || null
        })).filter(v => v.name && v.vehicle_number);

        await VehicleType.bulkCreate(vehiclesToCreate, { ignoreDuplicates: true });

        // Clean up uploaded file
        fs.unlinkSync(req.file.path);

        res.json({ message: 'Bulk upload successful', count: vehiclesToCreate.length });
    } catch (error) {
        if (req.file) fs.unlinkSync(req.file.path);
        console.error('Bulk upload error:', error);
        res.status(500).json({ message: 'Error processing bulk upload', error: error.message });
    }
};

exports.downloadSample = async (req, res) => {
    try {
        const workbook = new exceljs.Workbook();
        const worksheet = workbook.addWorksheet('Vehicle Types');

        worksheet.columns = [
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Mode', key: 'mode', width: 15 },
            { header: 'Make', key: 'make', width: 15 },
            { header: 'Vehicle Number', key: 'vehicle_number', width: 20 },
            { header: 'Status', key: 'status', width: 10 }
        ];

        worksheet.addRow({
            name: 'Delivery Truck A',
            mode: 'Truck',
            make: 'Tata',
            vehicle_number: 'KA-01-AB-1234',
            status: 'Active'
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=vehicle_types_sample.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download sample error:', error);
        res.status(500).json({ message: 'Error generating sample file' });
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

