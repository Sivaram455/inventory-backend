const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Categories
router.get('/categories', productController.getCategories);
router.post('/categories', productController.createCategory);
router.put('/categories/:id', productController.updateCategory);
router.delete('/categories/:id', productController.deleteCategory);

// Units
router.get('/units', productController.getUnits);
router.post('/units', productController.createUnit);
router.put('/units/:id', productController.updateUnit);
router.delete('/units/:id', productController.deleteUnit);

const upload = require('../middleware/uploadMiddleware');

// Products
router.get('/products', productController.getProducts);
router.post('/products', upload.single('product_image'), productController.createProduct);
router.post('/upload', upload.single('file'), productController.uploadProductExcel);
router.get('/download-sample', productController.getSampleExcel);
router.put('/products/:id', upload.single('product_image'), productController.updateProduct);
router.delete('/products/:id', productController.deleteProduct);

module.exports = router;
