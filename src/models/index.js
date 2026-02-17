const sequelize = require('../config/database');
const User = require('./User');
const Role = require('./Role');
const RolePrivilege = require('./RolePrivilege');

const ProductCategory = require('./ProductCategory');
const Unit = require('./Unit');
const ProductMaster = require('./ProductMaster');
const ProductItem = require('./ProductItem');
const InwardRegister = require('./InwardRegister');
const InwardItem = require('./InwardItem');
const OutwardRegister = require('./OutwardRegister');
const OutwardItem = require('./OutwardItem');
const StockTransfer = require('./StockTransfer');
const VehicleType = require('./VehicleType');
const VehicleUsage = require('./VehicleUsage');

// Existing Associations
Role.hasMany(User, { foreignKey: 'role_id' });
User.belongsTo(Role, { foreignKey: 'role_id' });
Role.hasMany(RolePrivilege, { foreignKey: 'role_id' });
RolePrivilege.belongsTo(Role, { foreignKey: 'role_id' });

// Inventory Associations

// Categories hierarchy
ProductCategory.hasMany(ProductCategory, { as: 'children', foreignKey: 'parent_id' });
ProductCategory.belongsTo(ProductCategory, { as: 'parent', foreignKey: 'parent_id' });

// Product Master -> Category
ProductCategory.hasMany(ProductMaster, { foreignKey: 'category_id' });
ProductMaster.belongsTo(ProductCategory, { as: 'category', foreignKey: 'category_id' });
ProductMaster.belongsTo(ProductCategory, { as: 'sub_category1', foreignKey: 'sub_category1_id' });
ProductMaster.belongsTo(ProductCategory, { as: 'sub_category2', foreignKey: 'sub_category2_id' });

// Product Master -> Units
ProductMaster.belongsTo(Unit, { as: 'weight_unit', foreignKey: 'weight_unit_id' });
ProductMaster.belongsTo(Unit, { as: 'length_unit', foreignKey: 'product_length_unit_id' });
ProductMaster.belongsTo(Unit, { as: 'width_unit', foreignKey: 'product_width_unit_id' });
ProductMaster.belongsTo(Unit, { as: 'threshold_unit', foreignKey: 'threshold_unit_id' });
ProductMaster.belongsTo(Unit, { as: 'pack_size_unit', foreignKey: 'pack_size' });

// Product Master -> Items
ProductMaster.hasMany(ProductItem, { foreignKey: 'product_id' });
ProductItem.belongsTo(ProductMaster, { foreignKey: 'product_id' });

// Inward flow
InwardRegister.hasMany(InwardItem, { foreignKey: 'inward_id' });
InwardItem.belongsTo(InwardRegister, { foreignKey: 'inward_id' });

InwardItem.belongsTo(ProductItem, { foreignKey: 'product_item_id' });
InwardItem.belongsTo(Unit, { foreignKey: 'unit_id' });

// Outward flow
OutwardRegister.hasMany(OutwardItem, { foreignKey: 'outward_id' });
OutwardItem.belongsTo(OutwardRegister, { foreignKey: 'outward_id' });

OutwardItem.belongsTo(ProductItem, { foreignKey: 'product_item_id' });
OutwardItem.belongsTo(Unit, { foreignKey: 'unit_id' });

// Transfer flow
StockTransfer.belongsTo(ProductItem, { foreignKey: 'product_item_id' });
ProductItem.hasMany(StockTransfer, { foreignKey: 'product_item_id' });

// Vehicle Associations
VehicleType.hasMany(VehicleUsage, { foreignKey: 'vehicle_id' });
VehicleUsage.belongsTo(VehicleType, { foreignKey: 'vehicle_id' });

// Outward Register -> Vehicle
OutwardRegister.belongsTo(VehicleType, { foreignKey: 'vehicle_id', as: 'Vehicle', constraints: false });

module.exports = {
  sequelize,
  User,
  Role,
  RolePrivilege,
  ProductCategory,
  Unit,
  ProductMaster,
  ProductItem,
  InwardRegister,
  InwardItem,
  OutwardRegister,
  OutwardItem,
  StockTransfer,
  VehicleType,
  VehicleUsage,
};
