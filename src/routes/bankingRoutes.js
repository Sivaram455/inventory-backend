const express = require('express');
const router = express.Router();
const bankingController = require('../controllers/bankingController');
const upload = require('../middleware/excelUploadMiddleware');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Corporate Banks
router.get('/banks', bankingController.getBanks);
router.post('/banks', bankingController.createBank);
router.post('/banks/upload', upload.single('file'), bankingController.uploadBanksExcel);
router.get('/banks/download-sample', bankingController.downloadBanksSample);
router.put('/banks/:id', bankingController.updateBank);
router.delete('/banks/:id', bankingController.deleteBank);

// Beneficiaries
router.get('/beneficiaries', bankingController.getBeneficiaries);
router.post('/beneficiaries', bankingController.createBeneficiary);
router.post('/beneficiaries/upload', upload.single('file'), bankingController.uploadBeneficiariesExcel);
router.get('/beneficiaries/download-sample', bankingController.downloadBeneficiariesSample);
router.put('/beneficiaries/:id', bankingController.updateBeneficiary);
router.delete('/beneficiaries/:id', bankingController.deleteBeneficiary);

// Bank Payments (Transactions)
router.get('/payments', bankingController.getPayments);
router.get('/payments/export', bankingController.exportPayments);
router.post('/payments', bankingController.createPayment);
router.post('/payments/upload', upload.single('file'), bankingController.uploadPaymentsExcel);
router.get('/payments/download-sample', bankingController.downloadPaymentsSample);

module.exports = router;
