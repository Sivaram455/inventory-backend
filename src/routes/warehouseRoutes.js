const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkPrivilege } = require('../middleware/privilegeMiddleware');

// Warehouse CRUD
router.get('/', authMiddleware, checkPrivilege('Warehouse', 'view'), warehouseController.getAllWarehouses);
router.post('/', authMiddleware, checkPrivilege('Warehouse', 'add'), warehouseController.createWarehouse);

// Static routes BEFORE dynamic /:id routes to avoid param conflicts
router.get('/stock/summary', authMiddleware, checkPrivilege('Warehouse', 'view'), warehouseController.getStockSummary);
router.post('/racks', authMiddleware, checkPrivilege('Warehouse', 'add'), warehouseController.createRack);
router.put('/racks/:id', authMiddleware, checkPrivilege('Warehouse', 'edit'), warehouseController.updateRack);
router.delete('/racks/:id', authMiddleware, checkPrivilege('Warehouse', 'delete'), warehouseController.deleteRack);

// Dynamic routes
router.put('/:id', authMiddleware, checkPrivilege('Warehouse', 'edit'), warehouseController.updateWarehouse);
router.delete('/:id', authMiddleware, checkPrivilege('Warehouse', 'delete'), warehouseController.deleteWarehouse);
router.get('/:warehouse_id/racks', authMiddleware, checkPrivilege('Warehouse', 'view'), warehouseController.getRacksByWarehouse);
router.get('/:warehouse_id/stock', authMiddleware, checkPrivilege('Warehouse', 'view'), warehouseController.getWarehouseStock);

module.exports = router;
