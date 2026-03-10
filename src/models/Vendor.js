const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vendor = sequelize.define('Vendor', {
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    brand_name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: 'uq_vendor_tenant_brand',
    },
    contact_person: {
        type: DataTypes.STRING(150),
        allowNull: false,
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: 'uq_vendor_tenant_email',
    },
    products: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    catlog_url: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    price_url: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    image_url: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    created_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
    },
    updated_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    tableName: 'vendors',
    timestamps: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

module.exports = Vendor;
