const { sequelize, InwardRegister, InwardItem, OutwardRegister, OutwardItem, ProductItem, ProductMaster, Unit, VehicleUsage, Warehouse, WarehouseRack, WarehouseStock } = require('../models');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// Scan Item by Barcode or IMEI
exports.getItemByBarcode = async (req, res) => {
    try {
        const { code } = req.query; // Expecting barcode or IMEI
        if (!code) {
            return res.status(400).json({ message: 'Barcode/IMEI is required' });
        }

        const item = await ProductItem.findOne({
            where: {
                [sequelize.Sequelize.Op.or]: [
                    { barcode: code },
                    { imei: code }
                ]
            },
            include: [{ model: ProductMaster }]
        });

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        res.json(item);
    } catch (error) {
        res.status(500).json({ message: 'Error scanning item', error: error.message });
    }
};

exports.getAllItems = async (req, res) => {
    try {
        const where = {};
        if (req.query.status) where.status = req.query.status;
        const items = await ProductItem.findAll({
            where,
            include: [
                { model: ProductMaster, include: ['category'] },
                {
                    model: WarehouseStock,
                    as: 'warehouseStocks',
                    include: [
                        { model: Warehouse, as: 'warehouse' },
                        { model: WarehouseRack, as: 'rack' }
                    ]
                }
            ]
        });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching inventory', error: error.message });
    }
};

// Inward Entry (Purchase)
exports.createInward = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { inward_date, purchase_type, received_by, remarks, warehouse_id, rack_id, items } = req.body;

        if (!inward_date) return res.status(400).json({ message: 'Inward date is required' });
        if (!purchase_type) return res.status(400).json({ message: 'Purchase type is required' });
        if (!received_by?.trim()) return res.status(400).json({ message: 'Received by is required' });
        if (!items || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });
        for (const item of items) {
            if (!item.product_id) return res.status(400).json({ message: 'Product is required for all items' });
            if (!item.quantity_received || parseFloat(item.quantity_received) <= 0)
                return res.status(400).json({ message: 'Valid quantity is required for all items' });
            if (item.imei && !/^[A-Za-z0-9]{1,50}$/.test(String(item.imei).trim()))
                return res.status(400).json({ message: `Invalid IMEI "${item.imei}" — must be alphanumeric (max 50 characters)` });
            if (item.serial_number && item.serial_number.trim().length === 0)
                return res.status(400).json({ message: 'Serial number cannot be empty if provided' });
        }

        const inward = await InwardRegister.create({
            inward_date,
            purchase_type,
            received_by,
            remarks,
            warehouse_id: warehouse_id || null,
            rack_id: rack_id || null,
        }, { transaction: t });

        for (const item of items) {
            // 1. Create or Update ProductItem (Inventory Control)
            // Logic: If barcode/imei exists, update quantity? Or is each barcode unique?
            // Schema says barcode/imei UNIQUE. So if it exists, it might be a re-entry or error. 
            // Assumption: If item exists, we add quantity. If not, create.

            let productItem = null;
            if (item.barcode || item.imei || item.serial_number) {
                productItem = await ProductItem.findOne({
                    where: {
                        [sequelize.Sequelize.Op.or]: [
                            ...(item.barcode ? [{ barcode: item.barcode }] : []),
                            ...(item.imei ? [{ imei: item.imei }] : []),
                            ...(item.serial_number ? [{ serial_number: item.serial_number }] : [])
                        ]
                    },
                    transaction: t
                });
            }

            if (productItem) {
                // Update existing item
                productItem.total_quantity = parseFloat(productItem.total_quantity) + parseFloat(item.quantity_received);
                productItem.available_quantity = parseFloat(productItem.available_quantity) + parseFloat(item.quantity_received);
                if (item.batch_id) productItem.batch_id = item.batch_id;
                if (item.lot_number) productItem.lot_number = item.lot_number;
                if (item.serial_number) productItem.serial_number = item.serial_number;
                await productItem.save({ transaction: t });
            } else {
                // Create new item
                productItem = await ProductItem.create({
                    product_id: item.product_id,
                    barcode: item.barcode || null,
                    imei: item.imei || null,
                    serial_number: item.serial_number || null,
                    batch_id: item.batch_id || null,
                    lot_number: item.lot_number || null,
                    total_quantity: item.quantity_received,
                    available_quantity: item.quantity_received,
                    stock_location: item.stock_location || 'DEFAULT',
                    status: 'IN_STOCK',
                }, { transaction: t });
            }

            // 2. Create InwardItem Record
            await InwardItem.create({
                inward_id: inward.id,
                product_item_id: productItem.id,
                quantity_received: item.quantity_received,
                unit_id: item.unit_id,
            }, { transaction: t });

            // 3. Update WarehouseStock if warehouse_id provided
            if (warehouse_id) {
                const wsWhere = { warehouse_id, product_item_id: productItem.id, rack_id: rack_id || null };
                const [ws] = await WarehouseStock.findOrCreate({
                    where: wsWhere,
                    defaults: { ...wsWhere, available_quantity: 0, created_by: req.user?.id },
                    transaction: t
                });
                ws.available_quantity = parseFloat(ws.available_quantity) + parseFloat(item.quantity_received);
                await ws.save({ transaction: t });
            }
        }

        await t.commit();
        res.status(201).json({ message: 'Inward entry successful', inwardId: inward.id });
    } catch (error) {
        await t.rollback();
        console.error('Inward Error:', error);
        res.status(500).json({ message: 'Inward entry failed', error: error.message });
    }
};

