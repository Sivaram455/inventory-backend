const { ProductCategory, Unit, ProductMaster, ProductItem, sequelize } = require('../models');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');

// Helpers for bulk upload
function normalizeHeader(h) {
    return String(h || '').trim().toLowerCase().replace(/[\s_]+/g, '');
}

async function resolveCategoryId(name) {
    if (!name) return null;
    const category = await ProductCategory.findOne({
        where: { category_name: String(name).trim() }
    });
    return category ? category.id : null;
}

async function resolveUnitId(name) {
    if (!name) return null;
    const unit = await Unit.findOne({
        where: { name: String(name).trim() }
    });
    return unit ? unit.id : null;
}

exports.getCategories = async (req, res) => {
    try {
        const categories = await ProductCategory.findAll({
            order: [['level', 'ASC'], ['category_name', 'ASC']],
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching categories', error: error.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const category = await ProductCategory.create(req.body);
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: 'Error creating category', error: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await ProductCategory.update(req.body, { where: { id } });
        if (updated) {
            const updatedCategory = await ProductCategory.findByPk(id);
            res.json(updatedCategory);
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating category', error: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await ProductCategory.destroy({ where: { id } });
        if (deleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Category not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error deleting category', error: error.message });
    }
};


exports.getUnits = async (req, res) => {
    try {
        const units = await Unit.findAll();
        res.json(units);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching units', error: error.message });
    }
};

exports.createUnit = async (req, res) => {
    try {
        const unit = await Unit.create(req.body);
        res.status(201).json(unit);
    } catch (error) {
        res.status(500).json({ message: 'Error creating unit', error: error.message });
    }
};

exports.updateUnit = async (req, res) => {
    try {
        const { id } = req.params;
        const [updated] = await Unit.update(req.body, { where: { id } });
        if (updated) {
            const updatedUnit = await Unit.findByPk(id);
            res.json(updatedUnit);
        } else {
            res.status(404).json({ message: 'Unit not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error updating unit', error: error.message });
    }
};

exports.deleteUnit = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Unit.destroy({ where: { id } });
        if (deleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Unit not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error deleting unit', error: error.message });
    }
};

exports.getProducts = async (req, res) => {
    try {
        const products = await ProductMaster.findAll({
            include: [
                { model: ProductCategory, as: 'category' },
                { model: Unit, as: 'weight_unit' },
                { model: Unit, as: 'pack_size_unit' },
                { model: Unit, as: 'unit' }
            ]
        });
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching products', error: error.message });
    }
};

exports.createProduct = async (req, res) => {
    try {
        const productData = { ...req.body };

        // Robust sanitization for all ID and numeric fields
        const numericFields = [
            'category_id', 'sub_category1_id', 'sub_category2_id',
            'weight_unit_id', 'product_length_unit_id', 'product_width_unit_id',
            'threshold_unit_id', 'product_weight', 'product_length',
            'product_width', 'min_threshold', 'package_length_cm',
            'threshold_unit_id', 'product_weight', 'product_length',
            'product_width', 'min_threshold', 'package_length_cm',
            'package_width_cm', 'package_height_cm', 'quantity', 'pack_size', 'unit_id'
        ];

        numericFields.forEach(field => {
            if (productData[field] === '' || productData[field] === 'null' || productData[field] === undefined) {
                productData[field] = null;
            }
        });

        if (req.file) {
            productData.product_image_url = `/uploads/${req.file.filename}`;
        }
        const product = await ProductMaster.create(productData);
        res.status(201).json(product);
    } catch (error) {
        console.error('Create Product Error:', error);
        res.status(500).json({ message: 'Error creating product', error: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const productData = { ...req.body };

        // Robust sanitization for all ID and numeric fields
        const numericFields = [
            'category_id', 'sub_category1_id', 'sub_category2_id',
            'weight_unit_id', 'product_length_unit_id', 'product_width_unit_id',
            'threshold_unit_id', 'product_weight', 'product_length',
            'product_width', 'min_threshold', 'package_length_cm',
            'threshold_unit_id', 'product_weight', 'product_length',
            'product_width', 'min_threshold', 'package_length_cm',
            'package_width_cm', 'package_height_cm', 'quantity', 'pack_size', 'unit_id'
        ];

        numericFields.forEach(field => {
            if (productData[field] === '' || productData[field] === 'null' || productData[field] === undefined) {
                productData[field] = null;
            }
        });

        if (req.file) {
            productData.product_image_url = `/uploads/${req.file.filename}`;
        }
        const [updated] = await ProductMaster.update(productData, { where: { id } });
        if (updated) {
            const updatedProduct = await ProductMaster.findByPk(id);
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        console.error('Update Product Error:', error);
        res.status(500).json({ message: 'Error updating product', error: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await ProductMaster.destroy({ where: { id } });
        if (deleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error deleting product', error: error.message });
    }
};

exports.uploadProductExcel = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Excel file is required' });
        }

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

        const stats = { created: 0, updated: 0, failed: 0, errors: [] };

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            try {
                const keys = Object.keys(r).reduce((acc, k) => {
                    acc[normalizeHeader(k)] = r[k];
                    return acc;
                }, {});

                const sku = String(keys.sku || keys.productid || '').trim();
                const productName = String(keys.productname || keys.name || '').trim();
                
                if (!sku || !productName) {
                    stats.failed++;
                    stats.errors.push(`Row ${i + 2}: Missing SKU or Product Name`);
                    continue;
                }

                const categoryId = await resolveCategoryId(keys.category || keys.categoryname);
                if (!categoryId) {
                    stats.failed++;
                    stats.errors.push(`Row ${i + 2} (${sku}): Invalid or missing category`);
                    continue;
                }

                const sub1Id = await resolveCategoryId(keys.subcategory1 || keys.sub1);
                const sub2Id = await resolveCategoryId(keys.subcategory2 || keys.sub2);

                const lengthUnitId = await resolveUnitId(keys.lengthunit);
                const widthUnitId = await resolveUnitId(keys.widthunit);
                const weightUnitId = await resolveUnitId(keys.weightunit);
                const thresholdUnitId = await resolveUnitId(keys.thresholdunit);
                const packSizeUnitId = await resolveUnitId(keys.packsizeunit || keys.packsize || keys.packunit);
                const unitId = await resolveUnitId(keys.unit || keys.baseunit);

                const productData = {
                    product_make: String(keys.make || keys.brand || '').trim(),
                    product_name: productName,
                    sku: sku,
                    hsn_code: String(keys.hsncode || keys.hsn || '').trim(),
                    category_id: categoryId,
                    sub_category1_id: sub1Id,
                    sub_category2_id: sub2Id,
                    color: String(keys.color || '').trim(),
                    product_weight: parseFloat(keys.weight || 0) || null,
                    weight_unit_id: weightUnitId,
                    product_length: parseFloat(keys.length || 0) || null,
                    product_length_unit_id: lengthUnitId,
                    product_width: parseFloat(keys.width || 0) || null,
                    product_width_unit_id: widthUnitId,
                    min_threshold: parseFloat(keys.threshold || 0) || null,
                    threshold_unit_id: thresholdUnitId,
                    gst_slab: String(keys.gstslab || keys.gst || '').trim(),
                    package_length_cm: parseFloat(keys.packagel || 0) || null,
                    package_width_cm: parseFloat(keys.packagew || 0) || null,
                    package_height_cm: parseFloat(keys.packageh || 0) || null,
                    quantity: parseFloat(keys.quantity || 0) || null,
                    pack_size: packSizeUnitId,
                    unit_id: unitId
                };

                const [product, created] = await ProductMaster.findOrCreate({
                    where: { sku: sku },
                    defaults: productData,
                    transaction: t
                });

                if (!created) {
                    await product.update(productData, { transaction: t });
                    stats.updated++;
                } else {
                    stats.created++;
                }
            } catch (rowError) {
                stats.failed++;
                stats.errors.push(`Row ${i + 2}: ${rowError.message}`);
            }
        }

        await t.commit();
        res.status(201).json({
            message: 'Bulk upload completed',
            stats
        });
    } catch (error) {
        await t.rollback();
        console.error('Bulk Upload Error:', error);
        res.status(500).json({ message: 'Bulk upload failed', error: error.message });
    }
};

exports.getSampleExcel = async (req, res) => {
    try {
        const categories = await ProductCategory.findAll({ attributes: ['category_name'] });
        const units = await Unit.findAll({ attributes: ['name'] });

        const workbook = new ExcelJS.Workbook();
        const mainSheet = workbook.addWorksheet('Products');
        const refSheet = workbook.addWorksheet('ReferenceData');

        // Setup Headers for main sheet
        const headers = [
            'SKU', 'Product Name', 'Category', 'Make', 'Color',
            'Length', 'Length Unit', 'Width', 'Width Unit',
            'Weight', 'Weight Unit', 'Threshold', 'Threshold Unit',
            'GST Slab', 'HSN Code', 'Package L', 'Package W', 'Package H',
            'Quantity', 'Base Unit', 'Pack Size Unit'
        ];
        mainSheet.addRow(headers);

        // Styling headers
        mainSheet.getRow(1).font = { bold: true };
        mainSheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2E8F0' }
        };

        // Add sample data rows from database
        const products = await ProductMaster.findAll({
            include: [
                { model: ProductCategory, as: 'category' },
                { model: ProductCategory, as: 'sub_category1' },
                { model: ProductCategory, as: 'sub_category2' },
                { model: Unit, as: 'length_unit' },
                { model: Unit, as: 'width_unit' },
                { model: Unit, as: 'weight_unit' },
                { model: Unit, as: 'threshold_unit' },
                { model: Unit, as: 'pack_size_unit' },
                { model: Unit, as: 'unit' }
            ],
            limit: 100
        });

        products.forEach(product => {
            mainSheet.addRow([
                product.sku || '',
                product.product_name || '',
                product.category?.category_name || '',
                product.product_make || '',
                product.color || '',
                product.product_length || '',
                product.length_unit?.name || '',
                product.product_width || '',
                product.width_unit?.name || '',
                product.product_weight || '',
                product.weight_unit?.name || '',
                product.min_threshold || '',
                product.threshold_unit?.name || '',
                product.gst_slab || '',
                product.hsn_code || '',
                product.package_length_cm || '',
                product.package_width_cm || '',
                product.package_height_cm || '',
                product.quantity || '',
                product.unit?.name || '',
                product.pack_size_unit?.name || ''
            ]);
        });

        // Setup Reference Data sheet (hidden or last)
        refSheet.getColumn(1).values = ['Valid Categories', ...categories.map(c => c.category_name)];
        refSheet.getColumn(2).values = ['Valid Units', ...units.map(u => u.name)];

        // Add Data Validation (Dropdowns) to rows after existing data
        const catRange = `'ReferenceData'!$A$2:$A$${categories.length + 1}`;
        const unitRange = `'ReferenceData'!$B$2:$B$${units.length + 1}`;
        const startRow = products.length + 2;
        const endRow = startRow + 100;

        for (let i = startRow; i <= endRow; i++) {
            // Category Dropdown (Column C)
            mainSheet.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [catRange]
            };
            // Units Dropdowns (Columns G, I, K, M, N)
            ['G', 'I', 'K', 'M', 'T'].forEach(col => {
                mainSheet.getCell(`${col}${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [unitRange]
                };
            });
        }

        // Auto-fit columns (basic)
        mainSheet.columns.forEach(column => {
            column.width = 18;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Sample excel error:', error);
        res.status(500).json({ message: 'Error generating sample', error: error.message });
    }
};
