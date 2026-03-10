const { CorporateBank, Beneficiary, BankPayment } = require('../models');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');

exports.getBanks = async (req, res, next) => {
    try {
        const banks = await CorporateBank.findAll({ order: [['id', 'DESC']] });
        res.json({ success: true, data: banks });
    } catch (err) {
        next(err);
    }
};

exports.createBank = async (req, res, next) => {
    try {
        const bank = await CorporateBank.create(req.body);
        res.status(201).json({ success: true, data: bank });
    } catch (err) {
        next(err);
    }
};

exports.updateBank = async (req, res, next) => {
    try {
        const bank = await CorporateBank.findByPk(req.params.id);
        if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
        await bank.update(req.body);
        res.json({ success: true, data: bank });
    } catch (err) {
        next(err);
    }
};

exports.deleteBank = async (req, res, next) => {
    try {
        const bank = await CorporateBank.findByPk(req.params.id);
        if (!bank) return res.status(404).json({ success: false, message: 'Bank not found' });
        await bank.destroy();
        res.json({ success: true, message: 'Bank deleted' });
    } catch (err) {
        next(err);
    }
};

function normalizeHeader(h) {
    return String(h || '').trim().toLowerCase().replace(/[\s_]+/g, '');
}

exports.uploadBanksExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Excel file is required' });

        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) return res.status(400).json({ message: 'No rows found in Excel' });

        let created = 0, failed = 0;
        const errors = [];

        for (const r of rows) {
            try {
                const keys = Object.keys(r).reduce((acc, k) => { acc[normalizeHeader(k)] = r[k]; return acc; }, {});

                const bankName = keys.bankname || keys.bank || '';
                const accNumber = String(keys.accountnumber || keys.account || '').trim();
                const ifsc = String(keys.ifsccode || keys.ifsc || '').trim();

                if (!bankName || !accNumber || !ifsc) {
                    failed++;
                    errors.push('Row missing required fields (Bank Name, Account Number, IFSC)');
                    continue;
                }

                await CorporateBank.create({
                    bank_name: bankName,
                    account_number: accNumber,
                    ifsc_code: ifsc,
                    branch: keys.branch || keys.branchname || '',
                    balance: parseFloat(keys.balance || keys.openingbalance || 0) || 0,
                    is_active: String(keys.status || keys.isactive).toLowerCase() !== 'inactive'
                });
                created++;
            } catch (rowErr) {
                failed++;
                errors.push(`Account ${r['Account Number'] || ''}: ${rowErr.message}`);
            }
        }

        res.json({ success: true, message: 'Bulk upload complete', stats: { created, failed, errors } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Bulk upload failed', error: err.message });
    }
};

exports.downloadBanksSample = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Banks');

        const headers = ['Bank Name', 'Account Number', 'IFSC Code', 'Branch Name', 'Opening Balance', 'Status'];
        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true };

        sheet.addRow(['HDFC Bank', '1234567890', 'HDFC0001234', 'Main Branch', 500000, 'Active']);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=corporate_banks_template.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ message: 'Error generating sample', error: err.message });
    }
};

// --- Beneficiaries ---

exports.getBeneficiaries = async (req, res, next) => {
    try {
        const bens = await Beneficiary.findAll({ order: [['id', 'DESC']] });
        res.json({ success: true, data: bens });
    } catch (err) {
        next(err);
    }
};

exports.createBeneficiary = async (req, res, next) => {
    try {
        const ben = await Beneficiary.create({ ...req.body, created_by: req.user.id });
        res.status(201).json({ success: true, data: ben });
    } catch (err) {
        next(err);
    }
};

exports.updateBeneficiary = async (req, res, next) => {
    try {
        const ben = await Beneficiary.findByPk(req.params.id);
        if (!ben) return res.status(404).json({ success: false, message: 'Beneficiary not found' });
        await ben.update({ ...req.body, updated_by: req.user.id });
        res.json({ success: true, data: ben });
    } catch (err) {
        next(err);
    }
};