// Outward Entry (Sales/Consumption)
exports.createOutward = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { outward_date, vehicle_reg_no, vehicle_id, vin_no, sales_category, incharge_person, remarks, warehouse_id, rack_id, items } = req.body;

        if (!outward_date) return res.status(400).json({ message: 'Outward date is required' });
        if (!sales_category) return res.status(400).json({ message: 'Sales category is required' });
        if (!incharge_person?.trim()) return res.status(400).json({ message: 'Incharge person is required' });
        if (!items || items.length === 0) return res.status(400).json({ message: 'At least one item is required' });
        for (const item of items) {
            if (!item.product_item_id) return res.status(400).json({ message: 'Stock item is required for all entries' });
            if (!item.quantity_used || parseFloat(item.quantity_used) <= 0)
                return res.status(400).json({ message: 'Valid quantity is required for all items' });
        }

        const outward = await OutwardRegister.create({
            outward_date,
            vehicle_reg_no,
            vehicle_id: vehicle_id || null,
            vin_no,
            sales_category,
            incharge_person,
            remarks,
            warehouse_id: warehouse_id || null,
            rack_id: rack_id || null,
        }, { transaction: t });

        const createdItems = [];
        for (const item of items) {
            // Validate stock
            const productItem = await ProductItem.findByPk(item.product_item_id, { transaction: t });
            if (!productItem) {
                throw new Error(`Item with ID ${item.product_item_id} not found`);
            }

            if (parseFloat(productItem.available_quantity) < parseFloat(item.quantity_used)) {
                throw new Error(`Insufficient stock for item ${productItem.barcode || productItem.id}. Available: ${productItem.available_quantity}`);
            }

            // Deduct stock
            productItem.available_quantity = parseFloat(productItem.available_quantity) - parseFloat(item.quantity_used);
            if (productItem.available_quantity <= 0) {
                productItem.status = 'USED';
            }
            await productItem.save({ transaction: t });

            // Deduct from warehouse-specific stock if warehouse_id provided
            if (warehouse_id) {
                const wsWhere = { warehouse_id, product_item_id: productItem.id, rack_id: rack_id || null };
                const ws = await WarehouseStock.findOne({ where: wsWhere, transaction: t });
                if (ws && parseFloat(ws.available_quantity) >= parseFloat(item.quantity_used)) {
                    ws.available_quantity = parseFloat(ws.available_quantity) - parseFloat(item.quantity_used);
                    await ws.save({ transaction: t });
                } else if (!ws) {
                    // skip warehouse deduction
                } else {
                    ws.available_quantity = Math.max(0, parseFloat(productItem.available_quantity));
                    await ws.save({ transaction: t });
                }
            }

            // Create OutwardItem
            const oi = await OutwardItem.create({
                outward_id: outward.id,
                product_item_id: productItem.id,
                quantity_used: item.quantity_used,
                unit_id: item.unit_id,
            }, { transaction: t });
            createdItems.push(oi.id);
        }

        // Auto-log vehicle usage if vehicle_id is provided
        if (vehicle_id) {
            await VehicleUsage.create({
                vehicle_id: vehicle_id,
                usage_date: outward_date || new Date(),
                purpose: `Outward - ${sales_category}`,
                reference_type: 'Outward',
                reference_id: outward.id,
                driver_name: incharge_person || null,
                remarks: `Auto-logged from Outward #${outward.id}`,
                created_by: req.user?.id || null
            }, { transaction: t });
        }

        await t.commit();
        res.status(201).json({ 
            message: 'Outward entry successful', 
            outwardId: outward.id,
            itemIds: createdItems
        });
    } catch (error) {
        await t.rollback();
        console.error('Outward Error:', error);
        res.status(500).json({ message: 'Outward entry failed', error: error.message });
    }
};

