const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');

router.get('/all', transferController.getAllTransfers);
router.post('/create', transferController.createTransfer);

module.exports = router;
