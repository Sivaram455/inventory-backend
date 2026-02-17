const express = require('express');
const roleController = require('../controllers/roleController');
const authMiddleware = require('../middleware/authMiddleware');

const { checkPrivilege } = require('../middleware/privilegeMiddleware');

const router = express.Router();

router.post('/', authMiddleware, checkPrivilege('Roles', 'add'), roleController.createRole);
router.get('/', authMiddleware, roleController.getAllRoles);
router.get('/:id', authMiddleware, roleController.getRoleById);
router.put('/:id', authMiddleware, checkPrivilege('Roles', 'edit'), roleController.updateRole);
router.delete('/:id', authMiddleware, checkPrivilege('Roles', 'delete'), roleController.deleteRole);

module.exports = router;
