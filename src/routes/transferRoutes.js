const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');

const authMiddleware = require('../middleware/authMiddleware');
const { checkPrivilege } = require('../middleware/privilegeMiddleware');

router.get('/all', authMiddleware, checkPrivilege('Stock Transfer', 'view'), transferController.getAllTransfers);
router.post('/create', authMiddleware, checkPrivilege('Stock Transfer', 'add'), transferController.createTransfer);

module.exports = router;
