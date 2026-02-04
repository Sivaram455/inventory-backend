const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const InwardItem = sequelize.define('InwardItem', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    inward_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    product_item_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    quantity_received: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    unit_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    created_by: {
        type: DataTypes.BIGINT,
    },
    updated_by: {
        type: DataTypes.BIGINT,
    },
}, {
    tableName: 'inward_items',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = InwardItem;
