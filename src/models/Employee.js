const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Employee = sequelize.define('Employee', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.BIGINT, allowNull: false },
    employee_code: { type: DataTypes.STRING(50), allowNull: false },
    designation: { type: DataTypes.STRING(100) },
    department: { type: DataTypes.STRING(100) },
    employment_type: { type: DataTypes.STRING(50) }, // full-time, part-time, contract
    date_of_joining: { type: DataTypes.DATEONLY },
    date_of_exit: { type: DataTypes.DATEONLY },
    salary_type: { type: DataTypes.STRING(50) }, // monthly, hourly
    basic_salary: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
    status: { type: DataTypes.STRING(50), defaultValue: 'ACTIVE' },
    created_by: { type: DataTypes.BIGINT },
    updated_by: { type: DataTypes.BIGINT },
}, {
    tableName: 'employees',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = Employee;
