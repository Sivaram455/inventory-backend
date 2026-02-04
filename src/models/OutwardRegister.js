const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OutwardRegister = sequelize.define('OutwardRegister', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    outward_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    vehicle_reg_no: {
        type: DataTypes.STRING(50),
    },
    vin_no: {
        type: DataTypes.STRING(50),
    },
    sales_category: {
        type: DataTypes.STRING(100),
    },
    incharge_person: {
        type: DataTypes.STRING(100),
    },
    remarks: {
        type: DataTypes.TEXT,
    },
    vehicle_id: {
        type: DataTypes.BIGINT, // Keeping BIGINT, assuming IDs might be large. If mismatch persists, we can try INTEGER.
        allowNull: true,
        // references removed to prevent "incompatible" error during sync
    },
    created_by: {
        type: DataTypes.BIGINT,
    },
    updated_by: {
        type: DataTypes.BIGINT,
    },
}, {
    tableName: 'outward_register',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = OutwardRegister;
