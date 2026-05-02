const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkPrivilege } = require('../middleware/privilegeMiddleware');

router.get('/all', authMiddleware, checkPrivilege('Stock Transfer', 'view'), transferController.getAllTransfers);
router.get('/pending', authMiddleware, checkPrivilege('Stock Transfer', 'view'), transferController.getPendingTransfers);
router.get('/available-stock', authMiddleware, checkPrivilege('Stock Transfer', 'view'), transferController.getAvailableInwardStock);
router.post('/create', authMiddleware, checkPrivilege('Stock Transfer', 'add'), transferController.createTransfer);
router.put('/:id/approve', authMiddleware, checkPrivilege('Stock Transfer', 'edit'), transferController.approveTransfer);

module.exports = router;
