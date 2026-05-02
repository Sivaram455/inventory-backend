const { Warehouse, WarehouseRack, WarehouseStock, ProductItem, ProductMaster, sequelize } = require('../models');
const { validateRackCode, normalizeRackCode } = require('../utils/rackValidation');

// ─── Warehouse CRUD ───────────────────────────────────────────────────────────

exports.getAllWarehouses = async (req, res) => {
    try {
        const warehouses = await Warehouse.findAll({
            where: { status: 'Active' },
            include: [{ model: WarehouseRack, as: 'racks', where: { status: 'Active' }, required: false }],
            order: [['name', 'ASC']]
        });
        res.json(warehouses);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching warehouses', error: error.message });
    }
};

exports.createWarehouse = async (req, res) => {
    try {
        const { name, code, address } = req.body;
        const warehouse = await Warehouse.create({ name, code, address, created_by: req.user?.id });
        res.status(201).json(warehouse);
    } catch (error) {
        res.status(500).json({ message: 'Error creating warehouse', error: error.message });
    }
};

exports.updateWarehouse = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, address, status } = req.body;
        await Warehouse.update({ name, code, address, status, updated_by: req.user?.id }, { where: { id } });
        res.json({ message: 'Warehouse updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating warehouse', error: error.message });
    }
};

exports.deleteWarehouse = async (req, res) => {
    try {
        await Warehouse.update({ status: 'Inactive' }, { where: { id: req.params.id } });
        res.json({ message: 'Warehouse deactivated' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting warehouse', error: error.message });
    }
};

// ─── Rack CRUD ────────────────────────────────────────────────────────────────

exports.getRacksByWarehouse = async (req, res) => {
    try {
        const racks = await WarehouseRack.findAll({
            where: { warehouse_id: req.params.warehouse_id, status: 'Active' },
            order: [['rack_code', 'ASC']]
        });
        res.json(racks);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching racks', error: error.message });
    }
};

exports.createRack = async (req, res) => {
    try {
        const { warehouse_id, rack_code, rack_name } = req.body;
        
        // Validate rack code format
        if (!validateRackCode(rack_code)) {
            return res.status(400).json({ 
                message: 'Invalid rack code format. Use numeric (1-999) or alphanumeric (1A-9Z) format.' 
            });
        }
        
        const normalizedCode = normalizeRackCode(rack_code);
        const rack = await WarehouseRack.create({ 
            warehouse_id, 
            rack_code: normalizedCode, 
            rack_name, 
            created_by: req.user?.id 
        });
        res.status(201).json(rack);
    } catch (error) {
        res.status(500).json({ message: 'Error creating rack', error: error.message });
    }
};

exports.updateRack = async (req, res) => {
    try {
        const { rack_code, rack_name, status } = req.body;
        
        // Validate rack code format if provided
        if (rack_code && !validateRackCode(rack_code)) {
            return res.status(400).json({ 
                message: 'Invalid rack code format. Use numeric (1-999) or alphanumeric (1A-9Z) format.' 
            });
        }
        
        const normalizedCode = rack_code ? normalizeRackCode(rack_code) : undefined;
        const updateData = { 
            rack_name, 
            status, 
            updated_by: req.user?.id 
        };
        if (normalizedCode) updateData.rack_code = normalizedCode;
        
        await WarehouseRack.update(updateData, { where: { id: req.params.id } });
        res.json({ message: 'Rack updated' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating rack', error: error.message });
    }
};

exports.deleteRack = async (req, res) => {
    try {
        await WarehouseRack.update({ status: 'Inactive' }, { where: { id: req.params.id } });
        res.json({ message: 'Rack deactivated' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting rack', error: error.message });
    }
};

// ─── Warehouse Stock View ─────────────────────────────────────────────────────

// GET /api/warehouses/:warehouse_id/stock?rack_id=&imei=&batch_id=&serial_number=
exports.getWarehouseStock = async (req, res) => {
    try {
        const { warehouse_id } = req.params;
        const { rack_id, imei, batch_id, serial_number } = req.query;

        const where = { warehouse_id };
        if (rack_id) where.rack_id = rack_id;

        // Build ProductItem filter
        const productItemWhere = {};
        if (imei) productItemWhere.imei = { [sequelize.Sequelize.Op.like]: `%${imei}%` };
        if (batch_id) productItemWhere.batch_id = { [sequelize.Sequelize.Op.like]: `%${batch_id}%` };
        if (serial_number) productItemWhere.serial_number = { [sequelize.Sequelize.Op.like]: `%${serial_number}%` };

        const stock = await WarehouseStock.findAll({
            where,
            include: [
                {
                    model: ProductItem,
                    as: 'productItem',
                    where: Object.keys(productItemWhere).length > 0 ? productItemWhere : undefined,
                    include: [{ model: ProductMaster }]
                },
                { model: WarehouseRack, as: 'rack' }
            ],
            order: [['id', 'ASC']]
        });

        res.json(stock);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching warehouse stock', error: error.message });
    }
};

// GET /api/warehouses/stock/summary — total stock across all warehouses per product
exports.getStockSummary = async (req, res) => {
    try {
        const [rows] = await sequelize.query(`
            SELECT
                pm.id AS product_id,
                pm.product_name,
                pm.sku,
                w.id AS warehouse_id,
                w.name AS warehouse_name,
                wr.id AS rack_id,
                wr.rack_name,
                SUM(ws.available_quantity) AS available_quantity
            FROM warehouse_stock ws
            JOIN product_items pi ON pi.id = ws.product_item_id
            JOIN product_master pm ON pm.id = pi.product_id
            JOIN warehouses w ON w.id = ws.warehouse_id
            LEFT JOIN warehouse_racks wr ON wr.id = ws.rack_id
            GROUP BY pm.id, w.id, wr.id
            ORDER BY pm.product_name, w.name
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching stock summary', error: error.message });
    }
};
