const { sequelize, ProductItem, ProductMaster, InwardRegister, OutwardRegister, ProductCategory, Unit } = require('../models');

exports.getDashboardStats = async (req, res) => {
    try {
        // 1. Total Stock Count & Volume
        const items = await ProductItem.findAll({
            where: { status: 'IN_STOCK' },
            include: [{
                model: ProductMaster,
                include: [{ model: Unit, as: 'length_unit' }]
            }]
        });

        const totalItems = items.length;
        const totalStockLength = items.reduce((sum, item) => sum + parseFloat(item.available_quantity), 0);

        // 2. Low Stock Alerts
        const products = await ProductMaster.findAll({
            include: [
                {
                    model: ProductItem,
                    as: 'ProductItems',
                    attributes: ['available_quantity']
                },
                { model: Unit, as: 'length_unit' }
            ]
        });

        let lowStockCount = 0;
        const lowStockProducts = [];

        products.forEach(p => {
            const currentStock = p.ProductItems.reduce((sum, i) => sum + parseFloat(i.available_quantity || 0), 0);
            if (currentStock <= parseFloat(p.min_threshold)) {
                lowStockCount++;
                lowStockProducts.push({
                    name: p.product_name,
                    sku: p.sku,
                    current: currentStock,
                    threshold: p.min_threshold,
                    unit: p.length_unit?.name || ''
                });
            }
        });

        // 3. Recent Activity
        const recentInward = await InwardRegister.findAll({
            limit: 5,
            order: [['created_at', 'DESC']],
        });

        const recentOutward = await OutwardRegister.findAll({
            limit: 5,
            order: [['created_at', 'DESC']],
        });

        // 4. Category Distribution
        const categories = await ProductCategory.findAll({
            include: [{ model: ProductMaster, include: [ProductItem] }]
        });

        const categoryStats = categories.map(c => ({
            name: c.category_name,
            count: c.ProductMasters.length,
            stock: c.ProductMasters.reduce((sum, p) => sum + p.ProductItems.length, 0)
        })).filter(c => c.count > 0);

        res.json({
            stats: {
                totalItems,
                totalStockLength: totalStockLength.toFixed(2),
                lowStockCount,
                activeRolls: totalItems // Assumption for now
            },
            lowStockProducts,
            recentActivity: {
                inward: recentInward,
                outward: recentOutward
            },
            categoryStats
        });

    } catch (error) {
        console.error("Dashboard Stats Error:", error);
        res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
    }
};
