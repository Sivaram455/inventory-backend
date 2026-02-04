const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Scan
router.get('/scan', inventoryController.getItemByBarcode);
router.get('/items', inventoryController.getAllItems);

// Transactions
// Transactions
router.post('/inward', inventoryController.createInward);
router.post('/outward', inventoryController.createOutward);
router.get('/inward', inventoryController.getInwardHistory);
router.get('/outward', inventoryController.getOutwardHistory);

// Bulk Excel Upload
router.post('/inward/upload', upload.single('file'), inventoryController.uploadInwardExcel);
router.post('/outward/upload', upload.single('file'), inventoryController.uploadOutwardExcel);

module.exports = router;
