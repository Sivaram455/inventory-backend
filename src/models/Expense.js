const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Expense = sequelize.define('Expense', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    expense_date: { type: DataTypes.DATEONLY, allowNull: false },
    expense_category: { type: DataTypes.STRING(100) }, // FOOD, TRAVEL, OFFICE, INTERNET
    description: { type: DataTypes.STRING(255) },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    payment_mode: { type: DataTypes.STRING(50) }, // CASH, UPI, CARD
    paid_to: { type: DataTypes.STRING(100) },
    reference_no: { type: DataTypes.STRING(100) }, // bill no / txn id
    payment_url: { type: DataTypes.STRING(50) },
    image_url: { type: DataTypes.STRING(500) },
    created_by: { type: DataTypes.BIGINT },
    updated_by: { type: DataTypes.BIGINT },
}, {
    tableName: 'expenses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Expense;