exports.deleteBeneficiary = async (req, res, next) => {
    try {
        const ben = await Beneficiary.findByPk(req.params.id);
        if (!ben) return res.status(404).json({ success: false, message: 'Beneficiary not found' });
        await ben.destroy();
        res.json({ success: true, message: 'Beneficiary deleted' });
    } catch (err) {
        next(err);
    }
};

exports.uploadBeneficiariesExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Excel file is required' });

        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) return res.status(400).json({ message: 'No rows found in Excel' });

        let created = 0, failed = 0, duplicates = 0;
        const errors = [];

        for (const r of rows) {
            try {
                const keys = Object.keys(r).reduce((acc, k) => { acc[normalizeHeader(k)] = r[k]; return acc; }, {});

                const benType = keys.beneficiarytype || keys.type || 'vendor';
                const benName = keys.beneficiaryname || keys.name || '';
                const bankName = keys.bankname || keys.bank || '';
                const accNumber = String(keys.bankaccountno || keys.accountnumber || keys.account || '').trim();
                const ifsc = String(keys.ifsccode || keys.ifsc || '').trim();

                if (!benName || !bankName || !accNumber || !ifsc || !benType) {
                    failed++;
                    errors.push('Row missing required fields (Beneficiary Type, Beneficiary Name, Bank Name, Account Number, IFSC)');
                    continue;
                }

                // Check for duplicates based on standard name + account Number
                const existing = await Beneficiary.findOne({ where: { beneficiary_name: benName, bank_account_no: accNumber } });
                if (existing) {
                    duplicates++;
                    errors.push(`Duplicate entry found for Beneficiary ${benName} with Account ${accNumber}`);
                    continue; // skip
                }

                await Beneficiary.create({
                    beneficiary_type: benType,
                    beneficiary_name: benName,
                    business_code: keys.businesscode || keys.code || null,
                    bank_name: bankName,
                    ifsc_code: ifsc,
                    bank_account_no: accNumber,
                    pan: keys.pan || null,
                    mobile_no: String(keys.mobileno || keys.mobile || keys.contact || ''),
                    email: keys.email || null,
                    nature_of_account: keys.natureofaccount || keys.nature || null,
                    account_type: keys.accounttype || null,
                    status: String(keys.status || keys.isactive).toLowerCase() !== 'inactive' ? 'active' : 'inactive',
                    created_by: req.user.id
                });
                created++;
            } catch (rowErr) {
                failed++;
                errors.push(`Account ${r['Account Number'] || r['Bank Account No'] || ''}: ${rowErr.message}`);
            }
        }

        res.json({ success: true, message: 'Bulk upload complete', stats: { created, failed, duplicates, errors } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Bulk upload failed', error: err.message });
    }
};

exports.downloadBeneficiariesSample = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Beneficiaries');

        const headers = ['Beneficiary Type', 'Beneficiary Name', 'Business Code', 'Bank Name', 'IFSC Code', 'Bank Account No', 'PAN', 'Mobile No', 'Email', 'Nature of Account', 'Account Type', 'Status'];
        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true };

        sheet.addRow(['Vendor', 'John Doe Suppliers', 'SUP001', 'ICICI Bank', 'ICIC0001122', '112233445566', 'ABCDE1234F', '9876543210', 'john@example.com', 'Current', 'Corporate', 'active']);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=beneficiaries_template.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ message: 'Error generating sample', error: err.message });
    }
};

// --- Bank Payments ---

exports.getPayments = async (req, res, next) => {
    try {
        const payments = await BankPayment.findAll({
            include: [{ model: Beneficiary, attributes: ['beneficiary_name', 'bank_account_no', 'ifsc_code'] }],
            order: [['id', 'DESC']]
        });
        res.json({ success: true, data: payments });
    } catch (err) {
        next(err);
    }
};

