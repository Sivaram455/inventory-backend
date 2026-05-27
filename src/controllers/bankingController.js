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
    const { beneficiary_name, bank_account_no, ifsc_code, nature_of_account, account_type, pan, mobile_no } = data;

    if (!isUpdate) {
        if (!beneficiary_name || !bank_account_no || !ifsc_code || !nature_of_account || !account_type) {
            throw new Error('Mandatory fields missing (Account Name, Account Number, IFSC Code, Nature of Account, Account Type)');
        }
    }

    // IFSC Code: Strictly 11 characters, alphanumeric
    if (ifsc_code && !/^[A-Z]{4}[A-Z0-9]{7}$/i.test(ifsc_code)) {
        throw new Error('IFSC Code must be exactly 11 alphanumeric characters long');
    }

    // Mobile Number: 10 digits only
    if (mobile_no && !/^\d{10}$/.test(mobile_no)) {
        throw new Error('Mobile number must be exactly 10 digits only');
    }

    // PAN: 10 characters, alphanumeric
    if (pan && !/^[A-Z0-9]{10}$/i.test(pan)) {
        throw new Error('PAN card must be exactly 10 characters and strictly alphanumeric');
    }

    // Account Number: Alphanumeric only
    if (bank_account_no && !/^[A-Z0-9]+$/i.test(bank_account_no)) {
        throw new Error('Account number must be alphanumeric only');
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
        if (err.message.includes('Mandatory fields') || err.message.includes('IFSC Code') || err.message.includes('digits only') || err.message.includes('strictly alphanumeric') || err.message.includes('alphanumeric only')) {
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
        if (err.message.includes('Mandatory fields') || err.message.includes('IFSC Code') || err.message.includes('digits only') || err.message.includes('strictly alphanumeric') || err.message.includes('alphanumeric only')) {
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

                const natureRaw = String(keys.natureofaccount || keys.nature || '').toLowerCase();
                const natureOfAcc = natureRaw.includes('savings') ? '10' : (natureRaw.includes('current') ? '11' : keys.natureofaccount);

                const typeRaw = String(keys.accounttype || keys.type || '').toLowerCase();
                const accType = typeRaw.includes('neft') ? 'N' : (typeRaw.includes('internal') || typeRaw.includes('axis') ? 'I' : keys.accounttype);

                validateBeneficiaryData({
                    beneficiary_name: benName,
                    bank_account_no: accNumber,
                    ifsc_code: ifsc,
                    nature_of_account: natureOfAcc,
                    account_type: accType,
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
                    nature_of_account: natureOfAcc,
                    account_type: accType,
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
        const { beneficiary_id, amount, payment_remarks, upload_date } = req.body;
        if (!beneficiary_id || !amount) {
            return res.status(400).json({ success: false, message: 'Beneficiary and amount are required' });
        }
        if (parseFloat(amount) <= 0) {
            return res.status(400).json({ success: false, message: 'Amount must be greater than zero' });
        }

        const beneficiary = await Beneficiary.findByPk(beneficiary_id);
        if (!beneficiary) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

        // Auto-increment sequential number for this batch
        const lastPayment = await BankPayment.findOne({
            order: [['sequential_number', 'DESC']]
        });
        const nextSeq = (lastPayment?.sequential_number || 0) + 1;

        const payment = await BankPayment.create({
            beneficiary_id: beneficiary.id,
            batch_id: `PENDING`,
            file_name: 'Manual Entry',
            upload_date: upload_date ? new Date(upload_date) : new Date(),
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
            debit_account_number: '921020054774358', // Static FDS Axis Account
            sequential_number: nextSeq,
            payment_status: 'draft',
            created_by: req.user.id
        });
        res.status(201).json({ success: true, data: payment });
    } catch (err) {
        next(err);
    }
};

exports.updatePayment = async (req, res, next) => {
    try {
        const payment = await BankPayment.findByPk(req.params.id);
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

        // Only allow editing if NOT yet reconciled or processed
        if (!['draft', 'pending', 'generated'].includes(payment.payment_status) || payment.utr_number) {
            return res.status(400).json({ success: false, message: 'Only draft, pending, or generated payments without a UTR number can be edited' });
        }

        const { beneficiary_id, amount, payment_remarks, upload_date, reference_number } = req.body;

        if (beneficiary_id && beneficiary_id !== payment.beneficiary_id) {
            const beneficiary = await Beneficiary.findByPk(beneficiary_id);
            if (!beneficiary) return res.status(404).json({ success: false, message: 'Beneficiary not found' });
            
            req.body.vendor_name = beneficiary.beneficiary_name;
            req.body.credit_account_number = beneficiary.bank_account_no;
            req.body.ifsc_code = beneficiary.ifsc_code;
            req.body.type_of_account = beneficiary.account_type;
            req.body.nature_of_account = beneficiary.nature_of_account;
            req.body.email = beneficiary.email;
            req.body.vendor_contact_number = beneficiary.mobile_no;
        }

        await payment.update({ ...req.body, updated_by: req.user.id });
        res.json({ success: true, data: payment });
    } catch (err) {
        next(err);
    }
};

exports.deletePayment = async (req, res, next) => {
    try {
        const payment = await BankPayment.findByPk(req.params.id);
        if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

        // Only allow deleting if NOT yet processed
        if (payment.utr_number || payment.payment_status === 'success') {
            return res.status(400).json({ success: false, message: 'Processed payments cannot be deleted' });
        }

        await payment.destroy();
        res.json({ success: true, message: 'Payment deleted' });
    } catch (err) {
        next(err);
    }
};

exports.generateBankFile = async (req, res) => {
    try {
        const { paymentIds, batchId } = req.body;
        if (!paymentIds || !paymentIds.length) return res.status(400).json({ message: 'No payments selected' });
        if (!batchId) return res.status(400).json({ message: 'Batch ID is required' });

        const payments = await BankPayment.findAll({
            where: { id: paymentIds },
            include: [{ model: Beneficiary }]
        });

        // Validation
        for (const p of payments) {
            if (parseFloat(p.amount) <= 0) {
                return res.status(400).json({ success: false, message: `Payment to ${p.vendor_name} has zero amount. Please update it first.` });
            }
            if (p.ifsc_code?.length !== 11) {
                return res.status(400).json({ success: false, message: `Payment to ${p.vendor_name} has an invalid IFSC code (${p.ifsc_code || 'Empty'}). Axis Bank requires exactly 11 characters.` });
            }
        }

        const fileName = `${batchId}.xlsx`;

        // Update payments with Batch ID and status
        await BankPayment.update(
            { batch_id: batchId, file_name: fileName, payment_status: 'generated' },
            { where: { id: paymentIds } }
        );

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Axis_Batch_Upload');

        // Header mapping as per Part B (Cols 1-12)
        const headers = [
            'Type of account', 'Amount', 'Upload Date', 'Vendor name', 'Credit account number',
            'Email address', 'Payment remarks', 'Debit account number', 'Sequential number',
            'IFSC Code', 'Nature of acc', 'Vendor contact number'
        ];
        sheet.addRow(headers);
        sheet.getRow(1).font = { bold: true };

        payments.forEach(p => {
            const upDate = p.upload_date ? new Date(p.upload_date) : new Date();
            const formattedDate = `${String(upDate.getDate()).padStart(2, '0')}/${String(upDate.getMonth() + 1).padStart(2, '0')}/${upDate.getFullYear()}`;
            sheet.addRow([
                p.type_of_account,
                parseFloat(p.amount),
                formattedDate,
                p.vendor_name,
                p.credit_account_number,
                p.email,
                p.payment_remarks || 'Payment',
                p.debit_account_number || '921020054774358',
                p.sequential_number,
                p.ifsc_code,
                p.nature_of_account,
                p.vendor_contact_number
            ]);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.uploadBankReport = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'Report file is required' });

        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

        let updated = 0, failed = 0;
        const errors = [];

        for (const r of rows) {
            try {
                const keys = Object.keys(r).reduce((acc, k) => { acc[normalizeHeader(k)] = r[k]; return acc; }, {});
                
                // Match by Vendor Name and Credit Account Number (more robust than just name)
                const vendorName = keys.vendorname;
                const accNo = keys.creditaccountnumber;
                const seqNo = keys.sequentialnumber;

                const payment = await BankPayment.findOne({
                    where: {
                        vendor_name: vendorName,
                        credit_account_number: accNo,
                        sequential_number: seqNo,
                        payment_status: 'generated'
                    }
                });

                if (payment) {
                    const status = (keys.paymentstatus || '').toLowerCase().includes('success') ? 'success' : 'failed';
                    await payment.update({
                        payment_status: status,
                        payment_declined_reason: keys.paymentdeclinedreason || null,
                        batch_id: keys.batchid || payment.batch_id,
                        file_name: keys.filename || payment.file_name,
                        utr_number: keys.utrno || keys.utrnumber || null,
                        processed_date: keys.processeddate ? new Date(keys.processeddate) : new Date()
                    });
                    updated++;
                } else {
                    failed++;
                }
            } catch (err) {
                failed++;
                errors.push(err.message);
            }
        }

        res.json({ success: true, message: 'Report reconciliation complete', stats: { updated, failed, errors } });
    } catch (err) {
        res.status(500).json({ message: 'Reconciliation failed', error: err.message });
    }
};

exports.retryPayment = async (req, res) => {
    try {
        const original = await BankPayment.findByPk(req.params.id, {
            include: [{ model: Beneficiary }]
        });
        if (!original) return res.status(404).json({ message: 'Payment not found' });
        if (original.payment_status !== 'failed' && original.payment_status !== 'generated') {
             // Allow retry for generated if they want to re-generate with fixed data
        }

        const beneficiary = original.Beneficiary;
        if (!beneficiary) return res.status(404).json({ message: 'Linked beneficiary not found' });

        const lastPayment = await BankPayment.findOne({ order: [['sequential_number', 'DESC']] });
        const nextSeq = (lastPayment?.sequential_number || 0) + 1;

        const retry = await BankPayment.create({
            beneficiary_id: beneficiary.id,
            batch_id: 'PENDING',
            file_name: 'Retry Entry',
            upload_date: new Date(),
            reference_number: original.reference_number,
            type_of_account: beneficiary.account_type,
            amount: original.amount,
            vendor_name: beneficiary.beneficiary_name,
            credit_account_number: beneficiary.bank_account_no,
            ifsc_code: beneficiary.ifsc_code,
            nature_of_account: beneficiary.nature_of_account,
            email: beneficiary.email,
            vendor_contact_number: beneficiary.mobile_no,
            payment_remarks: original.payment_remarks,
            debit_account_number: original.debit_account_number,
            sequential_number: nextSeq,
            payment_status: 'draft',
            created_by: req.user.id
        });

        res.json({ success: true, data: retry });
    } catch (err) {
        res.status(500).json({ message: err.message });
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

