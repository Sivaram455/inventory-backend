const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

// Tracks available stock per product_item per warehouse per rack
const WarehouseStock = sequelize.define('WarehouseStock', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    warehouse_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    rack_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    product_item_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    available_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
}, {
    tableName: 'warehouse_stock',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { unique: true, fields: ['warehouse_id', 'rack_id', 'product_item_id'] }
    ]
});

module.exports = WarehouseStock;
