const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
require('dotenv').config();

const errorHandler = require('./middleware/errorHandler');
const roleRoutes = require('./routes/roleRoutes');
const userRoutes = require('./routes/userRoutes');

const path = require('path');

const app = express();

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
const productRoutes = require('./routes/productRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');

app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);

const analyticsRoutes = require('./routes/analyticsRoutes');
const transferRoutes = require('./routes/transferRoutes');
const vehicleRoutes = require('./routes/vehicleRoutes');
app.use('/api/analytics', analyticsRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/vehicles', vehicleRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ message: 'Server is running' });
});

// Temporary Seed Route
app.get('/api/seed-force', async (req, res) => {
  try {
    const {
      Role, User, RolePrivilege, ProductCategory, Unit,
      ProductMaster, ProductItem, InwardRegister, InwardItem,
      OutwardRegister, OutwardItem, StockTransfer
    } = require('./models');
    const sequelize = require('./config/database');

    await sequelize.sync({ force: true });

    const adminR = await Role.create({ role_name: 'admin' });
    const managerR = await Role.create({ role_name: 'manager' });

    const admin = await User.create({
      name: 'Admin User', email: 'admin@inventory.com', password: 'Admin@123',
      mobile_number: '9876543210', role_id: adminR.id, status: 'ACTIVE'
    });

    const m = await Unit.create({ name: 'Meter', base_unit: 'Meter', conversion_factor: 1 });
    const ppf = await ProductCategory.create({ category_name: 'PPF', level: 1 });

    const p1 = await ProductMaster.create({
      product_make: '3M', product_name: 'Scotchgard Pro 4.0', sku: '3M-PPF-GLOSS',
      category_id: ppf.id, color: 'Clear',
      product_length: 15, product_length_unit_id: m.id, product_width: 1.52, product_width_unit_id: m.id,
      min_threshold: 20, threshold_unit_id: m.id
    });

    const inv1 = await InwardRegister.create({
      inward_date: new Date(), purchase_type: 'PAID_PURCHASE', received_by: 'Admin User', remarks: 'Seeded Inward'
    });

    const r1 = await ProductItem.create({
      product_id: p1.id, barcode: 'ROLL-101', total_quantity: 15, available_quantity: 12.5,
      stock_location: 'Warehouse A', status: 'IN_STOCK'
    });

    await InwardItem.create({ inward_id: inv1.id, product_item_id: r1.id, quantity_received: 15, unit_id: m.id });

    const out1 = await OutwardRegister.create({
      outward_date: new Date(), vehicle_reg_no: 'KA-01-MJ-0001', incharge_person: 'Admin User', remarks: 'Seeded Outward'
    });

    await OutwardItem.create({ outward_id: out1.id, product_item_id: r1.id, quantity_used: 2.5, unit_id: m.id });

    const r2 = await ProductItem.create({
      product_id: p1.id, barcode: 'ROLL-102', total_quantity: 15, available_quantity: 15,
      stock_location: 'Warehouse A', status: 'IN_STOCK'
    });

    const t1 = await StockTransfer.create({
      transfer_date: '2024-01-27', product_item_id: r1.id,
      from_location: 'Warehouse A', to_location: 'Showroom Main',
      transfer_by: 'admin@inventory.com', remarks: 'Seeded Transfer'
    });
    await r1.update({ stock_location: 'Showroom Main' });

    const allTransfers = await StockTransfer.findAll({ include: [ProductItem] });

    res.json({
      message: 'Seeding successful with transfers',
      transferCount: allTransfers.length,
      transfers: allTransfers,
      item: r1
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;
