const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockTransfer = sequelize.define('StockTransfer', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    transfer_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    product_item_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    from_location: {
        type: DataTypes.STRING(100),
    },
    to_location: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    transfer_by: {
        type: DataTypes.STRING(100), // Email or Name of staff
    },
    remarks: {
        type: DataTypes.TEXT,
    }
}, {
    tableName: 'stock_transfers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = StockTransfer;
