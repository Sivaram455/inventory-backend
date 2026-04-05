const { CorporateBank, Beneficiary, BankPayment } = require('../models');
const { Op } = require('sequelize');
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

const validateBeneficiaryData = (data, isUpdate = false) => {
    const { beneficiary_type, beneficiary_name, bank_account_no, ifsc_code, nature_of_account, account_type, pan, mobile_no } = data;

    // For updates, we only validate fields if they are provided
    if (!isUpdate) {
        if (!beneficiary_name || !bank_account_no || !ifsc_code || !nature_of_account || !account_type || !beneficiary_type) {
            throw new Error('Mandatory fields missing (Type, Account Name, Account Number, IFSC Code, Nature of Account, Account Type)');
        }
    }

    // Mobile Number: 10 digits only (only validate if provided)
    if (mobile_no && !/^\d{10}$/.test(mobile_no)) {
        throw new Error('Mobile number must be exactly 10 digits only (no spaces, special characters, or country codes)');
    }

    // PAN: 10 characters, alphanumeric (only validate if provided)
    if (pan && !/^[A-Z0-9]{10}$/i.test(pan)) {
        throw new Error('PAN card must be exactly 10 characters and strictly alphanumeric with no spaces or special characters');
    }

    // Account Number: Alphanumeric only (only validate if provided)
    if (bank_account_no && !/^[A-Z0-9]+$/i.test(bank_account_no)) {
        throw new Error('Account number must be alphanumeric only (no spaces or special characters)');
    }

    return true;
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
        validateBeneficiaryData(req.body);
        const ben = await Beneficiary.create({ ...req.body, created_by: req.user.id });
        res.status(201).json({ success: true, data: ben });
    } catch (err) {
        if (err.message.includes('Mandatory fields') || err.message.includes('digits only') || err.message.includes('strictly alphanumeric') || err.message.includes('alphanumeric only')) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next(err);
    }
};

exports.updateBeneficiary = async (req, res, next) => {
    try {
        const ben = await Beneficiary.findByPk(req.params.id);
        if (!ben) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

        validateBeneficiaryData(req.body, true);
        await ben.update({ ...req.body, updated_by: req.user.id });
        res.json({ success: true, data: ben });
    } catch (err) {
        if (err.message.includes('Mandatory fields') || err.message.includes('digits only') || err.message.includes('strictly alphanumeric') || err.message.includes('alphanumeric only')) {
            return res.status(400).json({ success: false, message: err.message });
        }
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

                // Check for duplicates based on standard account number to prevent overwriting updated data
                const existing = await Beneficiary.findOne({ where: { bank_account_no: accNumber } });
                if (existing) {
                    duplicates++;
                    // Skip existing entries to prevent data loss (don't overwrite manual updates)
                    continue;
                }

                validateBeneficiaryData({
                    beneficiary_name: benName,
                    bank_account_no: accNumber,
                    ifsc_code: ifsc,
                    nature_of_account: keys.natureofaccount || keys.nature || '',
                    account_type: keys.accounttype || '',
                    pan: keys.pan || '',
                    mobile_no: String(keys.mobileno || keys.mobile || keys.contact || '')
                });

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

        // Duplicate Check - Improved to allow retries of failed payments
        const existing = await BankPayment.findOne({
            where: {
                credit_account_number: beneficiary.bank_account_no,
                amount: parseFloat(amount),
                sequential_number: sequential_number || null,
                payment_status: { [Op.ne]: 'failed' }
            }
        });

        if (existing) {
            return res.status(400).json({
                success: false,
                message: `Duplicate Payment: A non-failed payment with these details already exists.`
            });
        }

        const payment = await BankPayment.create({
            beneficiary_id: beneficiary.id,
            batch_id: `MANUAL-${Date.now()}`,
            file_name: 'Manual Entry',
            upload_date: new Date(), // Always actual upload timestamp
            reference_number: req.body.reference_number || null,
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

        const defaultBatchId = `BATCH-${Date.now()}`;
        const fileName = req.file.originalname;

        let created = 0, failed = 0;
        const errors = [];

        for (const r of rows) {
            try {
                const keys = Object.keys(r).reduce((acc, k) => { acc[normalizeHeader(k)] = r[k]; return acc; }, {});

                const rowBatchId = String(keys.batchid || keys.batch_id || keys.batchnumber || keys.id || defaultBatchId).trim();
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

                const uploadDate = new Date(); // Actual upload timestamp
                const seqNo = keys.sequentialnumber || null;
                const refNo = keys.referencenumber || keys.refno || null;
                const remarks = keys.paymentremarks || null;

                // Duplicate Check: Allow retry if previous attempt FAILED
                const existing = await BankPayment.findOne({
                    where: {
                        batch_id: rowBatchId,
                        sequential_number: seqNo,
                        credit_account_number: benAcc,
                        amount: amount,
                        payment_status: { [Op.ne]: 'failed' }
                    }
                });

                if (existing) {
                    failed++;
                    errors.push(`Duplicate Payment: Record exists in Batch ${rowBatchId}. To retry a failed payment, ensure its status is "failed".`);
                    continue;
                }

                await BankPayment.create({
                    beneficiary_id: beneficiary.id,
                    batch_id: rowBatchId,
                    file_name: fileName,
                    upload_date: uploadDate,
                    reference_number: refNo,
                    type_of_account: keys.typeofaccount || beneficiary.account_type || null,
                    amount: amount,
                    vendor_name: keys.vendorname || beneficiary.beneficiary_name,
                    credit_account_number: benAcc,
                    ifsc_code: keys.ifsccode || beneficiary.ifsc_code,
                    nature_of_account: keys.natureofacc || beneficiary.nature_of_account || null,
                    email: keys.emailaddress || keys.email || beneficiary.email,
                    vendor_contact_number: String(keys.vendorcontactnumber || beneficiary.mobile_no || ''),
                    payment_remarks: keys.paymentremarks || null,
                    debit_account_number: String(keys.debitaccountnumber || ''),
                    sequential_number: seqNo,
                    payment_status: 'draft', // Forced to draft regardless of Excel 'status' column
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

        res.json({ success: true, message: 'Payment bulk upload complete', stats: { default_batch_id: defaultBatchId, created, failed, errors } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Bulk upload failed', error: err.message });
    }
};

exports.downloadPaymentsSample = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Payments');

        const headers = [
            'Batch ID', 'Type of account', 'Amount', 'Vendor name', 'Credit account number',
            'Reference Number', 'Email address', 'Payment remarks', 'Debit account number', 'Sequential number',
            'IFSC Code', 'Nature of acc', 'Vendor contact number'
        ];
        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true };

        sheet.addRow([
            'BATCH-101', 'Current', 15000.50, 'John Doe Suppliers', '112233445566',
            'REF-001', 'john@example.com', 'Invoice #123 Payment', '998877665544', '1',
            'ICIC0001122', 'Savings', '9876543210'
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
            'Type of account', 'Amount', 'Upload Date', 'Vendor name', 'Credit account number', 'Reference Number',
            'Email address', 'Payment remarks', 'Debit account number', 'Sequential number',
            'IFSC Code', 'Nature of acc', 'Vendor contact number', 'Payment Status',
            'Payment Declined Reason', 'Batch ID', 'File Name', 'UTR No', 'processed Date'
        ];
        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true };

        payments.forEach(p => {
            sheet.addRow([
                p.type_of_account, parseFloat(p.amount), p.upload_date, p.vendor_name, p.credit_account_number, p.reference_number,
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

