const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkPrivilege } = require('../middleware/privilegeMiddleware');
const upload = require('../middleware/uploadMiddleware');

// All routes require auth
router.use(authMiddleware);

// CRUD
router.get('/sample', checkPrivilege('Petty Cash', 'can_view'), expenseController.downloadSample);
router.post('/upload', checkPrivilege('Petty Cash', 'can_add'), upload.single('file'), expenseController.uploadExcel);
router.get('/', checkPrivilege('Petty Cash', 'can_view'), expenseController.getAll);
router.get('/summary', checkPrivilege('Petty Cash', 'can_view'), expenseController.summary);
router.get('/:id', checkPrivilege('Petty Cash', 'can_view'), expenseController.getById);
router.post('/', checkPrivilege('Petty Cash', 'can_add'), upload.single('image'), expenseController.create);
router.put('/:id', checkPrivilege('Petty Cash', 'can_edit'), upload.single('image'), expenseController.update);
router.delete('/:id', checkPrivilege('Petty Cash', 'can_delete'), expenseController.delete);

module.exports = router;
