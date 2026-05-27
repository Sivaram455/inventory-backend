const express = require('express');
const hrController = require('../controllers/hrController');
const authMiddleware = require('../middleware/authMiddleware');
const { checkPrivilege } = require('../middleware/privilegeMiddleware');
const excelUploadMiddleware = require('../middleware/excelUploadMiddleware');

const router = express.Router();

// Employee Management
router.get('/employees', authMiddleware, checkPrivilege('Staff Master', 'view'), hrController.getAllEmployees);
router.post('/employees', authMiddleware, checkPrivilege('Staff Master', 'add'), hrController.createEmployee);
router.get('/employees/template', authMiddleware, checkPrivilege('Staff Master', 'add'), hrController.downloadEmployeeTemplate);
router.post('/employees/upload', authMiddleware, checkPrivilege('Staff Master', 'add'), excelUploadMiddleware.single('file'), hrController.uploadEmployeeExcel);
router.put('/employees/:id', authMiddleware, checkPrivilege('Staff Master', 'edit'), hrController.updateEmployee);

// Attendance Management
router.get('/attendance', authMiddleware, checkPrivilege('Attendance', 'view'), hrController.getAttendanceByDate);
router.post('/attendance', authMiddleware, checkPrivilege('Attendance', 'add'), hrController.markAttendance);
router.get('/attendance/template', authMiddleware, checkPrivilege('Attendance', 'add'), hrController.downloadAttendanceTemplate);
router.post('/attendance/upload', authMiddleware, checkPrivilege('Attendance', 'add'), excelUploadMiddleware.single('file'), hrController.uploadAttendanceExcel);
router.put('/attendance/:id/override', authMiddleware, checkPrivilege('Attendance', 'edit'), hrController.updateAdminOverride);

// Payroll Management
router.get('/payroll', authMiddleware, checkPrivilege('Payroll', 'view'), hrController.getPayrollByMonth);
router.post('/payroll/generate', authMiddleware, checkPrivilege('Payroll', 'add'), hrController.generatePayroll);
router.put('/payroll/:id/status', authMiddleware, checkPrivilege('Payroll', 'edit'), hrController.updatePayrollStatus);
router.get('/payroll/download/excel', authMiddleware, checkPrivilege('Payroll', 'view'), hrController.downloadPayrollExcel);
router.get('/payroll/download/pdf', authMiddleware, checkPrivilege('Payroll', 'view'), hrController.downloadPayrollPDF);

// Leave Management
router.get('/leaves', authMiddleware, checkPrivilege('Leave Management', 'view'), hrController.getAllLeaves);
router.post('/leaves/apply', authMiddleware, hrController.applyLeave);
router.put('/leaves/:id/status', authMiddleware, checkPrivilege('Leave Management', 'edit'), hrController.updateLeaveStatus);

module.exports = router;
