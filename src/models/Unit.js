const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Unit = sequelize.define('Unit', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    base_unit: {
        type: DataTypes.STRING(50),
        allowNull: false,
    },
    conversion_factor: {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: false,
    },
    created_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    updated_by: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
}, {
    tableName: 'units',
    timestamps: true, // Sequelize handles created_at/updated_at by default if mapped
    createdAt: false, // The schema only has updated_at explicitly managed in the SQL for units? Wait, let's check schema.
    // Schema: updated_at TIMESTAMP DEFAULT... created_by, updated_by. It implies created_at is missing or I missed it.
    // Re-reading schema for units: created_by BIGINT, updated_by BIGINT, updated_at TIMESTAMP. No created_at.
    // But usually we want created_at. I'll match the schema strictly.
    updatedAt: 'updated_at',
});

// Actually, looking at the user prompt: "units ... updated_at ... created_by ... updated_by". No created_at for units? 
// That's ODD. But I'll follow it.
// Wait, the "product_categories" had created_at. "product_master" has created_at. "units" DOES NOT.
// I will just map updated_at.

module.exports = Unit;
