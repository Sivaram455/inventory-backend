const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/serviceCatalogController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', ctrl.getAll);
router.get('/active', ctrl.getActive);
router.get('/categories', ctrl.getCategories);
router.post('/seed', ctrl.seed);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
