const { Employee, Attendance, Payroll, Leave, User } = require('../models');
const { Op } = require('sequelize');

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
            const records = await Attendance.findAll({ where: { attendance_date: date } });
            res.status(200).json({ success: true, data: records });
        } catch (error) {
            console.error('SERVER_ERROR [getAttendanceByDate]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Payroll Management
    async generatePayroll(req, res, next) {
        try {
            const { payroll_month, employee_ids, hra, da, pf, tax } = req.body;
            const [year, month] = payroll_month.split('-').map(Number);
            const lastDay = new Date(year, month, 0).getDate();

            // Calculate working days (exclude Sundays)
            let sundays = 0;
            for (let day = 1; day <= lastDay; day++) {
                if (new Date(year, month - 1, day).getDay() === 0) sundays++;
            }
            const workingDays = lastDay - sundays;

            const payrolls = [];
            for (const empId of employee_ids) {
                const employee = await Employee.findByPk(empId);
                if (!employee) continue;

                // Count approved leave days this month (excluding Sundays)
                const monthStart = `${payroll_month}-01`;
                const monthEnd = `${payroll_month}-${String(lastDay).padStart(2, '0')}`;

                const approvedLeaves = await Leave.findAll({
                    where: {
                        employee_id: empId,
                        status: 'APPROVED',
                        [Op.or]: [
                            { from_date: { [Op.between]: [monthStart, monthEnd] } },
                            { to_date: { [Op.between]: [monthStart, monthEnd] } }
                        ]
                    }
                });

                let totalLeaveDays = 0;
                approvedLeaves.forEach(leave => {
                    let start = new Date(leave.from_date);
                    let end = new Date(leave.to_date);
                    let mStart = new Date(year, month - 1, 1);
                    let mEnd = new Date(year, month - 1, lastDay);

                    let cur = new Date(start < mStart ? mStart : start);
                    let fin = new Date(end > mEnd ? mEnd : end);

                    for (let d = new Date(cur); d <= fin; d.setDate(d.getDate() + 1)) {
                        if (d.getDay() !== 0) totalLeaveDays++;
                    }
                });

                // 1 free paid leave per month
                const unpaidDays = Math.max(0, totalLeaveDays - 1);

                // Calculate pay
                const basic = parseFloat(employee.basic_salary) || 0;
                const hraVal = parseFloat(hra) || 0;
                const daVal = parseFloat(da) || 0;
                const pfVal = parseFloat(pf) || 0;
                const taxVal = parseFloat(tax) || 0;

                const dailyRate = basic / workingDays;
                const leaveDeduction = dailyRate * unpaidDays;
                const net = (basic - leaveDeduction) + hraVal + daVal - pfVal - taxVal;

                const [record, created] = await Payroll.findOrCreate({
                    where: { employee_id: empId, payroll_month },
                    defaults: {
                        basic_salary: basic,
                        hra: hraVal,
                        allowances: daVal,
                        deductions: pfVal + leaveDeduction,
                        tax: taxVal,
                        net_salary: Math.max(0, net),
                        generated_by: req.user.id
                    }
                });

                if (!created) {
                    await record.update({
                        basic_salary: basic,
                        hra: hraVal,
                        allowances: daVal,
                        deductions: pfVal + leaveDeduction,
                        tax: taxVal,
                        net_salary: Math.max(0, net),
                        generated_by: req.user.id
                    });
                }
                payrolls.push(record);
            }
            res.status(200).json({ success: true, data: payrolls });
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
