const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InwardRegister = sequelize.define('InwardRegister', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    inward_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    purchase_type: {
        type: DataTypes.ENUM('PAID_PURCHASE', 'RETURN', 'RETURN_GHOST'),
        allowNull: false,
    },
    received_by: {
        type: DataTypes.STRING(100),
    },
    remarks: {
        type: DataTypes.TEXT,
    },
    created_by: {
        type: DataTypes.BIGINT,
    },
    updated_by: {
        type: DataTypes.BIGINT,
    },
}, {
    tableName: 'inward_register',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = InwardRegister;
