const express = require('express');
const roleController = require('../controllers/roleController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', authMiddleware, roleController.createRole);
router.get('/', authMiddleware, roleController.getAllRoles);
router.get('/:id', authMiddleware, roleController.getRoleById);
router.put('/:id', authMiddleware, roleController.updateRole);
router.delete('/:id', authMiddleware, roleController.deleteRole);

module.exports = router;
