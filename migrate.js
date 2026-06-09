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
        name: 'add_vendor_id_to_inward_register',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'inward_register' AND COLUMN_NAME = 'vendor_id'`,
        run: `ALTER TABLE inward_register ADD COLUMN vendor_id INT UNSIGNED DEFAULT NULL AFTER rack_id`
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
    },

    // ── NEW: Add comments field to leaves table ───────────────────────────────
    {
        name: 'add_comments_to_leaves',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'leaves' AND COLUMN_NAME = 'comments'`,
        run: `ALTER TABLE leaves ADD COLUMN comments TEXT DEFAULT NULL AFTER total_days`
    },

    // ── NEW: Add lot_number field to product_items table ───────────────────────────
    {
        name: 'add_lot_number_to_product_items',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'product_items' AND COLUMN_NAME = 'lot_number'`,
        run: `ALTER TABLE product_items ADD COLUMN lot_number VARCHAR(100) DEFAULT NULL AFTER batch_id`
    },

    // ── NEW: Add unit_id to product_master table ──────────────────────────────
    {
        name: 'add_unit_id_to_product_master',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'product_master' AND COLUMN_NAME = 'unit_id'`,
        run: `ALTER TABLE product_master ADD COLUMN unit_id BIGINT NULL AFTER pack_size`
    },
    {
        name: 'add_check_in_time_to_attendance',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'check_in_time'`,
        run: `ALTER TABLE attendance ADD COLUMN check_in_time TIME NULL AFTER attendance_date`
    },
    {
        name: 'add_check_out_time_to_attendance',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'check_out_time'`,
        run: `ALTER TABLE attendance ADD COLUMN check_out_time TIME NULL AFTER check_in_time`
    },
    {
        name: 'add_working_hours_to_attendance',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'working_hours'`,
        run: `ALTER TABLE attendance ADD COLUMN working_hours DECIMAL(5,2) DEFAULT 0.00 AFTER check_out_time`
    },
    {
        name: 'add_shift_times_to_employees',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'shift_start'`,
        run: `ALTER TABLE employees ADD COLUMN shift_start TIME DEFAULT '09:00:00' AFTER basic_salary, ADD COLUMN shift_end TIME DEFAULT '18:00:00' AFTER shift_start`
    },
    {
        name: 'add_new_fields_to_vendors_v2',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'vendors' AND COLUMN_NAME = 'account_number'`,
        run: `ALTER TABLE vendors 
              ADD COLUMN account_number VARCHAR(50) NULL AFTER gst_number,
              ADD COLUMN ifsc_code VARCHAR(20) NULL AFTER account_number`
    },
    {
        name: 'create_daybook_table',
        check: `SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'daybook'`,
        run: `
            CREATE TABLE daybook (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                entry_date DATE NOT NULL,
                entry_time TIME DEFAULT NULL,
                vehicle_no VARCHAR(50) DEFAULT NULL,
                model_id BIGINT DEFAULT NULL,
                car_color VARCHAR(100) DEFAULT NULL,
                incharge_person VARCHAR(150) DEFAULT NULL,
                vin_number VARCHAR(100) DEFAULT NULL,
                expected_delivery_date DATE DEFAULT NULL,
                service_description TEXT DEFAULT NULL,
                delivery_date DATE DEFAULT NULL,
                delivery_by VARCHAR(150) DEFAULT NULL,
                ppf_type VARCHAR(100) DEFAULT NULL,
                ppf_sl_no VARCHAR(100) DEFAULT NULL,
                sunfilm_type VARCHAR(100) DEFAULT NULL,
                microfiber_internal VARCHAR(100) DEFAULT NULL,
                dash_camera VARCHAR(100) DEFAULT NULL,
                microfiber_customer VARCHAR(100) DEFAULT NULL,
                comments TEXT DEFAULT NULL,
                dismantling_assemble VARCHAR(255) DEFAULT NULL,
                inspection_in_by VARCHAR(150) DEFAULT NULL,
                inspection_out_by VARCHAR(150) DEFAULT NULL,
                wastage VARCHAR(255) DEFAULT NULL,
                audi_direct_billing VARCHAR(255) DEFAULT NULL,
                paint_purchases VARCHAR(255) DEFAULT NULL,
                paint_amt DECIMAL(12,2) DEFAULT 0.00,
                created_by BIGINT DEFAULT NULL,
                updated_by BIGINT DEFAULT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_daybook_model (model_id),
                CONSTRAINT fk_daybook_vehicle_type FOREIGN KEY (model_id) REFERENCES vehicle_type(id) ON DELETE SET NULL ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `
    },
    {
        name: 'add_parts_and_sunfilms_to_vehicle_usage',
        check: `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = '${process.env.DB_NAME}' AND TABLE_NAME = 'vehicle_usage' AND COLUMN_NAME = 'ppf_parts'`,
        run: `ALTER TABLE vehicle_usage 
              ADD COLUMN ppf_parts JSON DEFAULT NULL, 
              ADD COLUMN sunfilm_matrix JSON DEFAULT NULL`
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
