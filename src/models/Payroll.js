const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payroll = sequelize.define('Payroll', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    employee_id: { type: DataTypes.BIGINT, allowNull: false },
    payroll_month: { type: DataTypes.STRING(7), allowNull: false }, // YYYY-MM
    basic_salary: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    hra: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    allowances: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    deductions: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    tax: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    present_days: { type: DataTypes.DECIMAL(4, 1), defaultValue: 0 },
    approved_leaves: { type: DataTypes.DECIMAL(4, 1), defaultValue: 0 },
    paid_days: { type: DataTypes.DECIMAL(4, 1), defaultValue: 0 },
    daily_rate: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    net_salary: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    payment_status: { type: DataTypes.STRING(50) }, // PAID / PENDING
    payment_date: { type: DataTypes.DATEONLY },
    generated_by: { type: DataTypes.BIGINT },
}, {
    tableName: 'payroll',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { unique: true, fields: ['employee_id', 'payroll_month'], name: 'uq_employee_month' }
    ],
});

module.exports = Payroll;
