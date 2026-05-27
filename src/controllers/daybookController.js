const { Daybook, VehicleType } = require('../models');

exports.getAllEntries = async (req, res) => {
    try {
        const entries = await Daybook.findAll({
            include: [
                { model: VehicleType, as: 'VehicleModel' }
            ],
            order: [['entry_date', 'DESC'], ['id', 'DESC']]
        });
        res.json(entries);
    } catch (error) {
        console.error('Error fetching daybook entries:', error);
        res.status(500).json({ message: 'Error fetching daybook entries' });
    }
};

exports.getEntryById = async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await Daybook.findByPk(id, {
            include: [
                { model: VehicleType, as: 'VehicleModel' }
            ]
        });
        if (!entry) {
            return res.status(404).json({ message: 'Daybook entry not found' });
        }
        res.json(entry);
    } catch (error) {
        console.error('Error fetching daybook entry:', error);
        res.status(500).json({ message: 'Error fetching daybook entry' });
    }
};

exports.createEntry = async (req, res) => {
    try {
        const newEntry = await Daybook.create({
            ...req.body,
            created_by: req.user ? req.user.id : null
        });
        res.status(201).json(newEntry);
    } catch (error) {
        console.error('Error creating daybook entry:', error);
        res.status(500).json({ message: 'Error creating daybook entry', error: error.message });
    }
};

exports.updateEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await Daybook.findByPk(id);
        if (!entry) {
            return res.status(404).json({ message: 'Daybook entry not found' });
        }
        await entry.update({
            ...req.body,
            updated_by: req.user ? req.user.id : null
        });
        res.json(entry);
    } catch (error) {
        console.error('Error updating daybook entry:', error);
        res.status(500).json({ message: 'Error updating daybook entry', error: error.message });
    }
};

exports.deleteEntry = async (req, res) => {
    try {
        const { id } = req.params;
        const entry = await Daybook.findByPk(id);
        if (!entry) {
            return res.status(404).json({ message: 'Daybook entry not found' });
        }
        await entry.destroy();
        res.json({ message: 'Daybook entry deleted successfully' });
    } catch (error) {
        console.error('Error deleting daybook entry:', error);
        res.status(500).json({ message: 'Error deleting daybook entry' });
    }
};
