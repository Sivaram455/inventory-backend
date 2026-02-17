const { sequelize, InwardRegister, InwardItem, OutwardRegister, OutwardItem, ProductItem, ProductMaster, Unit, VehicleUsage } = require('../models');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
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
            include: [{ model: ProductMaster, include: ['category'] }]
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
        const { inward_date, purchase_type, received_by, remarks, items } = req.body;
        // items should be array of { product_id, quantity_received, unit_id, barcode, imei, batch_id, etc. }

        const inward = await InwardRegister.create({
            inward_date,
            purchase_type,
            received_by,
            remarks,
        }, { transaction: t });

        for (const item of items) {
            // 1. Create or Update ProductItem (Inventory Control)
            // Logic: If barcode/imei exists, update quantity? Or is each barcode unique?
            // Schema says barcode/imei UNIQUE. So if it exists, it might be a re-entry or error. 
            // Assumption: If item exists, we add quantity. If not, create.

            let productItem = null;
            if (item.barcode || item.imei) {
                productItem = await ProductItem.findOne({
                    where: {
                        [sequelize.Sequelize.Op.or]: [
                            ...(item.barcode ? [{ barcode: item.barcode }] : []),
                            ...(item.imei ? [{ imei: item.imei }] : [])
                        ]
                    },
                    transaction: t
                });
            }

            if (productItem) {
                // Update existing item
                productItem.total_quantity = parseFloat(productItem.total_quantity) + parseFloat(item.quantity_received);
                productItem.available_quantity = parseFloat(productItem.available_quantity) + parseFloat(item.quantity_received);
                if (item.batch_id) productItem.batch_id = item.batch_id; // update batch if new
                await productItem.save({ transaction: t });
            } else {
                // Create new item
                productItem = await ProductItem.create({
                    product_id: item.product_id,
                    barcode: item.barcode || null,
                    imei: item.imei || null,
                    batch_id: item.batch_id || null,
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
        const { outward_date, vehicle_reg_no, vehicle_id, vin_no, sales_category, incharge_person, remarks, items } = req.body;
        // items: [{ product_item_id (or barcode scan result), quantity_used, unit_id }]

        const outward = await OutwardRegister.create({
            outward_date,
            vehicle_reg_no,
            vehicle_id: vehicle_id || null,
            vin_no,
            sales_category,
            incharge_person,
            remarks,
        }, { transaction: t });

        for (const item of items) {
            // Validate stock
            const productItem = await ProductItem.findByPk(item.product_item_id, { transaction: t });
            if (!productItem) {
                throw new Error(`Item with ID ${item.product_item_id} not found`);
            }

            if (productItem.available_quantity < item.quantity_used) {
                throw new Error(`Insufficient stock for item ${productItem.barcode || productItem.id}. Available: ${productItem.available_quantity}`);
            }

            // Deduct stock
            productItem.available_quantity = parseFloat(productItem.available_quantity) - parseFloat(item.quantity_used);
            // If fully used, maybe mark as USED?
            if (productItem.available_quantity <= 0) {
                productItem.status = 'USED'; // Or just leave as IN_STOCK with 0 qty depending on logic
            }
            await productItem.save({ transaction: t });

            // Create OutwardItem
            await OutwardItem.create({
                outward_id: outward.id,
                product_item_id: productItem.id,
                quantity_used: item.quantity_used,
                unit_id: item.unit_id,
            }, { transaction: t });
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
        res.status(201).json({ message: 'Outward entry successful', outwardId: outward.id });
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
        const { purchase_type, received_by, remarks, inward_date } = req.body;
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
        }, { transaction: t });

        for (const r of rows) {
            const keys = Object.keys(r).reduce((acc, k) => {
                acc[normalizeHeader(k)] = r[k];
                return acc;
            }, {});
            let productId = keys.productid || keys.product_id || keys.product || keys.selectproduct || null;
            const barcode = keys.barcode || '';
            const imei = keys.imei || '';
            const batch = keys.batch || keys.batchid || keys.batch_id || '';
            const qty = parseFloat(keys.quantity || keys.qty || keys.quantityreceived || 0) || 0;
            const location = keys.location || keys.stocklocation || 'DEFAULT';
            const unitHint = keys.unit || keys.unitname || '';
            const unitId = (await resolveUnitId(unitHint)) || null;

            if (qty <= 0) continue;

            // Parse Dropdown Format: "ID:123 - Name..."
            if (productId && typeof productId === 'string' && productId.startsWith('ID:')) {
                const match = productId.match(/^ID:(\d+)/);
                if (match) {
                    productId = match[1];
                }
            }

            let productItem = null;
            if (barcode || imei) {
                productItem = await ProductItem.findOne({
                    where: {
                        [sequelize.Sequelize.Op.or]: [
                            ...(barcode ? [{ barcode }] : []),
                            ...(imei ? [{ imei }] : [])
                        ]
                    },
                    transaction: t
                });
            }
            if (productItem) {
                productItem.total_quantity = parseFloat(productItem.total_quantity) + qty;
                productItem.available_quantity = parseFloat(productItem.available_quantity) + qty;
                if (batch) productItem.batch_id = batch;
                if (location) productItem.stock_location = location;
                await productItem.save({ transaction: t });
            } else {
                productItem = await ProductItem.create({
                    product_id: productId,
                    barcode: barcode || null,
                    imei: imei || null,
                    batch_id: batch || null,
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
// Bulk Excel Upload: Outward
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

        const { outward_date, vehicle_reg_no, vehicle_id, vin_no, sales_category, incharge_person, remarks } = req.body;

        const outward = await OutwardRegister.create({
            outward_date: outward_date || new Date(),
            vehicle_reg_no: vehicle_reg_no || '',
            vehicle_id: vehicle_id || null,
            vin_no: vin_no || '',
            sales_category: sales_category || 'DIRECT_SALES',
            incharge_person: incharge_person || '',
            remarks: remarks || 'Bulk Upload',
            created_by: req.user?.id || null,
        }, { transaction: t });

        for (const r of rows) {
            const keys = normalizeKeys(r);
            let productItemId = keys.productitemid || keys.itemid || keys.stockitem || keys.stockitemselectfromdropdown || null;
            const barcode = keys.barcode || '';
            const imei = keys.imei || '';
            const qtyUsed = parseFloat(keys.quantity || keys.qty || keys.quantityused || 0);
            const unitHint = keys.unit || keys.unitname || '';

            if (qtyUsed <= 0) continue;

            // Parse Dropdown Format: "ID:123 - Name..."
            if (productItemId && typeof productItemId === 'string' && productItemId.startsWith('ID:')) {
                const match = productItemId.match(/^ID:(\d+)/);
                if (match) {
                    productItemId = match[1];
                }
            }

            let productItem = null;
            // Find by ID or Barcode/IMEI
            if (productItemId) {
                productItem = await ProductItem.findByPk(productItemId, { transaction: t });
            } else if (barcode || imei) {
                productItem = await ProductItem.findOne({
                    where: {
                        [sequelize.Sequelize.Op.or]: [
                            ...(barcode ? [{ barcode }] : []),
                            ...(imei ? [{ imei }] : [])
                        ]
                    },
                    transaction: t
                });
            }

            if (!productItem) {
                throw new Error(`Item not found for row: ${JSON.stringify(r)}`);
            }

            if (parseFloat(productItem.available_quantity) < qtyUsed) {
                throw new Error(`Insufficient stock for item ${productItem.barcode || productItem.id}. Available: ${productItem.available_quantity}, Requested: ${qtyUsed}`);
            }

            // Deduct Stock
            productItem.available_quantity = parseFloat(productItem.available_quantity) - qtyUsed;
            if (productItem.available_quantity <= 0 && productItem.status !== 'USED') {
                // productItem.status = 'USED'; // Optional: Mark as used if 0
                // Keep as IN_STOCK but 0 quantity for now, or change logic as per business rule
            }
            await productItem.save({ transaction: t });

            const unitId = (await resolveUnitId(unitHint)) || productItem.unit_id || 1; // Fallback to 1 or logic to get unit from product

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

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inward Entry');
        const refSheet = workbook.addWorksheet('RefData');
        refSheet.state = 'hidden';

        // Headers
        worksheet.columns = [
            { header: 'Select Product', key: 'product', width: 40 },
            { header: 'Barcode', key: 'barcode', width: 20 },
            { header: 'IMEI', key: 'imei', width: 20 },
            { header: 'Quantity', key: 'quantity', width: 15 },
            { header: 'Unit', key: 'unit', width: 15 },
            { header: 'Batch ID', key: 'batch', width: 20 },
            { header: 'Stock Location', key: 'location', width: 20 }
        ];

        // Fill Reference Data
        refSheet.getCell('A1').value = 'Products';
        refSheet.getCell('B1').value = 'Units';

        products.forEach((p, idx) => {
            // Format: ID:123 - Name (SKU)
            const label = `ID:${p.id} - ${p.product_name} (${p.sku || 'N/A'})`;
            refSheet.getCell(`A${idx + 2}`).value = label;
        });

        units.forEach((u, idx) => {
            refSheet.getCell(`B${idx + 2}`).value = u.name;
        });

        const prodCount = products.length || 1;
        const unitCount = units.length || 1;

        // Data Validation
        for (let i = 2; i <= 500; i++) {
            // Product Dropdown
            worksheet.getCell(`A${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`=RefData!$A$2:$A$${prodCount + 1}`]
            };

            // Unit Dropdown
            worksheet.getCell(`E${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`=RefData!$B$2:$B$${unitCount + 1}`]
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

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Outward Entry');
        const refSheet = workbook.addWorksheet('RefData');
        refSheet.state = 'hidden';

        // Headers
        worksheet.columns = [
            { header: 'Stock Item (Select from Dropdown)', key: 'stock_item', width: 50 },
            { header: 'Quantity Used', key: 'quantity', width: 15 },
            { header: 'Unit', key: 'unit', width: 15 },
            { header: 'Remarks', key: 'remarks', width: 30 }
        ];

        // Fill Reference Data
        refSheet.getCell('A1').value = 'StockItems';
        refSheet.getCell('B1').value = 'Units';

        items.forEach((item, idx) => {
            // Format: ID:123 - Name (Barcode)
            const label = `ID:${item.id} - ${item.ProductMaster ? item.ProductMaster.product_name : 'Unknown'} (Qty: ${parseFloat(item.available_quantity)})`;
            refSheet.getCell(`A${idx + 2}`).value = label;
        });

        units.forEach((u, idx) => {
            refSheet.getCell(`B${idx + 2}`).value = u.name;
        });

        const stockCount = items.length || 1;
        const unitCount = units.length || 1;

        // Add Data Validation to first 500 rows
        for (let i = 2; i <= 500; i++) {
            // Stock Item Dropdown
            worksheet.getCell(`A${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`=RefData!$A$2:$A$${stockCount + 1}`]
            };

            // Unit Dropdown
            worksheet.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`=RefData!$B$2:$B$${unitCount + 1}`]
            };
        }

        // Add a sample row (optional, or leave blank)
        // worksheet.addRow({ stock_item: 'Select here...', quantity: 1, unit: 'Pcs' });

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
        const { ProductCategory } = require('../models'); // Import required model

        const history = await InwardItem.findAll({
            include: [
                {
                    model: InwardRegister,
                    as: 'InwardRegister'
                },
                {
                    model: ProductItem,
                    include: [{
                        model: ProductMaster,
                        include: [{ model: ProductCategory, as: 'category' }]
                    }]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Flatten for frontend
        const flattened = history.map(item => ({
            id: item.id,
            created_at: item.InwardRegister?.inward_date || item.created_at,
            purchase_type: item.InwardRegister?.purchase_type,
            supplier_name: item.InwardRegister?.received_by,
            batch_number: item.ProductItem?.batch_id,
            quantity: item.quantity_received,
            ProductMaster: item.ProductItem?.ProductMaster,
            Category: item.ProductItem?.ProductMaster?.category?.category_name,
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

        const history = await OutwardItem.findAll({
            include: [
                {
                    model: OutwardRegister,
                    include: [{ model: VehicleType, as: 'Vehicle' }]
                },
                {
                    model: ProductItem,
                    include: [{
                        model: ProductMaster,
                        include: [{ model: ProductCategory, as: 'category' }]
                    }]
                }
            ],
            order: [['created_at', 'DESC']]
        });

        const flattened = history.map(item => ({
            id: item.id,
            created_at: item.OutwardRegister?.outward_date || item.created_at,
            sales_category: item.OutwardRegister?.sales_category,
            client_name: item.OutwardRegister?.incharge_person, // incharge_person used as client/destination
            quantity: item.quantity_used,
            ProductItem: item.ProductItem,
            Category: item.ProductItem?.ProductMaster?.category?.category_name, // Fixed accessor
            Vehicle: item.OutwardRegister?.Vehicle,
            challan_number: item.OutwardRegister?.remarks, // Using remarks or if challan exists (not in model currently)
            remarks: item.OutwardRegister?.remarks
        }));

        res.json(flattened);
    } catch (error) {
        console.error('Get Outward History Error:', error);
        res.status(500).json({ message: 'Failed to fetch outward history', error: error.message });
    }
};
