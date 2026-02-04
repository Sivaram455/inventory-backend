const fs = require('fs');
const path = require('path');
require('dotenv').config();
const sequelize = require('./src/config/database');
const {
  Role, User, RolePrivilege, ProductCategory, Unit,
  ProductMaster, ProductItem, InwardRegister, InwardItem,
  OutwardRegister, OutwardItem
} = require('./src/models');

const modules = [
  { name: 'Dashboard', group: 'GENERAL', sortOrder: 1 },
  { name: 'Product Master', group: 'INVENTORY', sortOrder: 2 },
  { name: 'Inward Register', group: 'INVENTORY', sortOrder: 3 },
  { name: 'Outward Register', group: 'INVENTORY', sortOrder: 4 },
  { name: 'Stock Transfer', group: 'INVENTORY', sortOrder: 5 },
  { name: 'Master Inventory', group: 'INVENTORY', sortOrder: 6 },
  { name: 'Remnant Calc', group: 'INVENTORY', sortOrder: 7 },
  { name: 'Vehicle Usage', group: 'OPERATIONS', sortOrder: 8 },
  { name: 'Staff Master', group: 'ADMIN', sortOrder: 9 },
];

async function seedDatabase() {
  fs.writeFileSync(path.join(__dirname, 'seed_started.txt'), 'STARTED: ' + new Date().toISOString());
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection successful');

    // Force sync to clear old data and start fresh
    await sequelize.sync({ force: true });
    console.log('✓ Database synchronized (Clean Slate)');

    // --- 1. SEED ROLES ---
    const roles = await Promise.all([
      Role.create({ role_name: 'admin', created_by: 1 }),
      Role.create({ role_name: 'manager', created_by: 1 }),
      Role.create({ role_name: 'staff', created_by: 1 })
    ]);
    const [adminRole, managerRole, staffRole] = roles;
    console.log('✓ Roles seeded');

    // --- 2. SEED USERS ---
    const adminUser = await User.create({
      name: 'Super Admin',
      email: 'admin@inventory.com',
      password: 'Admin@123',
      mobile_number: '9876543210',
      role_id: adminRole.id,
      status: 'ACTIVE'
    });
    await User.create({
      name: 'John Manager',
      email: 'manager@inventory.com',
      password: 'Manager@123',
      mobile_number: '9876543211',
      role_id: managerRole.id,
      status: 'ACTIVE'
    });
    console.log('✓ Users seeded');

    // --- 3. SEED PRIVILEGES ---
    for (const module of modules) {
      await RolePrivilege.create({
        role_id: adminRole.id,
        module: module.name,
        module_group: module.group,
        sort_order: module.sortOrder,
        can_view: true, can_add: true, can_edit: true, can_delete: true
      });
      await RolePrivilege.create({
        role_id: managerRole.id,
        module: module.name,
        module_group: module.group,
        sort_order: module.sortOrder,
        can_view: true, can_add: true, can_edit: true, can_delete: false
      });
    }
    console.log('✓ Privileges seeded');

    // --- 4. SEED CATEGORIES (Hierarchy) ---
    const ppf = await ProductCategory.create({ category_name: 'PPF', level: 1 });
    const wrap = await ProductCategory.create({ category_name: 'Vinyl Wrap', level: 1 });
    const tint = await ProductCategory.create({ category_name: 'Window Tint', level: 1 });

    const glossPPF = await ProductCategory.create({ category_name: 'Gloss Clear', level: 2, parent_id: ppf.id });
    const mattePPF = await ProductCategory.create({ category_name: 'Matte Stealth', level: 2, parent_id: ppf.id });
    const colorWrap = await ProductCategory.create({ category_name: 'Color Change', level: 2, parent_id: wrap.id });

    await ProductCategory.create({ category_name: 'TPU High Gloss', level: 3, parent_id: glossPPF.id });
    console.log('✓ Categories seeded');

    // --- 5. SEED UNITS ---
    const m = await Unit.create({ name: 'Meter', base_unit: 'Meter', conversion_factor: 1 });
    const ft = await Unit.create({ name: 'Feet', base_unit: 'Meter', conversion_factor: 0.3048 });
    const roll = await Unit.create({ name: 'Roll', base_unit: 'Meter', conversion_factor: 15 });
    const box = await Unit.create({ name: 'Box', base_unit: 'Piece', conversion_factor: 1 });
    console.log('✓ Units seeded');

    // --- 6. SEED PRODUCT MASTER ---
    const p1 = await ProductMaster.create({
      product_make: '3M', product_name: 'Scotchgard Pro 4.0', sku: '3M-PPF-GLOSS',
      category_id: ppf.id, sub_category1_id: glossPPF.id, color: 'Clear',
      product_length: 15, product_length_unit_id: m.id, product_width: 1.52, product_width_unit_id: m.id,
      min_threshold: 20, threshold_unit_id: m.id
    });

    const p2 = await ProductMaster.create({
      product_make: 'Avery', product_name: 'SW900 Satin Black', sku: 'AV-WR-SATIN-BLK',
      category_id: wrap.id, sub_category1_id: colorWrap.id, color: 'Satin Black',
      product_length: 25, product_length_unit_id: m.id, product_width: 1.52, product_width_unit_id: m.id,
      min_threshold: 15, threshold_unit_id: m.id
    });

    const p3 = await ProductMaster.create({
      product_make: 'Suntek', product_name: 'Ultra PPF Matte', sku: 'ST-PPF-MATTE',
      category_id: ppf.id, sub_category1_id: mattePPF.id, color: 'Matte',
      product_length: 15, product_length_unit_id: m.id, product_width: 1.52, product_width_unit_id: m.id,
      min_threshold: 10, threshold_unit_id: m.id
    });
    console.log('✓ Products seeded');

    // --- 7. SEED INWARD ENTRIES ---
    const inv1 = await InwardRegister.create({
      inward_date: '2024-01-20', purchase_type: 'PAID_PURCHASE', received_by: 'John Admin', remarks: 'Bulk Stock Arrival'
    });

    // Items for 3M PPF (2 Rolls)
    const roll1 = await ProductItem.create({
      product_id: p1.id, barcode: '3M-G-R1', batch_id: 'B-2024-001', total_quantity: 15, available_quantity: 12.5,
      stock_location: 'Rack A1', status: 'IN_STOCK'
    });
    const roll2 = await ProductItem.create({
      product_id: p1.id, barcode: '3M-G-R2', batch_id: 'B-2024-001', total_quantity: 15, available_quantity: 15,
      stock_location: 'Rack A1', status: 'IN_STOCK'
    });

    // Items for Avery Wrap (1 Roll)
    const roll3 = await ProductItem.create({
      product_id: p2.id, barcode: 'AV-S-R1', batch_id: 'AV-X99', total_quantity: 25, available_quantity: 5.0, // Low stock test
      stock_location: 'Rack B1', status: 'IN_STOCK'
    });

    await InwardItem.create({ inward_id: inv1.id, product_item_id: roll1.id, quantity_received: 15, unit_id: m.id });
    await InwardItem.create({ inward_id: inv1.id, product_item_id: roll2.id, quantity_received: 15, unit_id: m.id });
    await InwardItem.create({ inward_id: inv1.id, product_item_id: roll3.id, quantity_received: 25, unit_id: m.id });
    console.log('✓ Inward Records seeded');

    // --- 8. SEED OUTWARD ENTRIES (Activity Feed) ---
    const out1 = await OutwardRegister.create({
      outward_date: '2024-01-25', vehicle_reg_no: 'KA-01-MJ-1234', vin_no: 'VIN778899',
      sales_category: 'RETAIL', incharge_person: 'Mike Technician', remarks: 'Front Bumper Application'
    });

    await OutwardItem.create({
      outward_id: out1.id, product_item_id: roll1.id, quantity_used: 2.5, unit_id: m.id
    });

    const out2 = await OutwardRegister.create({
      outward_date: '2024-01-26', vehicle_reg_no: 'MH-02-AB-5555', vin_no: 'VIN112233',
      sales_category: 'DEALER', incharge_person: 'John Manager', remarks: 'Full Body Wrap - Avery'
    });

    await OutwardItem.create({
      outward_id: out2.id, product_item_id: roll3.id, quantity_used: 20, unit_id: m.id
    });
    console.log('✓ Outward Records seeded');

    // --- 9. SEED STOCK TRANSFERS ---
    await StockTransfer.create({
      transfer_date: '2024-01-27',
      product_item_id: roll1.id,
      from_location: 'Rack A1',
      to_location: 'Showroom Main',
      transfer_by: 'admin@inventory.com',
      remarks: 'Display Piece Movement'
    });

    await StockTransfer.create({
      transfer_date: '2024-01-28',
      product_item_id: roll2.id,
      from_location: 'Rack A1',
      to_location: 'Warehouse B',
      transfer_by: 'manager@inventory.com',
      remarks: 'Storage Optimization'
    });

    // Update locations in ProductItem
    await roll1.update({ stock_location: 'Showroom Main' });
    await roll2.update({ stock_location: 'Warehouse B' });

    console.log('✓ Stock Transfers seeded');

    console.log('\n🚀 SYSTEM READY: Database fully seeded with rich test data.\n');
    fs.writeFileSync(path.join(__dirname, 'seed_complete.txt'), 'SUCCESS: ' + new Date().toISOString());
    process.exit(0);
  } catch (error) {
    console.error('✗ Seeding crashed:', error);
    process.exit(1);
  }
}

seedDatabase();
