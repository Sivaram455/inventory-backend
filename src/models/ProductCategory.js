const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProductCategory = sequelize.define('ProductCategory', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  category_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  parent_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  level: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
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
  tableName: 'product_categories',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = ProductCategory;
