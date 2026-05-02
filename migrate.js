const mysql = require('mysql2/promise');
require('dotenv').config({ path: './.env' });

const migrations = [
    // ── Attendance / Payroll (existing) ──────────────────────────────────────
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
    },

    // ── New: warehouses table ─────────────────────────────────────────────────
    {
        name: 'create_warehouses_table',
        check: `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'warehouses'`,
        run: `
            CREATE TABLE warehouses (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                code VARCHAR(50) NOT NULL UNIQUE,
                address TEXT,
                status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
                created_by BIGINT,
                updated_by BIGINT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `
    },

    // ── New: warehouse_racks table ────────────────────────────────────────────
    {
        name: 'create_warehouse_racks_table',
        check: `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'warehouse_racks'`,
        run: `
            CREATE TABLE warehouse_racks (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                warehouse_id BIGINT NOT NULL,
                rack_code VARCHAR(50) NOT NULL,
                rack_name VARCHAR(100) NOT NULL,
                status ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
                created_by BIGINT,
                updated_by BIGINT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_wr_warehouse (warehouse_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `
    },

    // ── New: warehouse_stock table ────────────────────────────────────────────
    {
        name: 'create_warehouse_stock_table',
        check: `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'warehouse_stock'`,
        run: `
            CREATE TABLE warehouse_stock (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                warehouse_id BIGINT NOT NULL,
                rack_id BIGINT DEFAULT NULL,
                product_item_id BIGINT NOT NULL,
                available_quantity DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                created_by BIGINT,
                updated_by BIGINT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_ws (warehouse_id, rack_id, product_item_id),
                INDEX idx_ws_warehouse (warehouse_id),
                INDEX idx_ws_product (product_item_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `
    },

    // ── Alter inward_register: add warehouse_id, rack_id ─────────────────────
    {
        name: 'add_warehouse_id_to_inward_register',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'inward_register' AND COLUMN_NAME = 'warehouse_id'`,
        run: `ALTER TABLE inward_register ADD COLUMN warehouse_id BIGINT DEFAULT NULL AFTER remarks`
    },
    {
        name: 'add_rack_id_to_inward_register',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'inward_register' AND COLUMN_NAME = 'rack_id'`,
        run: `ALTER TABLE inward_register ADD COLUMN rack_id BIGINT DEFAULT NULL AFTER warehouse_id`
    },

    // ── Alter outward_register: add warehouse_id, rack_id ────────────────────
    {
        name: 'add_warehouse_id_to_outward_register',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'outward_register' AND COLUMN_NAME = 'warehouse_id'`,
        run: `ALTER TABLE outward_register ADD COLUMN warehouse_id BIGINT DEFAULT NULL AFTER remarks`
    },
    {
        name: 'add_rack_id_to_outward_register',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'outward_register' AND COLUMN_NAME = 'rack_id'`,
        run: `ALTER TABLE outward_register ADD COLUMN rack_id BIGINT DEFAULT NULL AFTER warehouse_id`
    },

    // ── Alter stock_transfers: add new fields ─────────────────────────────────
    {
        name: 'add_location_mode_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'location_mode'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN location_mode ENUM('auto','manual') NOT NULL DEFAULT 'auto' AFTER product_item_id`
    },
    {
        name: 'add_from_warehouse_id_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'from_warehouse_id'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN from_warehouse_id BIGINT DEFAULT NULL AFTER location_mode`
    },
    {
        name: 'add_from_rack_id_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'from_rack_id'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN from_rack_id BIGINT DEFAULT NULL AFTER from_warehouse_id`
    },
    {
        name: 'add_to_warehouse_id_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'to_warehouse_id'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN to_warehouse_id BIGINT DEFAULT NULL AFTER from_rack_id`
    },
    {
        name: 'add_to_rack_id_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'to_rack_id'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN to_rack_id BIGINT DEFAULT NULL AFTER to_warehouse_id`
    },
    {
        name: 'add_quantity_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'quantity'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00 AFTER to_rack_id`
    },
    {
        name: 'add_batch_id_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'batch_id'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN batch_id VARCHAR(100) DEFAULT NULL AFTER quantity`
    },
    {
        name: 'add_imei_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'imei'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN imei VARCHAR(100) DEFAULT NULL AFTER batch_id`
    },

    // ── NEW MIGRATIONS: Serial Number Support ─────────────────────────────────
    {
        name: 'add_serial_number_to_product_items',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'product_items' AND COLUMN_NAME = 'serial_number'`,
        run: `ALTER TABLE product_items ADD COLUMN serial_number VARCHAR(100) DEFAULT NULL AFTER imei`
    },
    {
        name: 'add_serial_number_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'serial_number'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN serial_number VARCHAR(100) DEFAULT NULL AFTER imei`
    },

    // ── NEW: Stock Transfer Approvals Table ───────────────────────────────────
    {
        name: 'create_stock_transfer_approvals_table',
        check: `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfer_approvals'`,
        run: `
            CREATE TABLE stock_transfer_approvals (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                transfer_id BIGINT NOT NULL,
                approved_by BIGINT NOT NULL,
                approval_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
                approval_date DATETIME DEFAULT NULL,
                remarks TEXT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_transfer (transfer_id),
                INDEX idx_approver (approved_by)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `
    },
    {
        name: 'add_approval_status_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'approval_status'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN approval_status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'APPROVED' AFTER transfer_by`
    },
    {
        name: 'add_approved_by_to_stock_transfers',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfers' AND COLUMN_NAME = 'approved_by'`,
        run: `ALTER TABLE stock_transfers ADD COLUMN approved_by BIGINT DEFAULT NULL AFTER approval_status`
    },

    // ── NEW: Stock Transfer Items Table (for multi-IMEI support) ──────────────
    {
        name: 'create_stock_transfer_items_table',
        check: `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'stock_transfer_items'`,
        run: `
            CREATE TABLE stock_transfer_items (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                transfer_id BIGINT NOT NULL,
                product_item_id BIGINT NOT NULL,
                imei VARCHAR(100) DEFAULT NULL,
                serial_number VARCHAR(100) DEFAULT NULL,
                batch_id VARCHAR(100) DEFAULT NULL,
                quantity DECIMAL(10,2) NOT NULL DEFAULT 1.00,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_transfer (transfer_id),
                INDEX idx_product_item (product_item_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `
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
