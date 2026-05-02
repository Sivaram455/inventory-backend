const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockTransferItem = sequelize.define('StockTransferItem', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    transfer_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    product_item_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    imei: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    serial_number: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    batch_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1,
    },
}, {
    tableName: 'stock_transfer_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = StockTransferItem;
