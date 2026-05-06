const { StockTransfer, StockTransferItem, StockTransferApproval, ProductItem, WarehouseStock, Warehouse, WarehouseRack, User, sequelize } = require('../models');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');

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

// Bulk Excel Upload: Stock Transfers
exports.uploadTransferExcel = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Excel file is required' });
        }

        const { transfer_date, transfer_by, remarks, require_approval } = req.body;
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: 'No sheets found in Excel file' });
        }

        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) {
            await t.rollback();
            return res.status(400).json({ message: 'Could not read Excel sheet' });
        }

        const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

        if (!rows || rows.length === 0) {
            await t.rollback();
            return res.status(400).json({ message: 'No data rows found in Excel. Please ensure the file has data below the header row.' });
        }

        const approvalStatus = require_approval === 'true' || require_approval === true ? 'PENDING' : 'APPROVED';
        const stats = { created: 0, skipped: 0, failed: 0, errors: [] };

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            try {
                const keys = normalizeKeys(r);
                const barcode = String(keys.barcode || '').trim();
                const imei = String(keys.imei || '').trim();
                const serialNumber = String(keys.serialnumber || keys.serial || keys.serialno || '').trim();
                const batch = String(keys.batch || keys.batchid || keys.lotnumber || keys.lot || '').trim();
                const qty = parseFloat(keys.quantity || keys.qty || 0);
                
                const fromWarehouseCode = String(keys.fromwarehousecode || keys.fromwarehouse || keys.sourcewarehouse || '').trim();
                const fromRackCode = String(keys.fromrackcode || keys.fromrack || keys.sourcerack || '').trim();
                const toWarehouseCode = String(keys.towarehousecode || keys.towarehouse || keys.destinationwarehouse || keys.destwarehouse || '').trim();
                const toRackCode = String(keys.torackcode || keys.torack || keys.destinationrack || keys.destrack || '').trim();
                const toLocation = String(keys.tolocationmanual || keys.tolocation || keys.destination || '').trim();

                // Validation
                if (!barcode && !imei && !serialNumber) {
                    stats.failed++;
                    stats.errors.push(`Row ${i + 2}: Missing identifier (Barcode, IMEI, or Serial Number)`);
                    continue;
                }

                if (qty <= 0) {
                    stats.failed++;
                    stats.errors.push(`Row ${i + 2}: Invalid quantity (${qty})`);
                    continue;
                }

                if (!fromWarehouseCode && !toWarehouseCode && !toLocation) {
                    stats.failed++;
                    stats.errors.push(`Row ${i + 2}: Must specify either From/To Warehouse or To Location`);
                    continue;
                }

                // Find product item by barcode, IMEI, or serial
                let productItem = null;
                const whereConditions = [];
                if (barcode) whereConditions.push({ barcode });
                if (imei) whereConditions.push({ imei });
                if (serialNumber) whereConditions.push({ serial_number: serialNumber });

                if (whereConditions.length > 0) {
                    productItem = await ProductItem.findOne({
                        where: { [sequelize.Sequelize.Op.or]: whereConditions },
                        transaction: t
                    });
                }

                if (!productItem) {
                    stats.failed++;
                    stats.errors.push(`Row ${i + 2}: Item not found (Barcode: ${barcode || 'N/A'}, IMEI: ${imei || 'N/A'}, Serial: ${serialNumber || 'N/A'})`);
                    continue;
                }

                // Resolve warehouse and rack IDs
                let fromWarehouseId = null, fromRackId = null, toWarehouseId = null, toRackId = null;

                if (fromWarehouseCode) {
                    const fromWh = await Warehouse.findOne({ where: { code: fromWarehouseCode }, transaction: t });
                    if (!fromWh) {
                        stats.failed++;
                        stats.errors.push(`Row ${i + 2}: From Warehouse '${fromWarehouseCode}' not found`);
                        continue;
                    }
                    fromWarehouseId = fromWh.id;
                }

                if (fromRackCode && fromWarehouseId) {
                    const fromRack = await WarehouseRack.findOne({ 
                        where: { warehouse_id: fromWarehouseId, rack_code: fromRackCode }, 
                        transaction: t 
                    });
                    if (!fromRack) {
                        stats.failed++;
                        stats.errors.push(`Row ${i + 2}: From Rack '${fromRackCode}' not found in warehouse '${fromWarehouseCode}'`);
                        continue;
                    }
                    fromRackId = fromRack.id;
                }

                if (toWarehouseCode) {
                    const toWh = await Warehouse.findOne({ where: { code: toWarehouseCode }, transaction: t });
                    if (!toWh) {
                        stats.failed++;
                        stats.errors.push(`Row ${i + 2}: To Warehouse '${toWarehouseCode}' not found`);
                        continue;
                    }
                    toWarehouseId = toWh.id;
                }

                if (toRackCode && toWarehouseId) {
                    const toRack = await WarehouseRack.findOne({ 
                        where: { warehouse_id: toWarehouseId, rack_code: toRackCode }, 
                        transaction: t 
                    });
                    if (!toRack) {
                        stats.failed++;
                        stats.errors.push(`Row ${i + 2}: To Rack '${toRackCode}' not found in warehouse '${toWarehouseCode}'`);
                        continue;
                    }
                    toRackId = toRack.id;
                }

                // Validate and deduct from source
                if (fromWarehouseId) {
                    const wsWhere = { warehouse_id: fromWarehouseId, product_item_id: productItem.id, rack_id: fromRackId || null };
                    const ws = await WarehouseStock.findOne({ where: wsWhere, transaction: t });
                    if (!ws || parseFloat(ws.available_quantity) < qty) {
                        stats.failed++;
                        stats.errors.push(`Row ${i + 2}: Insufficient stock in source warehouse. Available: ${ws?.available_quantity || 0}, Required: ${qty}`);
                        continue;
                    }
                    ws.available_quantity = parseFloat(ws.available_quantity) - qty;
                    await ws.save({ transaction: t });

                    // Add to destination warehouse
                    if (toWarehouseId) {
                        const destWhere = { warehouse_id: toWarehouseId, product_item_id: productItem.id, rack_id: toRackId || null };
                        const [destWs] = await WarehouseStock.findOrCreate({
                            where: destWhere,
                            defaults: { ...destWhere, available_quantity: 0 },
                            transaction: t
                        });
                        destWs.available_quantity = parseFloat(destWs.available_quantity) + qty;
                        await destWs.save({ transaction: t });
                    }
                } else {
                    // Global stock validation
                    if (parseFloat(productItem.available_quantity) < qty) {
                        stats.failed++;
                        stats.errors.push(`Row ${i + 2}: Insufficient global stock. Available: ${productItem.available_quantity}, Required: ${qty}`);
                        continue;
                    }
                }

                // Update product item location
                const resolvedToLocation = toLocation || (toWarehouseId ? `WH-${toWarehouseId}` : null);
                if (resolvedToLocation) {
                    await productItem.update({ stock_location: resolvedToLocation }, { transaction: t });
                }

                // Create transfer record
                await StockTransfer.create({
                    transfer_date: transfer_date || new Date(),
                    product_item_id: productItem.id,
                    quantity: qty,
                    location_mode: fromWarehouseId || toWarehouseId ? 'warehouse' : 'manual',
                    from_warehouse_id: fromWarehouseId,
                    from_rack_id: fromRackId,
                    from_location: null,
                    to_warehouse_id: toWarehouseId,
                    to_rack_id: toRackId,
                    to_location: resolvedToLocation || toLocation,
                    batch_id: batch || null,
                    imei: imei || null,
                    serial_number: serialNumber || null,
                    transfer_by: transfer_by || 'Bulk Upload',
                    remarks: remarks || 'Bulk Transfer',
                    approval_status: approvalStatus,
                    approved_by: approvalStatus === 'APPROVED' ? req.user?.id : null
                }, { transaction: t });

                stats.created++;
            } catch (rowError) {
                stats.failed++;
                stats.errors.push(`Row ${i + 2}: ${rowError.message}`);
            }
        }

        await t.commit();
        res.status(201).json({ 
            message: 'Transfer Excel processed', 
            stats: {
                total: rows.length,
                created: stats.created,
                failed: stats.failed,
                errors: stats.errors
            }
        });
    } catch (error) {
        await t.rollback();
        console.error('Upload Transfer Excel Error:', error);
        res.status(500).json({ message: 'Failed to process transfer Excel', error: error.message });
    }
};