// Helpers
function normalizeHeader(h) {
    return String(h || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function resolveUnitId(unitHint) {
    if (!unitHint) return null;
    const name = String(unitHint).trim();
    const unit = await Unit.findOne({
        where: {
            [sequelize.Sequelize.Op.or]: [
                { name },
                { base_unit: name }
            ]
        }
    });
    return unit ? unit.id : null;
}

// Bulk Excel Upload: Inward
exports.uploadInwardExcel = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Excel file is required' });
        }
        const { purchase_type, received_by, remarks, inward_date, warehouse_id, rack_id } = req.body;
        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) {
            return res.status(400).json({ message: 'No rows found in Excel' });
        }

        const inward = await InwardRegister.create({
            inward_date: inward_date || new Date(),
            purchase_type: purchase_type || 'PAID_PURCHASE',
            received_by: received_by || '',
            remarks: remarks || '',
            warehouse_id: warehouse_id || null,
            rack_id: rack_id || null,
        }, { transaction: t });

        for (const r of rows) {
            const keys = Object.keys(r).reduce((acc, k) => {
                acc[normalizeHeader(k)] = r[k];
                return acc;
            }, {});
            let productId = keys.productid || keys.product_id || keys.product || keys.selectproduct || null;
            const barcode = keys.barcode || '';
            const imei = keys.imei || '';
            const serialNumber = keys.serialnumber || keys.serial_number || keys.serialno || '';
            const batch = keys.batch || keys.batchid || keys.batch_id || '';
            const lotNumber = keys.lotnumber || keys.lotno || keys.lot_number || keys.lot || '';
            const qty = parseFloat(keys.quantity || keys.qty || keys.quantityreceived || 0) || 0;
            const location = keys.location || keys.stocklocation || 'DEFAULT';
            const unitHint = keys.unit || keys.unitname || '';
            const unitId = (await resolveUnitId(unitHint)) || null;
            const itemRackCode = keys.rack || keys.rackcode || keys.racknumber || '';

            if (qty <= 0) continue;

            // Parse Dropdown Format: "ID:123 - Name..."
            if (productId && typeof productId === 'string' && productId.startsWith('ID:')) {
                const match = productId.match(/^ID:(\d+)/);
                if (match) {
                    productId = match[1];
                }
            }

            // Resolve rack_id from rack code if provided
            let itemRackId = rack_id || null;
            if (itemRackCode && warehouse_id) {
                const rack = await WarehouseRack.findOne({
                    where: { warehouse_id, rack_code: itemRackCode },
                    transaction: t
                });
                if (rack) itemRackId = rack.id;
            }

            let productItem = null;
            if (barcode || imei || serialNumber) {
                productItem = await ProductItem.findOne({
                    where: {
                        [sequelize.Sequelize.Op.or]: [
                            ...(barcode ? [{ barcode }] : []),
                            ...(imei ? [{ imei }] : []),
                            ...(serialNumber ? [{ serial_number: serialNumber }] : [])
                        ]
                    },
                    transaction: t
                });
            }
            if (productItem) {
                productItem.total_quantity = parseFloat(productItem.total_quantity) + qty;
                productItem.available_quantity = parseFloat(productItem.available_quantity) + qty;
                if (batch) productItem.batch_id = batch;
                if (lotNumber) productItem.lot_number = lotNumber;
                if (serialNumber) productItem.serial_number = serialNumber;
                if (location) productItem.stock_location = location;
                await productItem.save({ transaction: t });
            } else {
                productItem = await ProductItem.create({
                    product_id: productId,
                    barcode: barcode || null,
                    imei: imei || null,
                    serial_number: serialNumber || null,
                    batch_id: batch || null,
                    lot_number: lotNumber || null,
                    total_quantity: qty,
                    available_quantity: qty,
                    stock_location: location || 'DEFAULT',
                    status: 'IN_STOCK',
                }, { transaction: t });
            }

            await InwardItem.create({
                inward_id: inward.id,
                product_item_id: productItem.id,
                quantity_received: qty,
                unit_id: unitId,
            }, { transaction: t });

            // Update WarehouseStock if warehouse_id provided
            if (warehouse_id) {
                const wsWhere = { warehouse_id, product_item_id: productItem.id, rack_id: itemRackId };
                const [ws] = await WarehouseStock.findOrCreate({
                    where: wsWhere,
                    defaults: { ...wsWhere, available_quantity: 0, created_by: req.user?.id },
                    transaction: t
                });
                ws.available_quantity = parseFloat(ws.available_quantity) + qty;
                await ws.save({ transaction: t });
            }
        }

        await t.commit();
        res.status(201).json({ message: 'Inward Excel processed', inwardId: inward.id, rows: rows.length });
    } catch (error) {
        await t.rollback();
        console.error('Upload Inward Excel Error:', error);
        res.status(500).json({ message: 'Failed to process inward Excel', error: error.message });
    }
};

