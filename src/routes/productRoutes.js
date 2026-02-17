const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

const authMiddleware = require('../middleware/authMiddleware');
const { checkPrivilege } = require('../middleware/privilegeMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Categories
router.get('/categories', authMiddleware, checkPrivilege('Categories', 'view'), productController.getCategories);
router.post('/categories', authMiddleware, checkPrivilege('Categories', 'add'), productController.createCategory);
router.put('/categories/:id', authMiddleware, checkPrivilege('Categories', 'edit'), productController.updateCategory);
router.delete('/categories/:id', authMiddleware, checkPrivilege('Categories', 'delete'), productController.deleteCategory);

// Units
router.get('/units', authMiddleware, checkPrivilege('Units', 'view'), productController.getUnits);
router.post('/units', authMiddleware, checkPrivilege('Units', 'add'), productController.createUnit);
router.put('/units/:id', authMiddleware, checkPrivilege('Units', 'edit'), productController.updateUnit);
router.delete('/units/:id', authMiddleware, checkPrivilege('Units', 'delete'), productController.deleteUnit);

// Products
router.get('/products', authMiddleware, checkPrivilege('Product Master', 'view'), productController.getProducts);
router.post('/products', authMiddleware, checkPrivilege('Product Master', 'add'), upload.single('product_image'), productController.createProduct);
router.post('/upload', authMiddleware, checkPrivilege('Product Master', 'add'), upload.single('file'), productController.uploadProductExcel);
router.get('/download-sample', authMiddleware, checkPrivilege('Product Master', 'view'), productController.getSampleExcel);
router.put('/products/:id', authMiddleware, checkPrivilege('Product Master', 'edit'), upload.single('product_image'), productController.updateProduct);
router.delete('/products/:id', authMiddleware, checkPrivilege('Product Master', 'delete'), productController.deleteProduct);

module.exports = router;
