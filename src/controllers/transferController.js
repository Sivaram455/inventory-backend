const { StockTransfer, StockTransferItem, StockTransferApproval, ProductItem, WarehouseStock, Warehouse, WarehouseRack, User, sequelize } = require('../models');

exports.getAllTransfers = async (req, res) => {
    try {
        const transfers = await StockTransfer.findAll({
            include: [
                { model: Warehouse, as: 'fromWarehouse' },
                { model: Warehouse, as: 'toWarehouse' },
                { model: WarehouseRack, as: 'fromRack' },
                { model: WarehouseRack, as: 'toRack' },
                { model: ProductItem },
                { model: StockTransferItem, as: 'items' },
                { model: User, as: 'approvedByUser', attributes: ['id', 'name', 'email'] }
            ],
            order: [['transfer_date', 'DESC'], ['created_at', 'DESC']]
        });
        res.json(transfers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching transfers', error: error.message });
    }
};

// GET inward stock available for transfer selection (with optional IMEI filter)
exports.getAvailableInwardStock = async (req, res) => {
    try {
        const { warehouse_id, rack_id, imei } = req.query;
        const { Op } = sequelize.Sequelize;

        const itemWhere = { available_quantity: { [Op.gt]: 0 } };
        if (imei) itemWhere.imei = imei;

        const wsWhere = {};
        if (warehouse_id) wsWhere.warehouse_id = warehouse_id;
        if (rack_id) wsWhere.rack_id = rack_id;

        let stock;
        if (warehouse_id) {
            // Return warehouse-specific stock
            stock = await WarehouseStock.findAll({
                where: { ...wsWhere, available_quantity: { [Op.gt]: 0 } },
                include: [{
                    model: ProductItem,
                    as: 'productItem',
                    where: imei ? { imei } : undefined,
                    required: true,
                    include: [{ model: require('../models').ProductMaster }]
                }]
            });
        } else {
            stock = await ProductItem.findAll({
                where: itemWhere,
                include: [{ model: require('../models').ProductMaster }]
            });
        }

        res.json(stock);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching available stock', error: error.message });
    }
};

exports.createTransfer = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const {
            transfer_date, product_item_id, quantity,
            location_mode,
            from_warehouse_id, from_rack_id, from_location,
            to_warehouse_id, to_rack_id, to_location,
            batch_id, imei, serial_number, transfer_by, remarks,
            items, // Array of items with IMEI/Serial for multi-entry support
            require_approval
        } = req.body;

        const qty = parseFloat(quantity) || 1;

        // Validate source stock
        const productItem = await ProductItem.findByPk(product_item_id, { transaction: t });
        if (!productItem) throw new Error('Product item not found');

        // If warehouse selected, validate warehouse-level stock
        if (from_warehouse_id) {
            const wsWhere = { warehouse_id: from_warehouse_id, product_item_id, rack_id: from_rack_id || null };
            const ws = await WarehouseStock.findOne({ where: wsWhere, transaction: t });
            if (!ws || parseFloat(ws.available_quantity) < qty) {
                throw new Error(`Insufficient stock in source warehouse. Available: ${ws?.available_quantity || 0}`);
            }
            // Deduct from source warehouse stock
            ws.available_quantity = parseFloat(ws.available_quantity) - qty;
            await ws.save({ transaction: t });

            // Add to destination warehouse stock
            if (to_warehouse_id) {
                const destWhere = { warehouse_id: to_warehouse_id, product_item_id, rack_id: to_rack_id || null };
                const [destWs] = await WarehouseStock.findOrCreate({
                    where: destWhere,
                    defaults: { ...destWhere, available_quantity: 0 },
                    transaction: t
                });
                destWs.available_quantity = parseFloat(destWs.available_quantity) + qty;
                await destWs.save({ transaction: t });
            }
        } else {
            // No warehouse: validate global stock
            if (parseFloat(productItem.available_quantity) < qty) {
                throw new Error(`Insufficient stock. Available: ${productItem.available_quantity}`);
            }
        }

        // Update ProductItem location (to_location or derived from to_warehouse)
        const resolvedToLocation = to_location || (to_warehouse_id ? `WH-${to_warehouse_id}` : null);
        if (resolvedToLocation) {
            await productItem.update({ stock_location: resolvedToLocation }, { transaction: t });
        }

        // Determine approval status
        const approvalStatus = require_approval ? 'PENDING' : 'APPROVED';

        const transfer = await StockTransfer.create({
            transfer_date,
            product_item_id,
            quantity: qty,
            location_mode: location_mode || 'manual',
            from_warehouse_id: from_warehouse_id || null,
            from_rack_id: from_rack_id || null,
            from_location: from_location || null,
            to_warehouse_id: to_warehouse_id || null,
            to_rack_id: to_rack_id || null,
            to_location: resolvedToLocation || to_location,
            batch_id: batch_id || null,
            imei: imei || null,
            serial_number: serial_number || null,
            transfer_by,
            remarks,
            approval_status: approvalStatus,
            approved_by: require_approval ? null : req.user?.id
        }, { transaction: t });

        // Create transfer items if multi-IMEI/Serial provided
        if (items && Array.isArray(items) && items.length > 0) {
            for (const item of items) {
                await StockTransferItem.create({
                    transfer_id: transfer.id,
                    product_item_id: item.product_item_id || product_item_id,
                    imei: item.imei || null,
                    serial_number: item.serial_number || null,
                    batch_id: item.batch_id || batch_id || null,
                    quantity: item.quantity || 1
                }, { transaction: t });
            }
        }

        await t.commit();
        res.status(201).json(transfer);
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: 'Error creating transfer', error: error.message });
    }
};


// Approve or Reject Transfer
exports.approveTransfer = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { id } = req.params;
        const { approval_status, remarks } = req.body; // 'APPROVED' or 'REJECTED'
        const approved_by = req.user?.id;

        if (!approved_by) {
            throw new Error('User authentication required');
        }

        if (!['APPROVED', 'REJECTED'].includes(approval_status)) {
            throw new Error('Invalid approval status');
        }

        const transfer = await StockTransfer.findByPk(id, { transaction: t });
        if (!transfer) {
            throw new Error('Transfer not found');
        }

        if (transfer.approval_status !== 'PENDING') {
            throw new Error('Transfer already processed');
        }

        // Update transfer status
        transfer.approval_status = approval_status;
        transfer.approved_by = approved_by;
        await transfer.save({ transaction: t });

        // Create approval record
        await StockTransferApproval.create({
            transfer_id: id,
            approved_by,
            approval_status,
            approval_date: new Date(),
            remarks: remarks || null
        }, { transaction: t });

        await t.commit();
        res.json({ message: `Transfer ${approval_status.toLowerCase()} successfully`, transfer });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: 'Error processing approval', error: error.message });
    }
};

// Get Pending Transfers (for approval)
exports.getPendingTransfers = async (req, res) => {
    try {
        const transfers = await StockTransfer.findAll({
            where: { approval_status: 'PENDING' },
            include: [
                { model: Warehouse, as: 'fromWarehouse' },
                { model: Warehouse, as: 'toWarehouse' },
                { model: WarehouseRack, as: 'fromRack' },
                { model: WarehouseRack, as: 'toRack' },
                { model: ProductItem, include: [{ model: require('./ProductMaster') }] },
                { model: StockTransferItem, as: 'items' }
            ],
            order: [['created_at', 'DESC']]
        });
        res.json(transfers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pending transfers', error: error.message });
    }
};