exports.createPayment = async (req, res, next) => {
    try {
        const { beneficiary_id, amount, payment_remarks, sequential_number, upload_date } = req.body;
        if (!beneficiary_id || !amount) {
            return res.status(400).json({ success: false, message: 'Beneficiary and amount are required' });
        }
        const beneficiary = await Beneficiary.findByPk(beneficiary_id);
        if (!beneficiary) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

        const uploadDate = upload_date ? new Date(upload_date) : new Date();

        // Duplicate Check
        const existing = await BankPayment.findOne({
            where: {
                credit_account_number: beneficiary.bank_account_no,
                amount: parseFloat(amount),
                upload_date: uploadDate,
                sequential_number: sequential_number || null,
                payment_remarks: payment_remarks || null
            }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Duplicate Payment Detected: A payment of ₹${amount} to this account already exists for this date.`
            });
        }

        const payment = await BankPayment.create({
            beneficiary_id: beneficiary.id,
            batch_id: `MANUAL-${Date.now()}`,
            file_name: 'Manual Entry',
            upload_date: upload_date ? new Date(upload_date) : new Date(),
            type_of_account: beneficiary.account_type || null,
            amount: parseFloat(amount),
            vendor_name: beneficiary.beneficiary_name,
            credit_account_number: beneficiary.bank_account_no,
            ifsc_code: beneficiary.ifsc_code,
            nature_of_account: beneficiary.nature_of_account || null,
            email: beneficiary.email,
            vendor_contact_number: beneficiary.mobile_no,
            payment_remarks: payment_remarks || null,
            sequential_number: sequential_number || null,
            payment_status: 'draft',
            created_by: req.user.id
        });
        res.status(201).json({ success: true, data: payment });
    } catch (err) {
        next(err);
    }
};

exports.uploadPaymentsExcel = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Excel file is required' });

        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

        if (!rows.length) return res.status(400).json({ message: 'No rows found in Excel' });

        const batchId = `BATCH-${Date.now()}`;
        const fileName = req.file.originalname;

        let created = 0, failed = 0;
        const errors = [];

        for (const r of rows) {
            try {
                const keys = Object.keys(r).reduce((acc, k) => { acc[normalizeHeader(k)] = r[k]; return acc; }, {});

                const benAcc = String(keys.creditaccountnumber || keys.accountnumber || keys.bankaccountno || '').trim();
                const amount = parseFloat(keys.amount);

                if (!benAcc || isNaN(amount)) {
                    failed++;
                    errors.push('Row missing required fields (Credit Account Number, Amount)');
                    continue;
                }

                const beneficiary = await Beneficiary.findOne({ where: { bank_account_no: benAcc } });
                if (!beneficiary) {
                    failed++;
                    errors.push(`No beneficiary found with account number ${benAcc}`);
                    continue;
                }

                const uploadDate = keys.uploaddate ? new Date(keys.uploaddate) : new Date();
                const seqNo = keys.sequentialnumber || null;
                const remarks = keys.paymentremarks || null;

                // Duplicate Check
                const existing = await BankPayment.findOne({
                    where: {
                        credit_account_number: benAcc,
                        amount: amount,
                        upload_date: uploadDate,
                        sequential_number: seqNo,
                        payment_remarks: remarks
                    }
                });

                if (existing) {
                    failed++;
                    errors.push(`Duplicate Payment: Row with Account ${benAcc} and Amount ${amount} already exists for this date.`);
                    continue;
                }

                await BankPayment.create({
                    beneficiary_id: beneficiary.id,
                    batch_id: batchId,
                    file_name: fileName,
                    upload_date: keys.uploaddate ? new Date(keys.uploaddate) : new Date(),
                    type_of_account: keys.typeofaccount || beneficiary.account_type || null,
                    amount: amount,
                    vendor_name: keys.vendorname || beneficiary.beneficiary_name,
                    credit_account_number: benAcc,
                    ifsc_code: keys.ifsccode || beneficiary.ifsc_code,
                    nature_of_account: keys.natureofacc || beneficiary.nature_of_account || null,
                    email: keys.emailaddress || keys.email || beneficiary.email,
                    vendor_contact_number: keys.vendorcontactnumber || beneficiary.mobile_no,
                    payment_remarks: keys.paymentremarks || null,
                    debit_account_number: String(keys.debitaccountnumber || ''),
                    sequential_number: keys.sequentialnumber || null,
                    payment_status: keys.paymentstatus || 'draft',
                    payment_declined_reason: keys.paymentdeclinedreason || null,
                    utr_number: keys.utrno || null,
                    processed_date: keys.processeddate ? new Date(keys.processeddate) : null,
                    created_by: req.user.id
                });
                created++;

            } catch (rowErr) {
                failed++;
                errors.push(`Payment Row Error: ${rowErr.message}`);
            }
        }

        res.json({ success: true, message: 'Payment bulk upload complete', stats: { batch_id: batchId, created, failed, errors } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Bulk upload failed', error: err.message });
    }
};

exports.downloadPaymentsSample = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Payments');

        const headers = [
            'Type of account', 'Amount', 'Upload Date', 'Vendor name', 'Credit account number',
            'Email address', 'Payment remarks', 'Debit account number', 'Sequential number',
            'IFSC Code', 'Nature of acc', 'Vendor contact number', 'Payment Status',
            'Payment Declined Reason', 'Batch ID', 'File Name', 'UTR No', 'processed Date'
        ];
        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true };

        sheet.addRow([
            'Current', 15000.50, new Date().toISOString().split('T')[0], 'John Doe Suppliers', '112233445566',
            'john@example.com', 'Invoice #123 Payment', '998877665544', '1',
            'ICIC0001122', 'Savings', '9876543210', 'draft',
            '', 'BATCH-12345', 'Manual Entry', '', ''
        ]);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=bank_payments_template.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ message: 'Error generating sample', error: err.message });
    }
};

exports.exportPayments = async (req, res) => {
    try {
        const { search, dateFrom, dateTo } = req.query;
        const { Op } = require('sequelize');

        let where = {};
        if (dateFrom && dateTo) {
            where.upload_date = { [Op.between]: [dateFrom, dateTo] };
        } else if (dateFrom) {
            where.upload_date = { [Op.gte]: dateFrom };
        } else if (dateTo) {
            where.upload_date = { [Op.lte]: dateTo };
        }

        if (search) {
            where[Op.or] = [
                { vendor_name: { [Op.like]: `%${search}%` } },
                { batch_id: { [Op.like]: `%${search}%` } },
                { credit_account_number: { [Op.like]: `%${search}%` } },
                { utr_number: { [Op.like]: `%${search}%` } }
            ];
        }

        const payments = await BankPayment.findAll({
            where,
            include: [{ model: Beneficiary, attributes: ['beneficiary_name', 'bank_account_no', 'ifsc_code'] }],
            order: [['id', 'DESC']]
        });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Bank Payments');

        const headers = [
            'Type of account', 'Amount', 'Upload Date', 'Vendor name', 'Credit account number',
            'Email address', 'Payment remarks', 'Debit account number', 'Sequential number',
            'IFSC Code', 'Nature of acc', 'Vendor contact number', 'Payment Status',
            'Payment Declined Reason', 'Batch ID', 'File Name', 'UTR No', 'processed Date'
        ];
        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true };

        payments.forEach(p => {
            sheet.addRow([
                p.type_of_account, parseFloat(p.amount), p.upload_date, p.vendor_name, p.credit_account_number,
                p.email, p.payment_remarks, p.debit_account_number, p.sequential_number,
                p.ifsc_code, p.nature_of_account, p.vendor_contact_number, p.payment_status,
                p.payment_declined_reason, p.batch_id, p.file_name, p.utr_number, p.processed_date
            ]);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=bank_payments_export_${Date.now()}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('EXPORT_ERROR:', err);
        res.status(500).json({ success: false, message: 'Export failed' });
    }
};