// Download Transfer Sample Excel
exports.downloadTransferSample = async (req, res) => {
    try {
        const warehouses = await Warehouse.findAll({ attributes: ['id', 'code', 'name'] });
        const racks = await WarehouseRack.findAll({ 
            attributes: ['id', 'rack_code', 'rack_name', 'warehouse_id']
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Stock Transfers');
        const refSheet = workbook.addWorksheet('RefData');

        // Headers with styling
        worksheet.columns = [
            { header: 'Barcode', key: 'barcode', width: 20 },
            { header: 'IMEI', key: 'imei', width: 20 },
            { header: 'Serial Number', key: 'serial_number', width: 20 },
            { header: 'Batch/LOT Number', key: 'batch', width: 20 },
            { header: 'Quantity', key: 'quantity', width: 12 },
            { header: 'From Warehouse Code', key: 'from_warehouse', width: 20 },
            { header: 'From Rack Code', key: 'from_rack', width: 15 },
            { header: 'To Warehouse Code', key: 'to_warehouse', width: 20 },
            { header: 'To Rack Code', key: 'to_rack', width: 15 },
            { header: 'To Location (Manual)', key: 'to_location', width: 25 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2563EB' }
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(1).height = 25;

        // Add sample data row
        worksheet.addRow({
            barcode: 'ITEM-001',
            imei: '123456789012345',
            serial_number: 'SN-12345',
            batch: 'BATCH-001',
            quantity: 1,
            from_warehouse: warehouses[0]?.code || 'WH01',
            from_rack: racks[0]?.rack_code || 'R1',
            to_warehouse: warehouses[1]?.code || warehouses[0]?.code || 'WH02',
            to_rack: racks[1]?.rack_code || 'R2',
            to_location: 'Floor 2, Section A'
        });

        // Fill Reference Data
        refSheet.getCell('A1').value = 'WarehouseCodes';
        refSheet.getCell('B1').value = 'RackCodes';
        refSheet.getRow(1).font = { bold: true };

        warehouses.forEach((w, idx) => {
            refSheet.getCell(`A${idx + 2}`).value = w.code;
        });

        racks.forEach((r, idx) => {
            refSheet.getCell(`B${idx + 2}`).value = r.rack_code;
        });

        const whCount = warehouses.length || 1;
        const rackCount = racks.length || 1;

        // Add Data Validation (Dropdowns) for 500 rows
        for (let i = 2; i <= 500; i++) {
            // From Warehouse Dropdown (Column F)
            worksheet.getCell(`F${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`RefData!$A$2:$A$${whCount + 1}`]
            };

            // From Rack Dropdown (Column G)
            worksheet.getCell(`G${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`RefData!$B$2:$B$${rackCount + 1}`]
            };

            // To Warehouse Dropdown (Column H)
            worksheet.getCell(`H${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`RefData!$A$2:$A$${whCount + 1}`]
            };

            // To Rack Dropdown (Column I)
            worksheet.getCell(`I${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`RefData!$B$2:$B$${rackCount + 1}`]
            };
        }

        // Hide reference sheet
        refSheet.state = 'hidden';

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Stock_Transfer_Template.xlsx"');

        // Write to response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Download Transfer Sample Error:', error);
        res.status(500).json({ message: 'Failed to download sample', error: error.message });
    }
};

function normalizeKeys(row) {
    return Object.keys(row).reduce((acc, k) => {
        acc[normalizeHeader(k)] = row[k];
        return acc;
    }, {});
}

function normalizeHeader(h) {
    return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}
