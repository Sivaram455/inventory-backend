const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VehicleType = sequelize.define('VehicleType', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    mode: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'e.g., 2-Wheeler, 4-Wheeler, Truck'
    },
    make: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Vehicle manufacturer/brand'
    },
    vehicle_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    image: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'Active'
    },
    created_by: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    updated_by: {
        type: DataTypes.BIGINT,
        allowNull: true
    }
}, {
    tableName: 'vehicle_type',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = VehicleType;