// Bulk Excel Upload: Outward
exports.uploadOutwardExcel = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Excel file is required' });
        }

        const rows = parseExcel(req.file.buffer);
        if (!rows.length) {
            return res.status(400).json({ message: 'No rows found in Excel' });
        }

        const { outward_date, vehicle_reg_no, vehicle_id, vin_no, sales_category, incharge_person, remarks, warehouse_id, rack_id } = req.body;

        const outward = await OutwardRegister.create({
            outward_date: outward_date || new Date(),
            vehicle_reg_no: vehicle_reg_no || '',
            vehicle_id: vehicle_id || null,
            vin_no: vin_no || '',
            sales_category: sales_category || 'DIRECT_SALES',
            incharge_person: incharge_person || '',
            remarks: remarks || 'Bulk Upload',
            warehouse_id: warehouse_id || null,
            rack_id: rack_id || null,
            created_by: req.user?.id || null,
        }, { transaction: t });

        for (const r of rows) {
            const keys = normalizeKeys(r);
            let productItemId = keys.productitemid || keys.itemid || keys.stockitem || keys.stockitemselectfromdropdown || null;
            const barcode = keys.barcode || '';
            const imei = keys.imei || '';
            const serialNumber = keys.serialnumber || keys.serial_number || keys.serialno || '';
            const batch = keys.batch || keys.batchid || keys.batch_id || '';
            const lotNumber = keys.lotnumber || keys.lotno || keys.lot_number || keys.lot || '';
            const qtyUsed = parseFloat(keys.quantity || keys.qty || keys.quantityused || 0);
            const unitHint = keys.unit || keys.unitname || '';
            const itemRackCode = keys.rack || keys.rackcode || keys.racknumber || '';

            if (qtyUsed <= 0) continue;

            // Parse Dropdown Format: "ID:123 - Name..."
            if (productItemId && typeof productItemId === 'string' && productItemId.startsWith('ID:')) {
                const match = productItemId.match(/^ID:(\d+)/);
                if (match) {
                    productItemId = match[1];
                }
            }

            let productItem = null;
            // Find by ID or Barcode/IMEI/Serial
            if (productItemId) {
                productItem = await ProductItem.findByPk(productItemId, { transaction: t });
            } else if (barcode || imei || serialNumber) {
                productItem = await ProductItem.findOne({
                    where: {
                        [sequelize.Sequelize.Op.or]: [
                            ...(barcode ? [{ barcode }] : []),
                            ...(imei ? [{ imei }] : []),
                            ...(serialNumber ? [{ serial_number: serialNumber }] : [])
                        ]
                    },
                    transaction: t
                });
            }

            if (!productItem) {
                throw new Error(`Item not found for row: ${JSON.stringify(r)}`);
            }

            if (parseFloat(productItem.available_quantity) < qtyUsed) {
                throw new Error(`Insufficient stock for item ${productItem.barcode || productItem.imei || productItem.serial_number || productItem.id}. Available: ${productItem.available_quantity}, Requested: ${qtyUsed}`);
            }

            // Resolve rack_id from rack code if provided
            let itemRackId = rack_id || null;
            if (itemRackCode && warehouse_id) {
                const rack = await WarehouseRack.findOne({
                    where: { warehouse_id, rack_code: itemRackCode },
                    transaction: t
                });
                if (rack) itemRackId = rack.id;
            }

            // Deduct Stock
            productItem.available_quantity = parseFloat(productItem.available_quantity) - qtyUsed;
            if (productItem.available_quantity <= 0 && productItem.status !== 'USED') {
                productItem.status = 'USED';
            }
            await productItem.save({ transaction: t });

            // Deduct from warehouse-specific stock if warehouse_id provided
            if (warehouse_id) {
                const wsWhere = { warehouse_id, product_item_id: productItem.id, rack_id: itemRackId };
                const ws = await WarehouseStock.findOne({ where: wsWhere, transaction: t });
                if (ws && parseFloat(ws.available_quantity) >= qtyUsed) {
                    ws.available_quantity = parseFloat(ws.available_quantity) - qtyUsed;
                    await ws.save({ transaction: t });
                } else if (!ws) {
                    // No warehouse stock record — item was inwarded without warehouse, skip warehouse deduction
                } else {
                    // Warehouse stock exists but insufficient — sync it from global then deduct
                    ws.available_quantity = Math.max(0, parseFloat(productItem.available_quantity));
                    await ws.save({ transaction: t });
                }
            }

            const unitId = (await resolveUnitId(unitHint)) || productItem.unit_id || 1;

            await OutwardItem.create({
                outward_id: outward.id,
                product_item_id: productItem.id,
                quantity_used: qtyUsed,
                unit_id: unitId,
            }, { transaction: t });
        }

        // Auto-log vehicle usage if vehicle_id is provided
        if (vehicle_id) {
            await VehicleUsage.create({
                vehicle_id: vehicle_id,
                usage_date: outward_date || new Date(),
                purpose: `Outward Bulk - ${sales_category}`,
                reference_type: 'Outward',
                reference_id: outward.id,
                driver_name: incharge_person || null,
                remarks: `Auto-logged from Bulk Outward #${outward.id}`,
                created_by: req.user?.id || null
            }, { transaction: t });
        }

        await t.commit();
        res.status(201).json({ message: 'Outward Excel processed', outwardId: outward.id, rows: rows.length });
    } catch (error) {
        await t.rollback();
        console.error('Upload Outward Excel Error:', error);
        res.status(500).json({ message: 'Failed to process outward Excel', error: error.message });
    }
};

// Helper for parsing Excel
function parseExcel(buffer) {
    const wb = xlsx.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return xlsx.utils.sheet_to_json(ws, { defval: '' });
}

function normalizeKeys(row) {
    return Object.keys(row).reduce((acc, k) => {
        acc[normalizeHeader(k)] = row[k];
        return acc;
    }, {});
}

