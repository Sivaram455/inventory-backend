const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Beneficiary = sequelize.define('Beneficiary', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    beneficiary_type: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    beneficiary_name: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    business_code: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    bank_name: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    ifsc_code: {
        type: DataTypes.STRING(20),
        allowNull: false
    },
    bank_account_no: {
        type: DataTypes.STRING(30),
        allowNull: false
    },
    pan: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    mobile_no: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    nature_of_account: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    account_type: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(20),
        defaultValue: 'active'
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'beneficiaries',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            unique: true,
            fields: ['beneficiary_name', 'bank_account_no']
        }
    ]
});

module.exports = Beneficiary;
