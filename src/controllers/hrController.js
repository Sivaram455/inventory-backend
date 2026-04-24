const { Employee, Attendance, Payroll, Leave, User } = require('../models');
const { Op } = require('sequelize');
const xlsx = require('xlsx');


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
            const { date } = req.query;
            const records = await Attendance.findAll({
                where: { attendance_date: date },
                include: [{ model: Employee, include: [{ model: User, attributes: ['name'] }] }]
            });
            res.status(200).json({ success: true, data: records });
        } catch (error) {
            console.error('SERVER_ERROR [getAttendanceByDate]:', error);
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

    // Leave Management
    async applyLeave(req, res, next) {
        try {
            const { employee_id, leave_type, from_date, to_date, total_days } = req.body;
            const leave = await Leave.create({ employee_id, leave_type, from_date, to_date, total_days });
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
