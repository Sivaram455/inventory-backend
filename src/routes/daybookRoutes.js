const express = require('express');
const router = express.Router();
const daybookController = require('../controllers/daybookController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkPrivilege } = require('../middleware/privilegeMiddleware');

// Daybook Routes
router.get('/', authMiddleware, checkPrivilege('Daybook', 'view'), daybookController.getAllEntries);
router.get('/:id', authMiddleware, checkPrivilege('Daybook', 'view'), daybookController.getEntryById);
router.post('/', authMiddleware, checkPrivilege('Daybook', 'add'), daybookController.createEntry);
router.put('/:id', authMiddleware, checkPrivilege('Daybook', 'edit'), daybookController.updateEntry);
router.delete('/:id', authMiddleware, checkPrivilege('Daybook', 'delete'), daybookController.deleteEntry);

module.exports = router;
