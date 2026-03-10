const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Attendance = sequelize.define('Attendance', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    employee_id: { type: DataTypes.BIGINT, allowNull: false },
    attendance_date: { type: DataTypes.DATEONLY, allowNull: false },
    check_in_time: { type: DataTypes.TIME },
    check_out_time: { type: DataTypes.TIME },
    working_hours: { type: DataTypes.DECIMAL(5, 2) },
    status: { type: DataTypes.STRING(50) }, // PRESENT, ABSENT, HALF_DAY, LEAVE
    remarks: { type: DataTypes.STRING(255) },
}, {
    tableName: 'attendance',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        { unique: true, fields: ['employee_id', 'attendance_date'], name: 'uq_employee_date' }
    ],
});

module.exports = Attendance;
