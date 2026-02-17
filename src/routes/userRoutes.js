const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

const { checkPrivilege } = require('../middleware/privilegeMiddleware');

const router = express.Router();

router.post('/register', userController.register);
router.post('/login', userController.login);

// Profile routes (no privilege check - users can access their own profile)
router.get('/profile/me', authMiddleware, userController.getCurrentUser);
router.put('/profile/change-password', authMiddleware, userController.changePassword);

// User management routes (requires privileges)
router.get('/', authMiddleware, checkPrivilege('Staff Master', 'view'), userController.getAllUsers);
router.get('/:id', authMiddleware, checkPrivilege('Staff Master', 'view'), userController.getUserById);
router.put('/:id', authMiddleware, checkPrivilege('Staff Master', 'edit'), userController.updateUser);
router.delete('/:id', authMiddleware, checkPrivilege('Staff Master', 'delete'), userController.deleteUser);

module.exports = router;
