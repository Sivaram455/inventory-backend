const express = require('express');
const hrController = require('../controllers/hrController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkPrivilege } = require('../middleware/privilegeMiddleware');
const excelUploadMiddleware = require('../middleware/excelUploadMiddleware');

const router = express.Router();

// Employee Management
router.get('/employees', authMiddleware, checkPrivilege('Staff Master', 'view'), hrController.getAllEmployees);
router.post('/employees', authMiddleware, checkPrivilege('Staff Master', 'add'), hrController.createEmployee);
router.put('/employees/:id', authMiddleware, checkPrivilege('Staff Master', 'edit'), hrController.updateEmployee);

// Attendance Management
router.get('/attendance', authMiddleware, checkPrivilege('Attendance', 'view'), hrController.getAttendanceByDate);
router.post('/attendance', authMiddleware, checkPrivilege('Attendance', 'add'), hrController.markAttendance);
router.post('/attendance/upload', authMiddleware, checkPrivilege('Attendance', 'add'), excelUploadMiddleware.single('file'), hrController.uploadAttendanceExcel);
router.put('/attendance/:id/override', authMiddleware, checkPrivilege('Attendance', 'edit'), hrController.updateAdminOverride);

// Payroll Management
router.get('/payroll', authMiddleware, checkPrivilege('Payroll', 'view'), hrController.getPayrollByMonth);
router.post('/payroll/generate', authMiddleware, checkPrivilege('Payroll', 'add'), hrController.generatePayroll);

// Leave Management
router.get('/leaves', authMiddleware, checkPrivilege('Leave Management', 'view'), hrController.getAllLeaves);
router.post('/leaves/apply', authMiddleware, hrController.applyLeave);
router.put('/leaves/:id/status', authMiddleware, checkPrivilege('Leave Management', 'edit'), hrController.updateLeaveStatus);

module.exports = router;
