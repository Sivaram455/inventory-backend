const { Employee, Attendance, Payroll, Leave, User } = require('../models');
const { Op } = require('sequelize');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');


class HRController {
    // Employee Management
    async getAllEmployees(req, res, next) {
        try {
            const employees = await Employee.findAll({
                include: [{ model: User, attributes: ['name', 'email', 'mobile_number'] }]
            });
            res.status(200).json({ success: true, data: employees });
        } catch (error) {
            console.error('SERVER_ERROR [getAllEmployees]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async createEmployee(req, res, next) {
        try {
            const { name, email, phone, password, employee_code, designation, department, employment_type, date_of_joining, salary_type, basic_salary } = req.body;
            let { user_id } = req.body;

            if (!user_id) {
                const [user, created] = await User.findOrCreate({
                    where: { email },
                    defaults: {
                        name,
                        mobile_number: phone,
                        password: password || 'Staff@123',
                        role_id: 3,
                        created_by: req.user.id
                    }
                });
                user_id = user.id;
            }

            const employee = await Employee.create({
                user_id,
                employee_code: employee_code || `EMP${Date.now()}`,
                designation,
                department,
                employment_type,
                date_of_joining,
                salary_type,
                basic_salary: basic_salary || 0,
                created_by: req.user.id
            });
            res.status(201).json({ success: true, data: employee });
        } catch (error) {
            console.error('SERVER_ERROR [createEmployee]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateEmployee(req, res, next) {
        try {
            const { id } = req.params;
            const employee = await Employee.findByPk(id);
            if (!employee) return res.status(404).json({ message: 'Employee not found' });

            const { basic_salary } = req.body;
            await employee.update({
                ...req.body,
                basic_salary: basic_salary !== undefined ? basic_salary : employee.basic_salary,
                updated_by: req.user.id
            });
            res.status(200).json({ success: true, data: employee });
        } catch (error) {
            console.error('SERVER_ERROR [updateEmployee]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Attendance Management
    async markAttendance(req, res, next) {
        try {
            const { attendance_date, marks } = req.body;
            const results = [];
            const statusToPresence = { 'PRESENT': 1.0, 'HALF_DAY': 0.5, 'ABSENT': 0.0, 'LEAVE': 0.0 };

            for (const mark of marks) {
                const [record, created] = await Attendance.findOrCreate({
                    where: { employee_id: mark.employee_id, attendance_date },
                    defaults: { status: mark.status, remarks: mark.remarks }
                });
                if (!created) {
                    await record.update({ status: mark.status, remarks: mark.remarks });
                }
                results.push(record);
            }
            res.status(200).json({ success: true, data: results });
        } catch (error) {
            console.error('SERVER_ERROR [markAttendance]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getAttendanceByDate(req, res, next) {
        try {
            const { date, month, employee_id } = req.query;
            const where = {};
            
            if (date) {
                where.attendance_date = date;
            } else if (month) {
                const year = parseInt(month.split('-')[0]);
                const m = parseInt(month.split('-')[1]);
                const startDate = `${month}-01`;
                const lastDay = new Date(year, m, 0).getDate();
                const endDate = `${month}-${lastDay}`;
                where.attendance_date = { [Op.between]: [startDate, endDate] };
            }

            if (employee_id && employee_id !== 'undefined' && employee_id !== '') {
                where.employee_id = Number(employee_id);
            }

            const records = await Attendance.findAll({
                where,
                include: [{ model: Employee, include: [{ model: User, attributes: ['name'] }] }],
                order: [['attendance_date', 'ASC']]
            });
            res.status(200).json({ success: true, data: records });
        } catch (error) {
            console.error('SERVER_ERROR [getAttendanceByDate]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updatePayrollStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { payment_status, payment_date } = req.body;
            const payroll = await Payroll.findByPk(id);
            if (!payroll) return res.status(404).json({ success: false, message: 'Payroll record not found' });

            await payroll.update({
                payment_status,
                payment_date: payment_status === 'PAID' ? (payment_date || new Date()) : payroll.payment_date
            });
            res.status(200).json({ success: true, data: payroll });
        } catch (error) {
            console.error('SERVER_ERROR [updatePayrollStatus]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async uploadAttendanceExcel(req, res, next) {
        try {
            if (!req.file) return res.status(400).json({ message: 'Excel file is required' });

            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = xlsx.utils.sheet_to_json(sheet);

            const results = [];
            for (const row of rows) {
                const employeeCode = row.Employee_Code || row.Code || row.employee_code;
                const date = row.Date || row.date;
                const inTime = row.In_Time || row.InTime || row.in_time;
                const outTime = row.Out_Time || row.OutTime || row.out_time;

                if (!employeeCode || !date) continue;

                const employee = await Employee.findOne({ where: { employee_code: String(employeeCode) } });
                if (!employee) continue;

                let workingHours = 0;
                if (inTime && outTime) {
                    const toHours = (t) => {
                        if (typeof t === 'number') return t * 24; // Excel serial time
                        const [h, m] = String(t).split(':').map(Number);
                        return h + (m / 60);
                    };
                    workingHours = toHours(outTime) - toHours(inTime);
                }

                let category = 0;
                let status = 'ABSENT';
                if (workingHours >= 8) {
                    category = 1.0;
                    status = 'PRESENT';
                } else if (workingHours >= 4) {
                    category = 0.5;
                    status = 'HALF_DAY';
                }

                const [record, created] = await Attendance.findOrCreate({
                    where: { employee_id: employee.id, attendance_date: date },
                    defaults: {
                        check_in_time: String(inTime),
                        check_out_time: String(outTime),
                        working_hours: Math.round(workingHours * 100) / 100,
                        status
                    }
                });

                if (!created) {
                    await record.update({
                        check_in_time: String(inTime),
                        check_out_time: String(outTime),
                        working_hours: Math.round(workingHours * 100) / 100,
                        status
                    });
                }
                results.push(record);
            }
            res.status(200).json({ success: true, count: results.length });
        } catch (error) {
            console.error('SERVER_ERROR [uploadAttendanceExcel]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateAdminOverride(req, res, next) {
        try {
            const { id } = req.params;
            const { admin_approved_leave, remarks } = req.body;

            const attendance = await Attendance.findByPk(id);
            if (!attendance) return res.status(404).json({ message: 'Attendance record not found' });

            await attendance.update({
                admin_approved_leave: parseFloat(admin_approved_leave) || 0,
                is_admin_approved: true,
                remarks: remarks || attendance.remarks
            });
            res.status(200).json({ success: true, data: attendance });
        } catch (error) {
            console.error('SERVER_ERROR [updateAdminOverride]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }


    // Payroll Management
    async generatePayroll(req, res, next) {
        try {
            const { payroll_month, employee_ids } = req.body;
            const [year, month] = payroll_month.split('-').map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();

            const monthStart = `${payroll_month}-01`;
            const monthEnd = `${payroll_month}-${String(daysInMonth).padStart(2, '0')}`;

            const results = [];
            for (const empId of employee_ids) {
                const employee = await Employee.findByPk(empId);
                if (!employee) continue;

                const attendanceRecords = await Attendance.findAll({
                    where: {
                        employee_id: empId,
                        attendance_date: { [Op.between]: [monthStart, monthEnd] }
                    }
                });

                let systemPresentDays = 0;
                let adminApprovedLeaves = 0;

                attendanceRecords.forEach(rec => {
                    const statusVal = { 'PRESENT': 1.0, 'HALF_DAY': 0.5, 'ABSENT': 0.0, 'LEAVE': 0.0 };
                    systemPresentDays += statusVal[rec.status] ?? 0;
                    adminApprovedLeaves += parseFloat(rec.admin_approved_leave || 0);
                });

                const totalPaidDays = systemPresentDays + adminApprovedLeaves;
                const dailyRate = (parseFloat(employee.basic_salary) || 0) / daysInMonth;
                const salaryPayable = totalPaidDays * dailyRate;

                const [record, created] = await Payroll.findOrCreate({
                    where: { employee_id: empId, payroll_month },
                    defaults: {
                        basic_salary: employee.basic_salary,
                        present_days: systemPresentDays,
                        approved_leaves: adminApprovedLeaves,
                        paid_days: totalPaidDays,
                        daily_rate: Math.round(dailyRate * 100) / 100,
                        net_salary: Math.round(salaryPayable * 100) / 100,
                        generated_by: req.user.id
                    }
                });

                if (!created) {
                    await record.update({
                        basic_salary: employee.basic_salary,
                        present_days: systemPresentDays,
                        approved_leaves: adminApprovedLeaves,
                        paid_days: totalPaidDays,
                        daily_rate: Math.round(dailyRate * 100) / 100,
                        net_salary: Math.round(salaryPayable * 100) / 100,
                        generated_by: req.user.id
                    });
                }
                results.push(record);
            }
            res.status(200).json({ success: true, data: results });
        } catch (error) {
            console.error('SERVER_ERROR [generatePayroll]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }


    async getPayrollByMonth(req, res, next) {
        try {
            const { month } = req.query;
            const records = await Payroll.findAll({
                where: { payroll_month: month },
                include: [{ model: Employee, include: [{ model: User, attributes: ['name'] }] }]
            });
            res.status(200).json({ success: true, data: records });
        } catch (error) {
            console.error('SERVER_ERROR [getPayrollByMonth]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async downloadPayrollExcel(req, res, next) {
        try {
            const { month } = req.query;
            const records = await Payroll.findAll({
                where: { payroll_month: month },
                include: [{ model: Employee, include: [{ model: User, attributes: ['name'] }] }]
            });

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Payroll Report');

            worksheet.columns = [
                { header: 'Employee Name', key: 'name', width: 30 },
                { header: 'Month', key: 'month', width: 15 },
                { header: 'Basic Salary', key: 'basic', width: 15 },
                { header: 'Present Days', key: 'present', width: 15 },
                { header: 'Approved Leaves', key: 'leaves', width: 15 },
                { header: 'Paid Days', key: 'paid', width: 15 },
                { header: 'Daily Rate', key: 'rate', width: 15 },
                { header: 'Net Salary', key: 'net', width: 15 },
                { header: 'Status', key: 'status', width: 15 }
            ];

            records.forEach(rec => {
                worksheet.addRow({
                    name: rec.Employee?.User?.name || 'N/A',
                    month: rec.payroll_month,
                    basic: rec.basic_salary,
                    present: rec.present_days,
                    leaves: rec.approved_leaves,
                    paid: rec.paid_days,
                    rate: rec.daily_rate,
                    net: rec.net_salary,
                    status: rec.payment_status || 'PENDING'
                });
            });

            worksheet.getRow(1).font = { bold: true };

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="Payroll_Report_${month}.xlsx"`);

            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('SERVER_ERROR [downloadPayrollExcel]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async downloadPayrollPDF(req, res, next) {
        try {
            const { month } = req.query;
            const records = await Payroll.findAll({
                where: { payroll_month: month },
                include: [{ model: Employee, include: [{ model: User, attributes: ['name'] }] }]
            });

            const doc = new PDFDocument({ margin: 30, size: 'A4' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Payroll_Report_${month}.pdf"`);
            doc.pipe(res);

            // Title
            doc.fontSize(20).text('Payroll Report', { align: 'center' });
            doc.fontSize(14).text(`Month: ${month}`, { align: 'center' });
            doc.moveDown();

            // Table Header
            const tableTop = 150;
            const columns = [
                { label: 'Employee', x: 30, width: 150 },
                { label: 'Basic', x: 180, width: 70 },
                { label: 'Paid Days', x: 250, width: 70 },
                { label: 'Daily Rate', x: 320, width: 70 },
                { label: 'Net Salary', x: 390, width: 80 },
                { label: 'Status', x: 470, width: 70 }
            ];

            doc.fontSize(10).font('Helvetica-Bold');
            columns.forEach(col => {
                doc.text(col.label, col.x, tableTop);
            });

            doc.moveTo(30, tableTop + 15).lineTo(560, tableTop + 15).stroke();

            let currentY = tableTop + 25;
            doc.font('Helvetica');

            records.forEach(rec => {
                if (currentY > 750) {
                    doc.addPage();
                    currentY = 50;
                    
                    // Re-add header on new page
                    doc.fontSize(10).font('Helvetica-Bold');
                    columns.forEach(col => {
                        doc.text(col.label, col.x, currentY);
                    });
                    doc.moveTo(30, currentY + 15).lineTo(560, currentY + 15).stroke();
                    currentY += 25;
                    doc.font('Helvetica');
                }
                doc.text(rec.Employee?.User?.name || 'N/A', columns[0].x, currentY, { width: columns[0].width });
                doc.text(String(rec.basic_salary), columns[1].x, currentY);
                doc.text(String(rec.paid_days), columns[2].x, currentY);
                doc.text(String(rec.daily_rate), columns[3].x, currentY);
                doc.text(String(rec.net_salary), columns[4].x, currentY);
                doc.text(rec.payment_status || 'PENDING', columns[5].x, currentY);
                currentY += 20;
            });

            doc.end();
        } catch (error) {
            console.error('SERVER_ERROR [downloadPayrollPDF]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Leave Management
    async applyLeave(req, res, next) {
        try {
            const { employee_id, leave_type, from_date, to_date, total_days, comments } = req.body;
            const leave = await Leave.create({ employee_id, leave_type, from_date, to_date, total_days, comments });
            res.status(201).json({ success: true, data: leave });
        } catch (error) {
            console.error('SERVER_ERROR [applyLeave]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateLeaveStatus(req, res, next) {
        try {
            const { id } = req.params;
            const { status } = req.body;
            const leave = await Leave.findByPk(id);
            if (!leave) return res.status(404).json({ message: 'Leave record not found' });
            await leave.update({ status, approved_by: req.user.id });
            res.status(200).json({ success: true, data: leave });
        } catch (error) {
            console.error('SERVER_ERROR [updateLeaveStatus]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getAllLeaves(req, res, next) {
        try {
            const leaves = await Leave.findAll({
                include: [{ model: Employee, include: [{ model: User, attributes: ['name'] }] }]
            });
            res.status(200).json({ success: true, data: leaves });
        } catch (error) {
            console.error('SERVER_ERROR [getAllLeaves]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new HRController();
