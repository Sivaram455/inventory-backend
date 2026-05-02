const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WarehouseRack = sequelize.define('WarehouseRack', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    warehouse_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    rack_code: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    rack_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('Active', 'Inactive'),
        defaultValue: 'Active',
    },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
}, {
    tableName: 'warehouse_racks',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = WarehouseRack;
