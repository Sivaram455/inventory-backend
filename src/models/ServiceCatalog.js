const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ServiceCatalog = sequelize.define('ServiceCatalog', {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    category: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'e.g. PPF, Ceramic Coating, Window Tinting'
    },
    service_name: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    description: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    base_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    applies_multiplier: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'If false, price is flat regardless of car type'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    sort_order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    created_by: { type: DataTypes.BIGINT, allowNull: true },
    updated_by: { type: DataTypes.BIGINT, allowNull: true },
}, {
    tableName: 'service_catalog',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = ServiceCatalog;