exports.downloadInwardSample = async (req, res) => {
    try {
        // Fetch Master Data
        const products = await ProductMaster.findAll();
        const units = await Unit.findAll();
        const warehouses = await Warehouse.findAll();
        const racks = await WarehouseRack.findAll({ include: [{ model: Warehouse, as: 'warehouse' }] });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inward Entry');
        const refSheet = workbook.addWorksheet('RefData');
        refSheet.state = 'hidden';

        // Headers
        worksheet.columns = [
            { header: 'Select Product', key: 'product', width: 40 },
            { header: 'Barcode', key: 'barcode', width: 20 },
            { header: 'IMEI', key: 'imei', width: 20 },
            { header: 'Serial Number', key: 'serial_number', width: 20 },
            { header: 'Quantity', key: 'quantity', width: 15 },
            { header: 'Unit', key: 'unit', width: 15 },
            { header: 'Batch Number', key: 'batch', width: 20 },
            { header: 'LOT Number', key: 'lot_number', width: 20 },
            { header: 'Rack Code', key: 'rack', width: 15 },
            { header: 'Stock Location', key: 'location', width: 20 }
        ];

        // Fill Reference Data
        refSheet.getCell('A1').value = 'Products';
        refSheet.getCell('B1').value = 'Units';
        refSheet.getCell('C1').value = 'RackCodes';

        products.forEach((p, idx) => {
            const label = `ID:${p.id} - ${p.product_name} (${p.sku || 'N/A'})`;
            refSheet.getCell(`A${idx + 2}`).value = label;
        });

        units.forEach((u, idx) => {
            refSheet.getCell(`B${idx + 2}`).value = u.name;
        });

        racks.forEach((r, idx) => {
            refSheet.getCell(`C${idx + 2}`).value = r.rack_code;
        });

        const prodCount = products.length || 1;
        const unitCount = units.length || 1;
        const rackCount = racks.length || 1;

        // Data Validation
        for (let i = 2; i <= 500; i++) {
            // Product Dropdown
            worksheet.getCell(`A${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`=RefData!$A$2:$A$${prodCount + 1}`]
            };

            // Unit Dropdown
            worksheet.getCell(`F${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`=RefData!$B$2:$B$${unitCount + 1}`]
            };

            // Rack Dropdown
            worksheet.getCell(`H${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`=RefData!$C$2:$C$${rackCount + 1}`]
            };
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Inward_Sample.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download Inward Sample Error:', error);
        res.status(500).json({ message: 'Failed to download sample', error: error.message });
    }
};

exports.downloadOutwardSample = async (req, res) => {
    try {
        // We need real data to make the dropdowns
        const items = await ProductItem.findAll({
            where: {
                status: 'IN_STOCK',
                available_quantity: { [sequelize.Sequelize.Op.gt]: 0 }
            },
            include: [{ model: ProductMaster }]
        });
        const units = await Unit.findAll();
        const racks = await WarehouseRack.findAll({ include: [{ model: Warehouse, as: 'warehouse' }] });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Outward Entry');
        const refSheet = workbook.addWorksheet('RefData');
        refSheet.state = 'hidden';

        // Headers
        worksheet.columns = [
            { header: 'Stock Item (Select from Dropdown)', key: 'stock_item', width: 50 },
            { header: 'Barcode', key: 'barcode', width: 20 },
            { header: 'IMEI', key: 'imei', width: 20 },
            { header: 'Serial Number', key: 'serial_number', width: 20 },
            { header: 'Batch Number', key: 'batch', width: 20 },
            { header: 'LOT Number', key: 'lot_number', width: 20 },
            { header: 'Quantity Used', key: 'quantity', width: 15 },
            { header: 'Unit', key: 'unit', width: 15 },
            { header: 'Rack Code', key: 'rack', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 30 }
        ];

        // Fill Reference Data
        refSheet.getCell('A1').value = 'StockItems';
        refSheet.getCell('B1').value = 'Units';
        refSheet.getCell('C1').value = 'RackCodes';

        items.forEach((item, idx) => {
            // Format: ID:123 - Name (Barcode/IMEI) [Qty: X]
            const identifier = item.barcode || item.imei || item.serial_number || `Item-${item.id}`;
            const label = `ID:${item.id} - ${item.ProductMaster ? item.ProductMaster.product_name : 'Unknown'} (${identifier}) [Qty: ${parseFloat(item.available_quantity)}]`;
            refSheet.getCell(`A${idx + 2}`).value = label;
        });

        units.forEach((u, idx) => {
            refSheet.getCell(`B${idx + 2}`).value = u.name;
        });

        racks.forEach((r, idx) => {
            refSheet.getCell(`C${idx + 2}`).value = r.rack_code;
        });

        const stockCount = items.length || 1;
        const unitCount = units.length || 1;
        const rackCount = racks.length || 1;

        // Add Data Validation to first 500 rows
        for (let i = 2; i <= 500; i++) {
            // Stock Item Dropdown
            worksheet.getCell(`A${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`=RefData!$A$2:$A$${stockCount + 1}`]
            };

            // Unit Dropdown
            worksheet.getCell(`G${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`=RefData!$B$2:$B$${unitCount + 1}`]
            };

            // Rack Dropdown
            worksheet.getCell(`H${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`=RefData!$C$2:$C$${rackCount + 1}`]
            };
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="Outward_Stock_Sample.xlsx"');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download Outward Sample Error:', error);
        res.status(500).json({ message: 'Failed to download sample', error: error.message });
    }
};

