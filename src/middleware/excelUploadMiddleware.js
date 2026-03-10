const multer = require('multer');
const path = require('path');

// Use memory storage so req.file.buffer is naturally available
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;

    // Allow Excel/CSV files by checking both extension and mime types
    const allowedExts = ['.xlsx', '.xls', '.csv'];
    const allowedMimes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
    ];

    if (allowedExts.includes(ext) || allowedMimes.includes(mime)) {
        cb(null, true);
    } else {
        cb(new Error('Only Excel (.xlsx, .xls) and CSV files are allowed!'), false);
    }
};

const uploadExcel = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit for bulk files
    }
});

module.exports = uploadExcel;
