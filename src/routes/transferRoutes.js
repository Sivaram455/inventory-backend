const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkPrivilege } = require('../middleware/privilegeMiddleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.get('/all', authMiddleware, checkPrivilege('Stock Transfer', 'view'), transferController.getAllTransfers);
router.get('/pending', authMiddleware, checkPrivilege('Stock Transfer', 'view'), transferController.getPendingTransfers);
router.get('/available-stock', authMiddleware, checkPrivilege('Stock Transfer', 'view'), transferController.getAvailableInwardStock);
router.post('/create', authMiddleware, checkPrivilege('Stock Transfer', 'add'), transferController.createTransfer);
router.put('/:id/approve', authMiddleware, checkPrivilege('Stock Transfer', 'edit'), transferController.approveTransfer);

// Bulk transfer templates and upload
router.get('/sample', authMiddleware, checkPrivilege('Stock Transfer', 'view'), transferController.downloadTransferSample);
router.post('/upload', authMiddleware, checkPrivilege('Stock Transfer', 'add'), upload.single('file'), transferController.uploadTransferExcel);

module.exports = router;
