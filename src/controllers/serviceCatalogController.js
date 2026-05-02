const { ServiceCatalog } = require('../models');
const { Op } = require('sequelize');

// Seed data matching the UI screenshot
const SEED_SERVICES = [
    // PPF
    { category: 'PPF', service_name: 'Full Body PPF', description: 'Complete exterior — all panels', base_price: 24000, applies_multiplier: true, sort_order: 1 },
    { category: 'PPF', service_name: 'Front End Package', description: 'Bumper + bonnet + fenders', base_price: 10000, applies_multiplier: true, sort_order: 2 },
    { category: 'PPF', service_name: 'Bonnet / Hood Only', description: 'Bonnet panel protection', base_price: 5000, applies_multiplier: true, sort_order: 3 },
    { category: 'PPF', service_name: 'Roof Only', description: 'Roof panel protection', base_price: 4200, applies_multiplier: true, sort_order: 4 },
    { category: 'PPF', service_name: 'Door Edge Guards', description: '4 door edge chip protection strips', base_price: 2200, applies_multiplier: true, sort_order: 5 },
    { category: 'PPF', service_name: 'Custom / Partial', description: 'Specific panels — quoted per panel', base_price: 3200, applies_multiplier: true, sort_order: 6 },
    // Ceramic Coating
    { category: 'Ceramic Coating', service_name: 'Full Body Ceramic', description: '9H hardness nano-ceramic coat', base_price: 11000, applies_multiplier: true, sort_order: 1 },
    { category: 'Ceramic Coating', service_name: 'Glass / Windshield', description: 'Hydrophobic coating for all glass', base_price: 3200, applies_multiplier: true, sort_order: 2 },
    { category: 'Ceramic Coating', service_name: 'Wheel Ceramic', description: 'All 4 alloy wheels protected', base_price: 3800, applies_multiplier: true, sort_order: 3 },
    { category: 'Ceramic Coating', service_name: 'Interior Ceramic', description: 'Dashboard + fabric + leather protect', base_price: 4800, applies_multiplier: true, sort_order: 4 },
    // Window Tinting
    { category: 'Window Tinting', service_name: 'Full Car Tint', description: 'All windows including windshield', base_price: 6000, applies_multiplier: true, sort_order: 1 },
    { category: 'Window Tinting', service_name: 'Side Windows Only', description: '4 side doors + rear quarter', base_price: 3200, applies_multiplier: true, sort_order: 2 },
    { category: 'Window Tinting', service_name: 'Rear Windshield', description: 'Rear glass tinting only', base_price: 1800, applies_multiplier: true, sort_order: 3 },
    { category: 'Window Tinting', service_name: 'Front Windshield', description: 'Front windshield UV cut film', base_price: 2000, applies_multiplier: true, sort_order: 4 },
    // Dashcam
    { category: 'Dashcam Installation', service_name: 'Front Camera', description: 'Single channel front recording', base_price: 2200, applies_multiplier: false, sort_order: 1 },
    { category: 'Dashcam Installation', service_name: 'Front + Rear', description: 'Dual channel front & rear system', base_price: 5000, applies_multiplier: false, sort_order: 2 },
    { category: 'Dashcam Installation', service_name: '360° System', description: 'Full surround view camera setup', base_price: 11000, applies_multiplier: false, sort_order: 3 },
    { category: 'Dashcam Installation', service_name: 'Parking Mode Kit', description: 'Hardwire + capacitor for parking mode', base_price: 1600, applies_multiplier: false, sort_order: 4 },
    // Detailing
    { category: 'Detailing & Polishing', service_name: 'Exterior Detail', description: 'Foam wash + dry + tyre shine', base_price: 1400, applies_multiplier: true, sort_order: 1 },
    { category: 'Detailing & Polishing', service_name: 'Paint Correction', description: 'Remove swirls, scratches, oxidation', base_price: 7500, applies_multiplier: true, sort_order: 2 },
    { category: 'Detailing & Polishing', service_name: 'Interior Detail', description: 'Full interior clean + vacuum + condition', base_price: 3500, applies_multiplier: true, sort_order: 3 },
    { category: 'Detailing & Polishing', service_name: 'Engine Bay Detail', description: 'Degrease, clean and protect engine bay', base_price: 2400, applies_multiplier: false, sort_order: 4 },
    { category: 'Detailing & Polishing', service_name: 'Headlight Restoration', description: 'Restore clarity to foggy headlights', base_price: 1800, applies_multiplier: false, sort_order: 5 },
    { category: 'Detailing & Polishing', service_name: 'Ozone Treatment', description: 'Eliminate interior odour completely', base_price: 1600, applies_multiplier: false, sort_order: 6 },
    // Vinyl Wrapping
    { category: 'Vinyl Wrapping', service_name: 'Full Body Wrap', description: 'Complete exterior vinyl transformation', base_price: 32000, applies_multiplier: true, sort_order: 1 },
    { category: 'Vinyl Wrapping', service_name: 'Roof Wrap', description: 'Contrast colour roof panel wrap', base_price: 7000, applies_multiplier: true, sort_order: 2 },
    { category: 'Vinyl Wrapping', service_name: 'Bonnet Wrap', description: 'Bonnet colour change vinyl', base_price: 5500, applies_multiplier: true, sort_order: 3 },
    { category: 'Vinyl Wrapping', service_name: 'Pillar Wrap', description: 'A/B/C pillar gloss or matte black', base_price: 3000, applies_multiplier: true, sort_order: 4 },
    // Add-ons (flat rate)
    { category: 'Add-ons', service_name: 'Clay Bar Treatment', description: 'Deep paint decontamination', base_price: 800, applies_multiplier: false, sort_order: 1 },
    { category: 'Add-ons', service_name: 'Carnauba Wax', description: 'Natural wax protection layer', base_price: 1200, applies_multiplier: false, sort_order: 2 },
    { category: 'Add-ons', service_name: 'Snow Foam Bath', description: 'Pre-wash foam treatment', base_price: 500, applies_multiplier: false, sort_order: 3 },
    { category: 'Add-ons', service_name: 'Tyre Shine & Dressing', description: 'All 4 tyres dressed and shined', base_price: 600, applies_multiplier: false, sort_order: 4 },
    { category: 'Add-ons', service_name: 'Leather Conditioning', description: 'Deep leather seat conditioning', base_price: 1500, applies_multiplier: false, sort_order: 5 },
    { category: 'Add-ons', service_name: 'Interior Deodorizer', description: 'Fragrance treatment for cabin', base_price: 400, applies_multiplier: false, sort_order: 6 },
];