exports.getInwardHistory = async (req, res) => {
    try {
        const { ProductCategory } = require('../models');
        const { warehouse_id } = req.query;

        const registerWhere = {};
        if (warehouse_id) registerWhere.warehouse_id = warehouse_id;

        const history = await InwardItem.findAll({
            include: [
                {
                    model: InwardRegister,
                    as: 'InwardRegister',
                    where: Object.keys(registerWhere).length ? registerWhere : undefined,
                    include: [
                        { model: Warehouse, as: 'warehouse' },
                        { model: WarehouseRack, as: 'rack' }
                    ]
                },
                {
                    model: ProductItem,
                    include: [{
                        model: ProductMaster,
                        include: [
                            { model: ProductCategory, as: 'category' },
                            { model: Unit, as: 'unit' }
                        ]
                    }]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        const flattened = history.map(item => ({
            id: item.id,
            created_at: item.InwardRegister?.inward_date || item.created_at,
            purchase_type: item.InwardRegister?.purchase_type,
            supplier_name: item.InwardRegister?.received_by,
            batch_number: item.ProductItem?.batch_id,
            quantity: item.quantity_received,
            warehouse: item.InwardRegister?.warehouse,
            rack: item.InwardRegister?.rack,
            ProductMaster: item.ProductItem?.ProductMaster,
            Category: item.ProductItem?.ProductMaster?.category?.category_name,
            UnitName: item.ProductItem?.ProductMaster?.unit?.name || '',
            remarks: item.InwardRegister?.remarks
        }));

        res.json(flattened);
    } catch (error) {
        console.error('Get Inward History Error:', error);
        res.status(500).json({ message: 'Failed to fetch inward history', error: error.message });
    }
};

exports.getOutwardHistory = async (req, res) => {
    try {
        const { VehicleType, ProductCategory } = require('../models');
        const { warehouse_id } = req.query;

        const registerWhere = {};
        if (warehouse_id) registerWhere.warehouse_id = warehouse_id;

        const history = await OutwardItem.findAll({
            include: [
                {
                    model: OutwardRegister,
                    where: Object.keys(registerWhere).length ? registerWhere : undefined,
                    include: [
                        { model: VehicleType, as: 'Vehicle' },
                        { model: Warehouse, as: 'warehouse' },
                        { model: WarehouseRack, as: 'rack' }
                    ]
                },
                {
                    model: ProductItem,
                    include: [{
                        model: ProductMaster,
                        include: [
                            { model: ProductCategory, as: 'category' },
                            { model: Unit, as: 'unit' }
                        ]
                    }]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        const flattened = history.map(item => ({
            id: item.id,
            outward_id: item.outward_id,
            created_at: item.OutwardRegister?.outward_date || item.created_at,
            sales_category: item.OutwardRegister?.sales_category,
            client_name: item.OutwardRegister?.incharge_person,
            quantity: item.quantity_used,
            warehouse: item.OutwardRegister?.warehouse,
            rack: item.OutwardRegister?.rack,
            ProductItem: item.ProductItem,
            Category: item.ProductItem?.ProductMaster?.category?.category_name,
            UnitName: item.ProductItem?.ProductMaster?.unit?.name || '',
            Vehicle: item.OutwardRegister?.Vehicle,
            vehicle_reg_no: item.OutwardRegister?.vehicle_reg_no,
            vin_no: item.OutwardRegister?.vin_no,
            challan_number: item.OutwardRegister?.remarks,
            remarks: item.OutwardRegister?.remarks
        }));

        res.json(flattened);
    } catch (error) {
        console.error('Get Outward History Error:', error);
        res.status(500).json({ message: 'Failed to fetch outward history', error: error.message });
    }
};

exports.exportInventoryExcel = async (req, res) => {
    try {
        const { type } = req.query; // summary, details, inward, outward
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Inventory Export');

        if (type === 'details') {
            const items = await ProductItem.findAll({
                include: [
                    { model: ProductMaster, include: ['category'] },
                    {
                        model: WarehouseStock,
                        as: 'warehouseStocks',
                        include: [
                            { model: Warehouse, as: 'warehouse' },
                            { model: WarehouseRack, as: 'rack' }
                        ]
                    }
                ]
            });
            sheet.columns = [
                { header: 'Roll ID', key: 'id', width: 10 },
                { header: 'Product Name', key: 'product', width: 30 },
                { header: 'Batch ID', key: 'batch', width: 15 },
                { header: 'Original Qty', key: 'original', width: 15 },
                { header: 'Remaining Qty', key: 'remaining', width: 15 },
                { header: 'Warehouse', key: 'warehouse_name', width: 20 },
                { header: 'Rack Code', key: 'rack_code', width: 15 },
                { header: 'Stock Location', key: 'location', width: 20 },
                { header: 'Barcode', key: 'barcode', width: 20 },
                { header: 'IMEI', key: 'imei', width: 20 },
                { header: 'Serial Number', key: 'serial', width: 20 },
                { header: 'Status', key: 'status', width: 15 }
            ];
            items.forEach(item => {
                const primaryStock = item.warehouseStocks && item.warehouseStocks.length > 0 ? item.warehouseStocks[0] : null;
                sheet.addRow({
                    id: item.id,
                    product: item.ProductMaster?.product_name || 'N/A',
                    batch: item.batch_id,
                    original: item.total_quantity,
                    remaining: item.available_quantity,
                    warehouse_name: primaryStock?.warehouse?.name || '',
                    rack_code: primaryStock?.rack?.rack_code || '',
                    location: item.stock_location,
                    barcode: item.barcode,
                    imei: item.imei,
                    serial: item.serial_number,
                    status: item.status
                });
            });
        } else if (type === 'summary') {
            const items = await ProductItem.findAll({
                include: [{ model: ProductMaster, include: ['category'] }]
            });
            // Group by Product
            const summary = {};
            items.forEach(item => {
                const pid = item.product_id;
                if (!summary[pid]) {
                    summary[pid] = {
                        code: item.ProductMaster?.sku || pid,
                        name: item.ProductMaster?.product_name || 'N/A',
                        category: item.ProductMaster?.category?.category_name || 'N/A',
                        stock: 0,
                        rolls: 0
                    };
                }
                summary[pid].stock += parseFloat(item.available_quantity || 0);
                if (item.status === 'IN_STOCK') summary[pid].rolls++;
            });

            sheet.columns = [
                { header: 'Code', key: 'code', width: 15 },
                { header: 'Product', key: 'name', width: 30 },
                { header: 'Category', key: 'category', width: 20 },
                { header: 'Total Stock', key: 'stock', width: 15 },
                { header: 'Active Rolls', key: 'rolls', width: 15 }
            ];
            Object.values(summary).forEach(row => sheet.addRow(row));
        } else if (type === 'inward') {
            const { ProductMaster, Unit, ProductCategory } = require('../models');
            const history = await InwardItem.findAll({
                include: [
                    { model: InwardRegister, as: 'InwardRegister' },
                    { model: ProductItem, include: [{ model: ProductMaster, include: [{ model: ProductCategory, as: 'category' }] }] }
                ]
            });
            sheet.columns = [
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Product', key: 'product', width: 30 },
                { header: 'Category', key: 'category', width: 20 },
                { header: 'Qty', key: 'qty', width: 10 },
                { header: 'Batch', key: 'batch', width: 15 },
                { header: 'Supplier', key: 'supplier', width: 20 }
            ];
            history.forEach(item => {
                sheet.addRow({
                    date: item.InwardRegister?.inward_date || item.created_at,
                    product: item.ProductItem?.ProductMaster?.product_name,
                    category: item.ProductItem?.ProductMaster?.category?.category_name,
                    qty: item.quantity_received,
                    batch: item.ProductItem?.batch_id,
                    supplier: item.InwardRegister?.received_by
                });
            });
        } else if (type === 'outward') {
            const { ProductMaster, ProductCategory, VehicleType } = require('../models');
            const history = await OutwardItem.findAll({
                include: [
                    { model: OutwardRegister, include: [{ model: VehicleType, as: 'Vehicle' }] },
                    { model: ProductItem, include: [{ model: ProductMaster, include: [{ model: ProductCategory, as: 'category' }] }] }
                ]
            });
            sheet.columns = [
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Product', key: 'product', width: 30 },
                { header: 'Qty', key: 'qty', width: 10 },
                { header: 'Barcode', key: 'barcode', width: 20 },
                { header: 'Incharge Person', key: 'incharge_person', width: 20 },
                { header: 'Vehicle', key: 'vehicle', width: 15 },
                { header: 'Challan', key: 'challan', width: 15 }
            ];
            history.forEach(item => {
                sheet.addRow({
                    date: item.OutwardRegister?.outward_date || item.created_at,
                    product: item.ProductItem?.ProductMaster?.product_name,
                    qty: item.quantity_used,
                    barcode: item.ProductItem?.barcode,
                    incharge_person: item.OutwardRegister?.incharge_person || 'Internal',
                    vehicle: item.OutwardRegister?.Vehicle?.vehicle_number || item.OutwardRegister?.vehicle_reg_no,
                    challan: item.OutwardRegister?.challan_number
                });
            });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Inventory_Export_${type}.xlsx"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ message: 'Export failed', error: error.message });
    }
};

exports.downloadOutwardReceipt = async (req, res) => {
    try {
        const { outwardId } = req.params;
        const outward = await OutwardRegister.findByPk(outwardId, {
            include: [
                { model: Warehouse, as: 'warehouse' },
                { model: require('../models').VehicleType, as: 'Vehicle' }
            ]
        });

        if (!outward) return res.status(404).json({ message: 'Outward entry not found' });

        const items = await OutwardItem.findAll({
            where: { outward_id: outwardId },
            include: [{
                model: ProductItem,
                include: [{
                    model: ProductMaster,
                    include: [{ model: Unit, as: 'unit' }]
                }]
            }]
        });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Outward Receipt');

        // Styles
        const headerStyle = { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } }, alignment: { horizontal: 'center' } };

        // Header Info
        worksheet.mergeCells('A1:G1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'DISPATCH & STOCK STATUS REPORT';
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { horizontal: 'center' };

        worksheet.addRow([]);
        worksheet.addRow(['Outward ID:', outward.id, '', 'Date:', new Date(outward.outward_date).toLocaleDateString()]);
        worksheet.addRow(['Incharge:', outward.incharge_person, '', 'Category:', outward.sales_category]);
        worksheet.addRow(['Vehicle:', outward.vehicle_reg_no || outward.Vehicle?.name || 'N/A', '', 'Warehouse:', outward.warehouse?.name || 'Main']);
        worksheet.addRow(['Remarks:', outward.remarks || '—']);
        worksheet.addRow([]);

        // Table Headers
        const tableHeader = ['Product SKU', 'Product Name', 'Barcode / ID', 'Batch / LOT', 'Qty Dispatched', 'Current Balance', 'Unit'];
        const headerRow = worksheet.addRow(tableHeader);
        headerRow.eachCell((cell) => { cell.style = headerStyle; });

        // Add Data
        items.forEach(item => {
            const pi = item.ProductItem;
            const pm = pi?.ProductMaster;
            worksheet.addRow([
                pm?.sku || 'N/A',
                pm?.product_name || 'Unknown',
                pi?.barcode || pi?.imei || pi?.id,
                `${pi?.batch_id || ''} / ${pi?.lot_number || ''}`,
                parseFloat(item.quantity_used),
                parseFloat(pi?.available_quantity || 0),
                pm?.unit?.name || 'Units'
            ]);
        });

        // Column Widths
        worksheet.columns.forEach(col => { col.width = 20; });
        worksheet.getColumn(2).width = 35; // Product Name

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="Outward_Receipt_${outwardId}.xlsx"`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download Receipt Error:', error);
        res.status(500).json({ message: 'Failed to generate receipt', error: error.message });
    }
};

exports.generateRollLabel = async (req, res) => {
    try {
        const { outwardItemId } = req.params;
        const { Op } = sequelize.Sequelize;
        const VehicleType = require('../models').VehicleType;

        // Current outward item
        const itemUsage = await OutwardItem.findByPk(outwardItemId, {
            include: [
                { model: OutwardRegister, include: [{ model: VehicleType, as: 'Vehicle' }] },
                { model: ProductItem, include: [{ model: ProductMaster, include: [{ model: Unit, as: 'unit' }] }] }
            ]
        });

        if (!itemUsage) return res.status(404).json({ message: 'Item usage record not found' });

        const pi = itemUsage.ProductItem;
        const pm = pi?.ProductMaster;
        const reg = itemUsage.OutwardRegister;

        // Previous outward entry for the same product item (just before current)
        const prevUsage = await OutwardItem.findOne({
            where: {
                product_item_id: pi.id,
                id: { [Op.lt]: parseInt(outwardItemId) }
            },
            order: [['id', 'DESC']],
            include: [{ model: OutwardRegister, include: [{ model: VehicleType, as: 'Vehicle' }] }]
        });

        const prevReg = prevUsage?.OutwardRegister;

        const stockBalance = parseFloat(pi?.available_quantity || 0).toFixed(2);
        const lastUsageQty = parseFloat(itemUsage.quantity_used || 0).toFixed(2);
        const unitName = pm?.unit?.name || 'Units';
        const isColor = pm?.color && !['transparent', 'clear', ''].includes((pm.color || '').toLowerCase());
        const ppfType = isColor ? `Color (${pm.color})` : 'Transparent';
        const rollSerial = pi?.barcode || pi?.imei || pi?.serial_number || String(pi?.id || '');
        const vehicleModel = reg?.Vehicle?.name || reg?.Vehicle?.vehicle_number || '';
        const vinReg = reg?.vin_no || reg?.vehicle_reg_no || '';
        const inchargePerson = reg?.incharge_person || '';
        const usageDate = reg?.outward_date
            ? new Date(reg.outward_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : 'N/A';

        const prevVinReg = prevReg?.vin_no || prevReg?.vehicle_reg_no || '';
        const prevVehicleModel = prevReg?.Vehicle?.name || prevReg?.Vehicle?.vehicle_number || '';

        // PDF: 4x6 inches (288 x 432 pts)
        const doc = new PDFDocument({ size: [288, 432], margin: 0 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Roll_Label_${outwardItemId}.pdf"`);
        doc.pipe(res);

        const W = 288, H = 432;
        const pad = 14;

        // Outer border
        doc.rect(4, 4, W - 8, H - 8).lineWidth(1.5).stroke('#1E3A8A');

        // Title bar background
        doc.rect(4, 4, W - 8, 28).fill('#1E3A8A');
        doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
            .text('REMAINING STOCK LABEL', pad, 12, { width: W - pad * 2, align: 'center' });

        // Previous info sub-header bar
        let y = 36;
        doc.rect(4, y, W - 8, 34).fill('#EFF6FF').stroke('#BFDBFE');
        doc.fillColor('#1E40AF').fontSize(7.5).font('Helvetica-Bold')
            .text(`Last Usage: ${lastUsageQty} ${unitName}`, pad, y + 4, { width: W - pad * 2 });
        doc.fillColor('#374151').fontSize(7).font('Helvetica')
            .text(`Previous VIN/REG No: ${prevVinReg}`, pad, y + 15, { width: W - pad * 2 });
        doc.text(`Previous Vehicle Model: ${prevVehicleModel}`, pad, y + 24, { width: W - pad * 2 });

        // Divider
        y = 74;
        doc.moveTo(pad, y).lineTo(W - pad, y).lineWidth(0.5).stroke('#E5E7EB');

        // Stock Balance highlight box
        y = 78;
        doc.rect(pad, y, W - pad * 2, 20).fill('#F0FDF4').stroke('#A7F3D0');
        doc.fillColor('#065F46').fontSize(10).font('Helvetica-Bold')
            .text(`Stock Balance: ${stockBalance} ${unitName}`, pad + 4, y + 5, { width: W - pad * 2 - 8 });

        // Main fields
        y = 104;
        const rows = [
            ['Vehicle Model:', vehicleModel || 'N/A'],
            ['VIN/REG No:', vinReg || 'N/A'],
            ['PPF Roll:', ppfType],
            ['Roll Brand:', pm?.product_make || 'N/A'],
            ['Roll Serial No:', rollSerial],
            ['Incharge Person:', inchargePerson || 'N/A'],
        ];

        rows.forEach(([label, value]) => {
            doc.fillColor('#6B7280').fontSize(7.5).font('Helvetica-Bold')
                .text(label, pad, y, { width: 90, continued: false });
            doc.fillColor('#111827').fontSize(8.5).font('Helvetica')
                .text(value, pad + 94, y, { width: W - pad * 2 - 94 });
            // subtle row separator
            y += 20;
            doc.moveTo(pad, y - 2).lineTo(W - pad, y - 2).lineWidth(0.3).stroke('#F3F4F6');
        });

        // Date of last usage
        y += 4;
        doc.moveTo(pad, y).lineTo(W - pad, y).lineWidth(0.8).stroke('#E5E7EB');
        y += 6;
        doc.fillColor('#374151').fontSize(8).font('Helvetica-Bold')
            .text('Date of Last Usage:', pad, y, { continued: true });
        doc.fillColor('#1D4ED8').fontSize(9).font('Helvetica-Bold')
            .text(`  ${usageDate}`, { continued: false });

        // Barcode text footer
        if (rollSerial) {
            y = H - 36;
            doc.moveTo(pad, y).lineTo(W - pad, y).lineWidth(0.5).stroke('#E5E7EB');
            doc.fillColor('#9CA3AF').fontSize(6.5).font('Helvetica')
                .text('Roll ID', pad, y + 4, { width: W - pad * 2, align: 'center' });
            doc.fillColor('#1E3A8A').fontSize(9).font('Courier-Bold')
                .text(rollSerial, pad, y + 13, { width: W - pad * 2, align: 'center' });
        }

        doc.end();
    } catch (error) {
        console.error('Label Gen Error:', error);
        res.status(500).json({ message: 'Failed to generate label', error: error.message });
    }
};
