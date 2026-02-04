const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductItem = sequelize.define('ProductItem', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    product_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    barcode: {
        type: DataTypes.STRING(100),
        unique: true,
    },
    imei: {
        type: DataTypes.STRING(100),
        unique: true,
    },
    batch_id: {
        type: DataTypes.STRING(100),
    },
    total_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    available_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    stock_location: {
        type: DataTypes.STRING(100),
    },
    status: {
        type: DataTypes.ENUM('IN_STOCK', 'USED', 'DAMAGED', 'RETURNED'),
        defaultValue: 'IN_STOCK',
    },
    created_by: {
        type: DataTypes.BIGINT,
    },
    updated_by: {
        type: DataTypes.BIGINT,
    },
}, {
    tableName: 'product_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = ProductItem;
