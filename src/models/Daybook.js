const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Daybook = sequelize.define('Daybook', {
    id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true
    },
    entry_date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    entry_time: {
        type: DataTypes.TIME,
        allowNull: true
    },
    vehicle_no: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    model_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
            model: 'vehicle_type',
            key: 'id'
        }
    },
    car_color: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    incharge_person: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    vin_number: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    expected_delivery_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    service_description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    delivery_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    delivery_by: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    ppf_type: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    ppf_sl_no: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    sunfilm_type: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    microfiber_internal: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    dash_camera: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    microfiber_customer: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    comments: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    dismantling_assemble: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    inspection_in_by: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    inspection_out_by: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    wastage: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    audi_direct_billing: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    paint_purchases: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    paint_amt: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
        defaultValue: 0.00
    },
    created_by: {
        type: DataTypes.BIGINT,
        allowNull: true
    },
    updated_by: {
        type: DataTypes.BIGINT,
        allowNull: true
    }
}, {
    tableName: 'daybook',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Daybook;
