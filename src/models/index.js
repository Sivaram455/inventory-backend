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
const Employee = require('./Employee');
const Attendance = require('./Attendance');
const Payroll = require('./Payroll');
const Leave = require('./Leave');
const Expense = require('./Expense');
const CorporateBank = require('./CorporateBank');
const Beneficiary = require('./Beneficiary');
const Vendor = require('./Vendor');
const BankPayment = require('./BankPayment');

// Existing Associations
Role.hasMany(User, { foreignKey: 'role_id', as: 'users' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(RolePrivilege, { foreignKey: 'role_id', as: 'privileges' });
RolePrivilege.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });

// Inventory Associations

// Categories hierarchy
ProductCategory.hasMany(ProductCategory, { as: 'children', foreignKey: 'parent_id' });
ProductCategory.belongsTo(ProductCategory, { as: 'parent', foreignKey: 'parent_id' });

// Product Master -> Category
ProductCategory.hasMany(ProductMaster, { foreignKey: 'category_id' });
ProductMaster.belongsTo(ProductCategory, { as: 'category', foreignKey: 'category_id' });
ProductMaster.belongsTo(ProductCategory, { as: 'sub_category1', foreignKey: 'sub_category1_id', constraints: false });
ProductMaster.belongsTo(ProductCategory, { as: 'sub_category2', foreignKey: 'sub_category2_id', constraints: false });

// Product Master -> Units (Removed constraints to avoid MySQL 64-key limit)
ProductMaster.belongsTo(Unit, { as: 'weight_unit', foreignKey: 'weight_unit_id', constraints: false });
ProductMaster.belongsTo(Unit, { as: 'length_unit', foreignKey: 'product_length_unit_id', constraints: false });
ProductMaster.belongsTo(Unit, { as: 'width_unit', foreignKey: 'product_width_unit_id', constraints: false });
ProductMaster.belongsTo(Unit, { as: 'threshold_unit', foreignKey: 'threshold_unit_id', constraints: false });
ProductMaster.belongsTo(Unit, { as: 'pack_size_unit', foreignKey: 'pack_size', constraints: false });

// Product Master -> Items
ProductMaster.hasMany(ProductItem, { foreignKey: 'product_id' });
ProductItem.belongsTo(ProductMaster, { foreignKey: 'product_id' });

// Inward flow
InwardRegister.hasMany(InwardItem, { foreignKey: 'inward_id', constraints: false });
InwardItem.belongsTo(InwardRegister, { foreignKey: 'inward_id', constraints: false });

InwardItem.belongsTo(ProductItem, { foreignKey: 'product_item_id', constraints: false });
InwardItem.belongsTo(Unit, { foreignKey: 'unit_id', constraints: false });

// Outward flow
OutwardRegister.hasMany(OutwardItem, { foreignKey: 'outward_id', constraints: false });
OutwardItem.belongsTo(OutwardRegister, { foreignKey: 'outward_id', constraints: false });

OutwardItem.belongsTo(ProductItem, { foreignKey: 'product_item_id', constraints: false });
OutwardItem.belongsTo(Unit, { foreignKey: 'unit_id', constraints: false });

// Transfer flow
StockTransfer.belongsTo(ProductItem, { foreignKey: 'product_item_id', constraints: false });
ProductItem.hasMany(StockTransfer, { foreignKey: 'product_item_id', constraints: false });

// Vehicle Associations
VehicleType.hasMany(VehicleUsage, { foreignKey: 'vehicle_id', constraints: false });
VehicleUsage.belongsTo(VehicleType, { foreignKey: 'vehicle_id', constraints: false });

// Outward Register -> Vehicle
OutwardRegister.belongsTo(VehicleType, { foreignKey: 'vehicle_id', as: 'Vehicle', constraints: false });

// HR Associations
User.hasOne(Employee, { foreignKey: 'user_id' });
Employee.belongsTo(User, { foreignKey: 'user_id' });

Employee.hasMany(Attendance, { foreignKey: 'employee_id' });
Attendance.belongsTo(Employee, { foreignKey: 'employee_id' });

Employee.hasMany(Payroll, { foreignKey: 'employee_id' });
Payroll.belongsTo(Employee, { foreignKey: 'employee_id' });

Employee.hasMany(Leave, { foreignKey: 'employee_id' });
Leave.belongsTo(Employee, { foreignKey: 'employee_id' });

Beneficiary.hasMany(BankPayment, { foreignKey: 'beneficiary_id' });
BankPayment.belongsTo(Beneficiary, { foreignKey: 'beneficiary_id' });

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
  Employee,
  Attendance,
  Payroll,
  Leave,
  Expense,
  CorporateBank,
  Beneficiary,
  Vendor,
  BankPayment,
};
