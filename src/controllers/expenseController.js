const { Expense } = require('../models');
const { Op } = require('sequelize');
const XLSX = require('xlsx');

class ExpenseController {
    async downloadSample(req, res) {
        try {
            const data = [
                {
                    'Date (YYYY-MM-DD)': '2024-03-01',
                    'Entry Type (INWARD/OUTWARD)': 'INWARD',
                    'Category': 'REPLENISHMENT',
                    'Description': 'Cash from Main Office',
                    'Amount': 5000,
                    'Payment Mode': 'CASH',
                    'Paid To / Received From': 'Admin',
                    'Reference No': 'TXN-001'
                },
                {
                    'Date (YYYY-MM-DD)': '2024-03-02',
                    'Entry Type (INWARD/OUTWARD)': 'OUTWARD',
                    'Category': 'OFFICE',
                    'Description': 'Stationery items',
                    'Amount': 450,
                    'Payment Mode': 'CASH',
                    'Paid To / Received From': 'Local Store',
                    'Reference No': 'TXN-002'
                }
            ];

            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(data);
            XLSX.utils.book_append_sheet(workbook, worksheet, 'PettyCashTemplate');

            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            res.setHeader('Content-Disposition', 'attachment; filename=PettyCash_Import_Template.xlsx');
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            return res.send(buffer);
        } catch (error) {
            console.error('SERVER_ERROR [downloadSample]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async uploadExcel(req, res) {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

            const workbook = XLSX.readFile(req.file.path, { cellDates: false });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(worksheet);

            // Clean up uploaded file after reading
            const fs = require('fs');
            fs.unlink(req.file.path, (err) => {
                if (err) console.error('Failed to delete temp file:', err);
            });

            const entries = [];
            for (const row of data) {
                const dateInput = row['Date (YYYY-MM-DD)'];
                const type = row['Entry Type (INWARD/OUTWARD)'];
                const category = row['Category'];
                const amount = row['Amount'];

                if (!dateInput || !type || !amount) continue;

                let formattedDate = dateInput;

                if (typeof dateInput === 'number') {
                    const parsed = XLSX.SSF.parse_date_code(dateInput);
                    if (parsed) {
                        const yyyy = parsed.y;
                        const mm = String(parsed.m).padStart(2, '0');
                        const dd = String(parsed.d).padStart(2, '0');
                        formattedDate = `${yyyy}-${mm}-${dd}`;
                    } else {
                        formattedDate = null;
                    }
                } else if (typeof dateInput === 'string') {
                    const cleanStr = String(dateInput).trim();
                    const parts = cleanStr.split(/[-/]/);
                    if (parts.length === 3) {
                        if (parts[0].length === 4) {
                            formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                        } else if (parts[2].length === 4) {
                            formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        }
                    }
                    if (formattedDate && isNaN(new Date(formattedDate).getTime())) {
                        formattedDate = null;
                    }
                }

                console.log(`[UploadExcel] Raw Date: ${dateInput} | Type: ${typeof dateInput} | Formatted: ${formattedDate}`);

                // If date was extremely mangled, default to today just to avoid hard crashes, or skip. 
                // Since this is petty cash, we fallback to today.
                if (!formattedDate || formattedDate.includes('NaN')) {
                    formattedDate = new Date().toISOString().split('T')[0];
                }

                entries.push({
                    expense_date: formattedDate,
                    entry_type: type.toUpperCase(),
                    category: category || 'OTHER',
                    description: row['Description'] || '',
                    amount: parseFloat(amount),
                    payment_mode: row['Payment Mode'] || 'CASH',
                    paid_to: row['Paid To / Received From'] || '',
                    reference_no: row['Reference No'] || '',
                    created_by: req.user.id
                });
            }

            if (entries.length === 0) return res.status(400).json({ success: false, message: 'No valid data found in file' });

            await Expense.bulkCreate(entries);
            res.status(200).json({ success: true, message: `Successfully imported ${entries.length} records` });
        } catch (error) {
            console.error('SERVER_ERROR [uploadExcel]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get all entries (with optional month, category, and type filters)
    async getAll(req, res) {
        try {
            const { month, category, entry_type, startDate, endDate } = req.query;
            const where = {};

            if (startDate && endDate) {
                where.expense_date = {
                    [Op.between]: [startDate, endDate]
                };
            } else if (month) {
                const [year, m] = month.split('-').map(Number);
                const lastDay = new Date(year, m, 0).getDate();
                where.expense_date = {
                    [Op.between]: [`${month}-01`, `${month}-${String(lastDay).padStart(2, '0')}`]
                };
            }

            if (category && category !== 'ALL') {
                where.category = category;
            }

            if (entry_type && entry_type !== 'ALL') {
                where.entry_type = entry_type;
            }

            const entries = await Expense.findAll({ where, order: [['expense_date', 'DESC'], ['id', 'DESC']] });
            
            // Calculate overall balance (from all time)
            const allTimeInward = await Expense.sum('amount', { where: { entry_type: 'INWARD' } }) || 0;
            const allTimeOutward = await Expense.sum('amount', { where: { entry_type: 'OUTWARD' } }) || 0;
            const currentBalance = parseFloat(allTimeInward) - parseFloat(allTimeOutward);

            res.status(200).json({ 
                success: true, 
                data: entries,
                balance: currentBalance
            });
        } catch (error) {
            console.error('SERVER_ERROR [getAllEntries]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get single entry
    async getById(req, res) {
        try {
            const entry = await Expense.findByPk(req.params.id);
            if (!entry) return res.status(404).json({ success: false, message: 'Record not found' });
            res.status(200).json({ success: true, data: entry });
        } catch (error) {
            console.error('SERVER_ERROR [getEntryById]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Create entry
    async create(req, res) {
        try {
            const { expense_date, entry_type, category, description, amount, payment_mode, paid_to, reference_no, payment_url } = req.body;
            let image_url = null;
            if (req.file) {
                image_url = `/uploads/${req.file.filename}`;
            }
            const entry = await Expense.create({
                expense_date, entry_type: entry_type || 'OUTWARD', category, description,
                amount, payment_mode, paid_to, reference_no, payment_url,
                image_url,
                created_by: req.user.id
            });
            res.status(201).json({ success: true, data: entry });
        } catch (error) {
            console.error('SERVER_ERROR [createEntry]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Update entry
    async update(req, res) {
        try {
            const entry = await Expense.findByPk(req.params.id);
            if (!entry) return res.status(404).json({ success: false, message: 'Record not found' });

            const updateData = { ...req.body };
            if (req.file) {
                updateData.image_url = `/uploads/${req.file.filename}`;
            }

            await entry.update({ ...updateData, updated_by: req.user.id });
            res.status(200).json({ success: true, data: entry });
        } catch (error) {
            console.error('SERVER_ERROR [updateEntry]:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Delete entry
    async delete(req, res) {
        try {
            const entry = await Expense.findByPk(req.params.id);
            if (!entry) return res.status(404).json({ success: false, message: 'Record not found' });

            await entry.destroy();
            res.status(200).json({ success: true, message: 'Record deleted' });
        } catch (error) {
            console.error('SERVER_ERROR [deleteEntry]:', error);
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

            const entries = await Expense.findAll({ where });
            
            const totalInward = entries.filter(e => e.entry_type === 'INWARD').reduce((s, e) => s + parseFloat(e.amount || 0), 0);
            const totalOutward = entries.filter(e => e.entry_type === 'OUTWARD').reduce((s, e) => s + parseFloat(e.amount || 0), 0);

            // Category breakdown (only for outwards by default, but let's include both)
            const categoryMap = {};
            entries.forEach(e => {
                const cat = e.category || 'OTHER';
                if (!categoryMap[cat]) categoryMap[cat] = { inward: 0, outward: 0 };
                if (e.entry_type === 'INWARD') categoryMap[cat].inward += parseFloat(e.amount || 0);
                else categoryMap[cat].outward += parseFloat(e.amount || 0);
            });

            // Payment mode breakdown
            const modeMap = {};
            entries.forEach(e => {
                const mode = e.payment_mode || 'OTHER';
                if (!modeMap[mode]) modeMap[mode] = { inward: 0, outward: 0 };
                if (e.entry_type === 'INWARD') modeMap[mode].inward += parseFloat(e.amount || 0);
                else modeMap[mode].outward += parseFloat(e.amount || 0);
            });

            // Overall balance
            const allTimeInward = await Expense.sum('amount', { where: { entry_type: 'INWARD' } }) || 0;
            const allTimeOutward = await Expense.sum('amount', { where: { entry_type: 'OUTWARD' } }) || 0;
            const currentBalance = parseFloat(allTimeInward) - parseFloat(allTimeOutward);

            res.status(200).json({
                success: true,
                data: {
                    totalInward,
                    totalOutward,
                    monthBalance: totalInward - totalOutward,
                    currentBalance,
                    countOutward: entries.filter(e => e.entry_type === 'OUTWARD').length,
                    countInward: entries.filter(e => e.entry_type === 'INWARD').length,
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
