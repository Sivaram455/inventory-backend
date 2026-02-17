const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const authMiddleware = require('../middleware/authMiddleware');
const { checkPrivilege } = require('../middleware/privilegeMiddleware');

// Inventory
router.get('/items', authMiddleware, checkPrivilege('Master Inventory', 'view'), inventoryController.getAllItems);
router.get('/scan', authMiddleware, checkPrivilege('Master Inventory', 'view'), inventoryController.getItemByBarcode);

// Transactions
router.post('/inward', authMiddleware, checkPrivilege('Inward Register', 'add'), inventoryController.createInward);
router.post('/outward', authMiddleware, checkPrivilege('Outward Register', 'add'), inventoryController.createOutward);
router.get('/inward', authMiddleware, checkPrivilege('Inward Register', 'view'), inventoryController.getInwardHistory);
router.get('/outward', authMiddleware, checkPrivilege('Outward Register', 'view'), inventoryController.getOutwardHistory);

// Bulk Excel Upload
router.post('/inward/upload', authMiddleware, checkPrivilege('Inward Register', 'add'), upload.single('file'), inventoryController.uploadInwardExcel);
router.post('/outward/upload', authMiddleware, checkPrivilege('Outward Register', 'add'), upload.single('file'), inventoryController.uploadOutwardExcel);

// Sample File Download
router.get('/inward/sample', authMiddleware, checkPrivilege('Inward Register', 'view'), inventoryController.downloadInwardSample);
router.get('/outward/sample', authMiddleware, checkPrivilege('Outward Register', 'view'), inventoryController.downloadOutwardSample);

module.exports = router;
