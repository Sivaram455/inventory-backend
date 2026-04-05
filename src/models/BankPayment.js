const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BankPayment = sequelize.define('BankPayment', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    beneficiary_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    batch_id: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    file_name: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    upload_date: {
        type: DataTypes.DATE,
        allowNull: false
    },
    type_of_account: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false
    },
    vendor_name: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    credit_account_number: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    ifsc_code: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    nature_of_account: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    vendor_contact_number: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    payment_remarks: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    debit_account_number: {
        type: DataTypes.STRING(30),
        allowNull: true
    },
    sequential_number: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    payment_status: {
        type: DataTypes.STRING(50),
        defaultValue: 'draft'
    },
    payment_declined_reason: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    utr_number: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    processed_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
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
    tableName: 'bank_payments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = BankPayment;
