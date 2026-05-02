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
    // Location mode: auto = system picks location, manual = user selects
    location_mode: {
        type: DataTypes.ENUM('auto', 'manual'),
        defaultValue: 'auto',
    },
    from_warehouse_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    from_rack_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    from_location: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    to_warehouse_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    to_rack_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    to_location: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 1,
    },
    batch_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    imei: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    serial_number: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    transfer_by: {
        type: DataTypes.STRING(100),
    },
    approval_status: {
        type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
        allowNull: false,
        defaultValue: 'APPROVED',
    },
    approved_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    remarks: {
        type: DataTypes.TEXT,
    },
}, {
    tableName: 'stock_transfers',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = StockTransfer;
