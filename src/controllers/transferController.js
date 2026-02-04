const { StockTransfer, ProductItem, sequelize } = require('../models');

exports.getAllTransfers = async (req, res) => {
    try {
        const transfers = await StockTransfer.findAll({
            order: [['transfer_date', 'DESC'], ['created_at', 'DESC']]
        });
        res.json(transfers);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching transfers', error: error.message });
    }
};

exports.createTransfer = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        const { transfer_date, product_item_id, from_location, to_location, transfer_by, remarks } = req.body;

        const transfer = await StockTransfer.create({
            transfer_date,
            product_item_id,
            from_location,
            to_location,
            transfer_by,
            remarks
        }, { transaction: t });

        // Update ProductItem location
        const item = await ProductItem.findByPk(product_item_id);
        if (item) {
            await item.update({ stock_location: to_location }, { transaction: t });
        }

        await t.commit();
        res.status(201).json(transfer);
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: 'Error creating transfer', error: error.message });
    }
};
