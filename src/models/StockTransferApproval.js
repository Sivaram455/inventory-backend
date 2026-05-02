const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const StockTransferApproval = sequelize.define('StockTransferApproval', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    transfer_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    approved_by: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    approval_status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'PENDING',
    },
    approval_date: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
}, {
    tableName: 'stock_transfer_approvals',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = StockTransferApproval;
