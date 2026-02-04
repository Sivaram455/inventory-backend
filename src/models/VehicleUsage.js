const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VehicleUsage = sequelize.define('VehicleUsage', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    vehicle_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
            model: 'vehicle_type',
            key: 'id'
        }
    },
    usage_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    purpose: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Purpose of vehicle usage (e.g., Inward, Outward, Transfer)'
    },
    reference_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Type: Inward, Outward, Transfer'
    },
    reference_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'ID of related transaction'
    },
    driver_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    start_km: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    end_km: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    total_km: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    created_by: {
        type: DataTypes.BIGINT,
        allowNull: true
    }
}, {
    tableName: 'vehicle_usage',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = VehicleUsage;
