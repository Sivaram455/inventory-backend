const { sequelize, Expense } = require('./src/models');

async function sync() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');

        // Check if expense_category exists in the table but not in the model
        const [results] = await sequelize.query("SHOW COLUMNS FROM expenses LIKE 'expense_category'");

        if (results.length > 0) {
            console.log('Found expense_category. Migrating data to category...');

            // Check if 'entry_type' exists, add if not
            const [typeExists] = await sequelize.query("SHOW COLUMNS FROM expenses LIKE 'entry_type'");
            if (typeExists.length === 0) {
                await sequelize.query("ALTER TABLE expenses ADD COLUMN entry_type ENUM('INWARD', 'OUTWARD') DEFAULT 'OUTWARD' AFTER expense_date");
            }

            // Check if 'category' exists, add if not
            const [catExists] = await sequelize.query("SHOW COLUMNS FROM expenses LIKE 'category'");
            if (catExists.length === 0) {
                await sequelize.query("ALTER TABLE expenses ADD COLUMN category VARCHAR(100) AFTER entry_type");
            }

            await sequelize.query("UPDATE expenses SET category = expense_category WHERE category IS NULL OR category = ''");
            console.log('Data migrated.');
        }

        await sequelize.sync({ alter: true });
        console.log('Database synced');

        // Set default entry_type for existing records
        await sequelize.query("UPDATE expenses SET entry_type = 'OUTWARD' WHERE entry_type IS NULL");

        process.exit(0);
    } catch (err) {
        console.error('Sync failed', err);
        process.exit(1);
    }
}

sync();
