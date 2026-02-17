const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductMaster = sequelize.define('ProductMaster', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
    },
    product_make: {
        type: DataTypes.STRING(150),
    },
    product_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    sku: {
        type: DataTypes.STRING(100),
        unique: true,
    },
    hsn_code: {
        type: DataTypes.STRING(50),
    },
    category_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    sub_category1_id: {
        type: DataTypes.BIGINT,
    },
    sub_category2_id: {
        type: DataTypes.BIGINT,
    },
    color: {
        type: DataTypes.STRING(100),
    },
    product_weight: {
        type: DataTypes.DECIMAL(10, 3),
    },
    weight_unit_id: {
        type: DataTypes.BIGINT,
    },
    package_length_cm: {
        type: DataTypes.DECIMAL(10, 2),
    },
    package_width_cm: {
        type: DataTypes.DECIMAL(10, 2),
    },
    package_height_cm: {
        type: DataTypes.DECIMAL(10, 2),
    },
    product_length: {
        type: DataTypes.DECIMAL(10, 2),
    },
    product_length_unit_id: {
        type: DataTypes.BIGINT,
    },
    product_width: {
        type: DataTypes.DECIMAL(10, 2),
    },
    product_width_unit_id: {
        type: DataTypes.BIGINT,
    },
    min_threshold: {
        type: DataTypes.DECIMAL(10, 2),
    },
    threshold_unit_id: {
        type: DataTypes.BIGINT,
    },
    gst_slab: {
        type: DataTypes.STRING(50),
    },
    product_image_url: {
        type: DataTypes.TEXT,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
    },
    quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
    },
    pack_size: {
        type: DataTypes.BIGINT,
        allowNull: true,
    },
    created_by: {
        type: DataTypes.BIGINT,
    },
    updated_by: {
        type: DataTypes.BIGINT,
    },
}, {
    tableName: 'product_master',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = ProductMaster;
