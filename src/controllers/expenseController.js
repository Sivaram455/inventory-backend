const { Expense } = require('../models');
const { Op } = require('sequelize');

class ExpenseController {
    // Get all expenses (with optional month filter)
    async getAll(req, res) {
        try {
            const { month, category } = req.query;
            const where = {};

            if (month) {
                const [year, m] = month.split('-').map(Number);
                const lastDay = new Date(year, m, 0).getDate();
                where.expense_date = {
                    [Op.between]: [`${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`]
                };
            }

            if (category && category !== 'ALL') {
                where.expense_category = category;
            }

            const expenses = await Expense.findAll({ where, order: [['expense_date', 'DESC'], ['id', 'DESC']] });
            res.status(200).json({ success: true, data: expenses });
        } catch (error) {
            console.error('SERVER_ERROR [getExpenses]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get single expense
    async getById(req, res) {
        try {
            const expense = await Expense.findByPk(req.params.id);
            if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });
            res.status(200).json({ success: true, data: expense });
        } catch (error) {
            console.error('SERVER_ERROR [getExpenseById]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Create expense
    async create(req, res) {
        try {
            const { expense_date, expense_category, description, amount, payment_mode, paid_to, reference_no, payment_url } = req.body;
            let image_url = null;
            if (req.file) {
                image_url = `/uploads/${req.file.filename}`;
            }
            const expense = await Expense.create({
                expense_date, expense_category, description,
                amount, payment_mode, paid_to, reference_no, payment_url,
                image_url,
                created_by: req.user.id
            });
            res.status(201).json({ success: true, data: expense });
        } catch (error) {
            console.error('SERVER_ERROR [createExpense]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Update expense
    async update(req, res) {
        try {
            const expense = await Expense.findByPk(req.params.id);
            if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });

            const updateData = { ...req.body };
            if (req.file) {
                updateData.image_url = `/uploads/${req.file.filename}`;
            }

            await expense.update({ ...updateData, updated_by: req.user.id });
            res.status(200).json({ success: true, data: expense });
        } catch (error) {
            console.error('SERVER_ERROR [updateExpense]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Delete expense
    async delete(req, res) {
        try {
            const expense = await Expense.findByPk(req.params.id);
            if (!expense) return res.status(404).json({ success: false, message: 'Expense not found' });

            await expense.destroy();
            res.status(200).json({ success: true, message: 'Expense deleted' });
        } catch (error) {
            console.error('SERVER_ERROR [deleteExpense]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Summary stats for a month
    async summary(req, res) {
        try {
            const { month } = req.query;
            const where = {};

            if (month) {
                const [year, m] = month.split('-').map(Number);
                const lastDay = new Date(year, m, 0).getDate();
                where.expense_date = {
                    [Op.between]: [`${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`]
                };
            }

            const expenses = await Expense.findAll({ where });
            const total = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

            // Category breakdown
            const categoryMap = {};
            expenses.forEach(e => {
                const cat = e.expense_category || 'OTHER';
                categoryMap[cat] = (categoryMap[cat] || 0) + parseFloat(e.amount || 0);
            });

            // Payment mode breakdown
            const modeMap = {};
            expenses.forEach(e => {
                const mode = e.payment_mode || 'OTHER';
                modeMap[mode] = (modeMap[mode] || 0) + parseFloat(e.amount || 0);
            });

            res.status(200).json({
                success: true,
                data: {
                    total,
                    count: expenses.length,
                    byCategory: categoryMap,
                    byPaymentMode: modeMap
                }
            });
        } catch (error) {
            console.error('SERVER_ERROR [expenseSummary]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new ExpenseController();
