const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

const migrations = [
    {
        name: 'add_category_to_attendance',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'category'`,
        run: `ALTER TABLE attendance ADD COLUMN category DECIMAL(2,1) NOT NULL DEFAULT 0.0 AFTER status`
    },
    {
        name: 'add_admin_approved_leave_to_attendance',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'admin_approved_leave'`,
        run: `ALTER TABLE attendance ADD COLUMN admin_approved_leave DECIMAL(2,1) NOT NULL DEFAULT 0.0 AFTER category`
    },
    {
        name: 'add_is_admin_approved_to_attendance',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'is_admin_approved'`,
        run: `ALTER TABLE attendance ADD COLUMN is_admin_approved TINYINT(1) NOT NULL DEFAULT 0 AFTER admin_approved_leave`
    },
    {
        name: 'add_present_days_to_payroll',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'present_days'`,
        run: `ALTER TABLE payroll ADD COLUMN present_days DECIMAL(4,1) NOT NULL DEFAULT 0.0 AFTER deductions`
    },
    {
        name: 'add_approved_leaves_to_payroll',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'approved_leaves'`,
        run: `ALTER TABLE payroll ADD COLUMN approved_leaves DECIMAL(4,1) NOT NULL DEFAULT 0.0 AFTER present_days`
    },
    {
        name: 'add_paid_days_to_payroll',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'paid_days'`,
        run: `ALTER TABLE payroll ADD COLUMN paid_days DECIMAL(4,1) NOT NULL DEFAULT 0.0 AFTER approved_leaves`
    },
    {
        name: 'add_daily_rate_to_payroll',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'payroll' AND COLUMN_NAME = 'daily_rate'`,
        run: `ALTER TABLE payroll ADD COLUMN daily_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER paid_days`
    }
];

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    console.log('Connected to DB:', process.env.DB_NAME);

    for (const m of migrations) {
        const [[{ cnt }]] = await conn.execute(m.check);
        if (cnt > 0) {
            console.log(`[SKIP] ${m.name} — already applied`);
        } else {
            await conn.execute(m.run);
            console.log(`[DONE] ${m.name}`);
        }
    }

    await conn.end();
    console.log('Migration complete.');
})().catch(err => {
    console.error('Migration failed:', err.message);
    process.exit(1);
});
