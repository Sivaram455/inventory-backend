const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const Role = require('./Role');

const RolePrivilege = sequelize.define('RolePrivilege', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  role_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: Role,
      key: 'id',
    },
  },
  module: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  module_group: {
    type: DataTypes.STRING(50),
    defaultValue: 'GENERAL',
  },
  sort_order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  can_view: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  can_add: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  can_edit: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  can_delete: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    onUpdate: DataTypes.NOW,
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
  tableName: 'role_privileges',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['role_id', 'module'],
    },
  ],
});

RolePrivilege.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(RolePrivilege, { foreignKey: 'role_id', as: 'privileges' });

module.exports = RolePrivilege;
