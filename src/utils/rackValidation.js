// Rack Code Format Validation Utility

/**
 * Validates rack code format
 * Supports:
 * - Numeric: 1-10, 1-999, etc.
 * - Alphanumeric: 1A-1Z, A1-Z9, etc.
 * @param {string} rackCode - The rack code to validate
 * @returns {boolean} - True if valid format
 */
exports.validateRackCode = (rackCode) => {
    if (!rackCode || typeof rackCode !== 'string') {
        return false;
    }

    const trimmed = rackCode.trim();
    
    // Numeric format: 1, 10, 123, etc.
    const numericPattern = /^\d+$/;
    
    // Alphanumeric formats:
    // 1A, 1Z, 10A, etc. (number followed by letter)
    // A1, Z9, AA1, etc. (letter(s) followed by number)
    // A1B, 1A2, etc. (mixed)
    const alphanumericPattern = /^[A-Za-z0-9]+$/;
    
    // Must contain at least one character
    if (trimmed.length === 0) {
        return false;
    }
    
    // Check if it matches numeric or alphanumeric pattern
    if (numericPattern.test(trimmed) || alphanumericPattern.test(trimmed)) {
        return true;
    }
    
    return false;
};

/**
 * Get rack code format type
 * @param {string} rackCode
 * @returns {string} - 'numeric', 'alphanumeric', or 'invalid'
 */
exports.getRackCodeType = (rackCode) => {
    if (!this.validateRackCode(rackCode)) {
        return 'invalid';
    }
    
    const numericPattern = /^\d+$/;
    return numericPattern.test(rackCode.trim()) ? 'numeric' : 'alphanumeric';
};

/**
 * Normalize rack code (uppercase, trim)
 * @param {string} rackCode
 * @returns {string}
 */
exports.normalizeRackCode = (rackCode) => {
    if (!rackCode) return '';
    return rackCode.trim().toUpperCase();
};
