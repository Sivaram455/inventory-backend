const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Leave = sequelize.define('Leave', {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    employee_id: { type: DataTypes.BIGINT, allowNull: false },
    leave_type: { type: DataTypes.STRING(50) }, // CASUAL, SICK, PAID
    from_date: { type: DataTypes.DATEONLY },
    to_date: { type: DataTypes.DATEONLY },
    total_days: { type: DataTypes.DECIMAL(4, 1) },
    status: { type: DataTypes.STRING(50), defaultValue: 'APPLIED' }, // APPLIED, APPROVED, REJECTED
    applied_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    approved_by: { type: DataTypes.BIGINT },
}, {
    tableName: 'leaves',
    timestamps: false,
});

module.exports = Leave;
