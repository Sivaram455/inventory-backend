
const sequelize = require('../src/config/database');

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected.');
    await sequelize.query('ALTER TABLE vehicle_type ADD COLUMN price_multiplier DECIMAL(10,2) DEFAULT 1.00 NOT NULL;');
    console.log('Column added successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
