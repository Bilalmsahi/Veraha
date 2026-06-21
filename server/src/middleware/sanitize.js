/**
 * Input Sanitization Middleware
 * 
 * Protects against NoSQL injection and XSS attacks.
 * Apply early in the middleware chain.
 */

/**
 * Dangerous MongoDB operators that should never appear in user input
 * These can be used for injection attacks
 */
const DANGEROUS_OPERATORS = ['$where', '$regex', '$function', '$accumulator', '$expr'];

/**
 * Sanitize object keys and values to prevent NoSQL injection
 * Only blocks dangerous MongoDB operators, allows legitimate $or, $and, etc.
 * 
 * SECURITY NOTE: We block specific dangerous operators rather than all $ operators
 * to support legitimate query use cases while preventing injection attacks.
 * 
 * @param {Object} obj - Object to sanitize
 * @param {string} path - Current path for logging
 * @param {number} depth - Current recursion depth
 * @returns {Object} Sanitized object
 */
function sanitizeObject(obj, path = '', depth = 0) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map((item, index) => sanitizeObject(item, `${path}[${index}]`, depth + 1));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        // Block dangerous MongoDB operators at any level
        if (DANGEROUS_OPERATORS.some(op => key.startsWith(op))) {
            console.warn(`[Sanitize] Blocked dangerous operator: ${path}.${key}`);
            continue;
        }

        // Block dot notation keys (prototype pollution prevention)
        if (key.includes('.')) {
            console.warn(`[Sanitize] Blocked key with dot notation: ${path}.${key}`);
            continue;
        }

        sanitized[key] = sanitizeObject(value, `${path}.${key}`, depth + 1);
    }

    return sanitized;
}

/**
 * Sanitize string to prevent XSS
 * Escapes HTML special characters
 */
function escapeHtml(str) {
    if (typeof str !== 'string') return str;

    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

/**
 * Deep sanitize an object for XSS
 */
function sanitizeXss(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'string') {
        return escapeHtml(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(sanitizeXss);
    }

    if (typeof obj === 'object') {
        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeXss(value);
        }
        return sanitized;
    }

    return obj;
}

function shouldPreservePolicyContentHtml(req) {
    const method = req.method?.toUpperCase();
    if (method !== 'POST' && method !== 'PATCH') return false;

    return /^\/api\/v1\/policies\/[^/]+\/versions(?:\/[^/]+)?$/.test(req.path || '');
}

/**
 * MongoDB Injection Prevention Middleware
 * Sanitizes req.body and req.params
 * 
 * Note: req.query is read-only in Express, so we skip sanitizing it globally.
 * If query sanitization is needed, handle it per-route or use req.sanitizedQuery.
 */
export const mongoSanitize = (req, res, next) => {
    if (req.body) {
        req.body = sanitizeObject(req.body, 'body');
    }
    if (req.params) {
        req.params = sanitizeObject(req.params, 'params');
    }
    next();
};

/**
 * XSS Prevention Middleware
 * Sanitizes string values in request body
 * 
 * Note: Use selectively - some fields (like HTML content) may need raw values
 */
export const xssSanitize = (req, res, next) => {
    // Only sanitize body - query params are typically not rendered as HTML
    if (req.body) {
        const preserved = {};
        if (shouldPreservePolicyContentHtml(req) && req.body.contentHtml !== undefined) {
            preserved.contentHtml = req.body.contentHtml;
        }

        req.body = sanitizeXss(req.body);

        if (Object.prototype.hasOwnProperty.call(preserved, 'contentHtml')) {
            req.body.contentHtml = preserved.contentHtml;
        }
    }
    next();
};

/**
 * Combined sanitization middleware
 * Apply both NoSQL and XSS protection
 */
export const sanitizeMiddleware = [mongoSanitize, xssSanitize];

/**
 * Selective XSS sanitize - skip specific fields
 * Useful when some fields should allow HTML (like policy content)
 */
export const xssSanitizeExcept = (excludeFields = []) => {
    return (req, res, next) => {
        if (req.body) {
            const preserved = {};

            // Preserve excluded fields
            for (const field of excludeFields) {
                if (req.body[field] !== undefined) {
                    preserved[field] = req.body[field];
                }
            }

            // Sanitize the rest
            req.body = sanitizeXss(req.body);

            // Restore preserved fields
            Object.assign(req.body, preserved);
        }
        next();
    };
};

export default {
    mongoSanitize,
    xssSanitize,
    sanitizeMiddleware,
    xssSanitizeExcept,
};
