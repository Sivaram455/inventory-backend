require('dotenv').config();
const sequelize = require('./src/config/database');
const app = require('./src/app');

const PORT = process.env.PORT || 3000;

// Models
const { Role, RolePrivilege, User } = require('./src/models');

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✓ Database connection successful');

    // Sync database (Removed alter: true to avoid MySQL index limit issues)
    await sequelize.sync();
    console.log('✓ Database synchronized');

    // Start server
    app.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error.message);
    process.exit(1);
  }
}

startServer();
