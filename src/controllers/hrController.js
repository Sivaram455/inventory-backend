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

            // Check if employee already exists for this user
            const existingEmployee = await Employee.findOne({ where: { user_id } });
            if (existingEmployee) {
                return res.status(400).json({ success: false, message: 'This user is already registered as an employee' });
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
                const category = statusToPresence[mark.status] || 0.0;
                const updateFields = { 
                    status: mark.status, 
                    remarks: mark.remarks, 
                    category,
                    check_in_time: mark.check_in_time || null,
                    check_out_time: mark.check_out_time || null,
                    working_hours: mark.working_hours || 0
                };

                const [record, created] = await Attendance.findOrCreate({
                    where: { employee_id: mark.employee_id, attendance_date },
                    defaults: updateFields
                });
                if (!created) {
                    await record.update(updateFields);
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
                // Support multiple column name variations
                const employeeCode = row.Employee_Code || row.Code || row.employee_code || 
                                   (row['Employee Name (Select from list)'] ? row['Employee Name (Select from list)'].split('(').pop()?.replace(')', '') : null);
                const dateRaw = row.Date || row.date;
                const inTime = row.In_Time || row.InTime || row.in_time || row['Check-In'];
                const outTime = row.Out_Time || row.OutTime || row.out_time || row['Check-Out'];
                const statusFromExcel = row.Status || row.status;

                if (!employeeCode || !dateRaw) continue;

                // Handle Excel date serial or string
                let attendance_date;
                if (typeof dateRaw === 'number') {
                    // Excel serial date to JS Date
                    const d = new Date((dateRaw - 25569) * 86400 * 1000);
                    attendance_date = d.toISOString().slice(0, 10);
                } else {
                    attendance_date = new Date(dateRaw).toISOString().slice(0, 10);
                }

                const employee = await Employee.findOne({ where: { employee_code: String(employeeCode) } });
                if (!employee) continue;

                const toHours = (t) => {
                    if (!t) return 0;
                    if (typeof t === 'number') return t * 24; // Excel serial time
                    const parts = String(t).split(':').map(Number);
                    if (parts.length < 2) return 0;
                    return parts[0] + (parts[1] / 60);
                };

                const workingHoursRaw = toHours(outTime) - toHours(inTime);
                const working_hours = Math.max(0, Math.round(workingHoursRaw * 100) / 100);

                let category = 0;
                let status = statusFromExcel || 'ABSENT';
                
                if (!statusFromExcel) {
                    if (working_hours >= 9) {
                        category = 1.0;
                        status = 'PRESENT';
                    } else if (working_hours >= 4.5) {
                        category = 0.5;
                        status = 'HALF_DAY';
                    }
                } else {
                    const statusVal = { 'PRESENT': 1.0, 'HALF_DAY': 0.5, 'ABSENT': 0.0, 'LEAVE': 0.0 };
                    category = statusVal[status.toUpperCase()] || 0.0;
                }

                const [record, created] = await Attendance.findOrCreate({
                    where: { employee_id: employee.id, attendance_date },
                    defaults: {
                        check_in_time: inTime ? String(inTime) : null,
                        check_out_time: outTime ? String(outTime) : null,
                        working_hours,
                        status: status.toUpperCase(),
                        category,
                        remarks: row.Remarks || 'Uploaded via Excel'
                    }
                });

                if (!created) {
                    await record.update({
                        check_in_time: inTime ? String(inTime) : record.check_in_time,
                        check_out_time: outTime ? String(outTime) : record.check_out_time,
                        working_hours: working_hours || record.working_hours,
                        status: status.toUpperCase(),
                        category,
                        remarks: row.Remarks || record.remarks
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

    async downloadAttendanceTemplate(req, res, next) {
        try {
            const employees = await Employee.findAll({
                include: [{ model: User, attributes: ['name'] }]
            });

            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Attendance');
            const dataSheet = workbook.addWorksheet('Data', { state: 'hidden' });

            // Headers
            sheet.columns = [
                { header: 'Employee Name (Select from list)', key: 'employee', width: 40 },
                { header: 'Date (YYYY-MM-DD)', key: 'date', width: 20 },
                { header: 'Check-In (HH:mm)', key: 'in', width: 15 },
                { header: 'Check-Out (HH:mm)', key: 'out', width: 15 },
                { header: 'Status (Optional: PRESENT, HALF_DAY, ABSENT)', key: 'status', width: 35 },
                { header: 'Remarks', key: 'remarks', width: 30 }
            ];

            // Add employees to data sheet for validation
            employees.forEach((emp, i) => {
                dataSheet.getCell(`A${i + 1}`).value = `${emp.User?.name || 'N/A'} (${emp.employee_code})`;
            });

            // Status options
            const statuses = ['PRESENT', 'HALF_DAY', 'ABSENT', 'LEAVE'];
            statuses.forEach((s, i) => {
                dataSheet.getCell(`B${i + 1}`).value = s;
            });

            // Apply data validation
            const rowCount = 500;
            for (let i = 2; i <= rowCount; i++) {
                sheet.getCell(`A${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`=Data!$A$1:$A$${employees.length || 1}`]
                };
                sheet.getCell(`E${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`=Data!$B$1:$B$${statuses.length}`]
                };
                
                // Set default date
                sheet.getCell(`B${i}`).value = new Date().toISOString().slice(0, 10);
            }

            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="Attendance_Template.xlsx"');

            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('SERVER_ERROR [downloadAttendanceTemplate]:', error);
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

    async downloadEmployeeTemplate(req, res, next) {
        try {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Staff');

            sheet.columns = [
                { header: 'Employee Code', key: 'code', width: 20 },
                { header: 'Full Name', key: 'name', width: 30 },
                { header: 'Email', key: 'email', width: 30 },
                { header: 'Phone', key: 'phone', width: 20 },
                { header: 'Department', key: 'dept', width: 20 },
                { header: 'Designation', key: 'designation', width: 20 },
                { header: 'Employment Type (FULL_TIME, CONTRACT, PART_TIME)', key: 'type', width: 40 },
                { header: 'Basic Salary', key: 'salary', width: 15 },
                { header: 'Date of Joining (YYYY-MM-DD)', key: 'joinDate', width: 25 }
            ];

            const depts = ['Operations', 'Accounts', 'Warehouse', 'HR', 'Logistics', 'Dispatch', 'Admin', 'Finance'];
            const types = ['FULL_TIME', 'CONTRACT', 'PART_TIME'];

            const dataSheet = workbook.addWorksheet('Data', { state: 'hidden' });
            depts.forEach((d, i) => dataSheet.getCell(`A${i + 1}`).value = d);
            types.forEach((t, i) => dataSheet.getCell(`B${i + 1}`).value = t);

            for (let i = 2; i <= 100; i++) {
                sheet.getCell(`E${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`=Data!$A$1:$A$${depts.length}`]
                };
                sheet.getCell(`G${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`=Data!$B$1:$B$${types.length}`]
                };
            }

            sheet.getRow(1).font = { bold: true };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename="Staff_Template.xlsx"');

            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('SERVER_ERROR [downloadEmployeeTemplate]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async uploadEmployeeExcel(req, res, next) {
        try {
            if (!req.file) return res.status(400).json({ message: 'Excel file is required' });

            const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = xlsx.utils.sheet_to_json(sheet);

            const results = [];
            for (const row of rows) {
                const {
                    'Employee Code': code,
                    'Full Name': name,
                    'Email': email,
                    'Phone': phone,
                    'Department': dept,
                    'Designation': designation,
                    'Employment Type': type,
                    'Basic Salary': salary,
                    'Date of Joining': joinDate
                } = row;

                if (!name || !email) continue;

                let user = await User.findOne({ where: { email } });
                if (!user) {
                    user = await User.create({
                        name,
                        email,
                        mobile_number: String(phone || ''),
                        password: 'Staff@123',
                        role_id: 3,
                        created_by: req.user.id
                    });
                }

                const [employee, created] = await Employee.findOrCreate({
                    where: { user_id: user.id },
                    defaults: {
                        employee_code: String(code || `EMP${Date.now()}`),
                        designation: designation || 'Staff',
                        department: dept || 'Operations',
                        employment_type: type || 'FULL_TIME',
                        date_of_joining: joinDate ? new Date(joinDate) : new Date(),
                        basic_salary: parseFloat(salary) || 0,
                        created_by: req.user.id
                    }
                });

                if (!created) {
                    await employee.update({
                        employee_code: code ? String(code) : employee.employee_code,
                        designation: designation || employee.designation,
                        department: dept || employee.department,
                        employment_type: type || employee.employment_type,
                        date_of_joining: joinDate ? new Date(joinDate) : employee.date_of_joining,
                        basic_salary: salary ? parseFloat(salary) : employee.basic_salary,
                        updated_by: req.user.id
                    });
                }
                results.push(employee);
            }
            res.status(200).json({ success: true, count: results.length });
        } catch (error) {
            console.error('SERVER_ERROR [uploadEmployeeExcel]:', error);
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