exports.getAll = async (req, res) => {
    try {
        const services = await ServiceCatalog.findAll({ order: [['category', 'ASC'], ['sort_order', 'ASC']] });
        res.json({ success: true, data: services });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getActive = async (req, res) => {
    try {
        const services = await ServiceCatalog.findAll({
            where: { is_active: true },
            order: [['category', 'ASC'], ['sort_order', 'ASC']]
        });
        res.json({ success: true, data: services });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getCategories = async (req, res) => {
    try {
        const rows = await ServiceCatalog.findAll({
            attributes: ['category'],
            group: ['category'],
            order: [['category', 'ASC']]
        });
        res.json({ success: true, data: rows.map(r => r.category) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.create = async (req, res) => {
    try {
        const { category, service_name, description, base_price, applies_multiplier, is_active, sort_order } = req.body;
        if (!category || !service_name || base_price == null)
            return res.status(400).json({ success: false, message: 'category, service_name and base_price are required' });
        const service = await ServiceCatalog.create({
            category, service_name, description, base_price,
            applies_multiplier: applies_multiplier !== undefined ? applies_multiplier : true,
            is_active: is_active !== undefined ? is_active : true,
            sort_order: sort_order || 0,
            created_by: req.user?.id
        });
        res.status(201).json({ success: true, data: service });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.update = async (req, res) => {
    try {
        const service = await ServiceCatalog.findByPk(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
        await service.update({ ...req.body, updated_by: req.user?.id });
        res.json({ success: true, data: service });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.remove = async (req, res) => {
    try {
        const service = await ServiceCatalog.findByPk(req.params.id);
        if (!service) return res.status(404).json({ success: false, message: 'Service not found' });
        await service.destroy();
        res.json({ success: true, message: 'Deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.seed = async (req, res) => {
    try {
        const existing = await ServiceCatalog.count();
        if (existing > 0)
            return res.json({ success: false, message: `Already seeded (${existing} records exist). Delete all first.` });
        await ServiceCatalog.bulkCreate(SEED_SERVICES);
        res.json({ success: true, message: `Seeded ${SEED_SERVICES.length} services` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
