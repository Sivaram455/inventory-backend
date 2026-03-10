const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const authMiddleware = require('../middleware/authMiddleware');

const upload = require('../middleware/uploadMiddleware');

router.use(authMiddleware);

const vendorUpload = upload.fields([
    { name: 'catlog_file', maxCount: 1 },
    { name: 'price_file', maxCount: 1 },
    { name: 'image_file', maxCount: 1 }
]);

router.get('/', vendorController.getAll);
router.get('/:id', vendorController.getById);
router.post('/', vendorUpload, vendorController.create);
router.put('/:id', vendorUpload, vendorController.update);
router.delete('/:id', vendorController.delete);

module.exports = router;
