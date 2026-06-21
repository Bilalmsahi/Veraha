/**
 * Standardized Error Messages
 * 
 * Centralizes all error messages for consistency across the application.
 * Use these constants instead of hardcoding error strings.
 */

// =============================================================================
// AUTHENTICATION ERRORS
// =============================================================================

export const AuthErrors = {
    AUTH_REQUIRED: 'Authentication required',
    INVALID_TOKEN: 'Invalid or expired token',
    TOKEN_EXPIRED: 'Token expired - please log in again',
    INVALID_CREDENTIALS: 'Invalid email or password',
    ACCOUNT_DISABLED: 'Account has been disabled',
    ACCOUNT_DELETED: 'Account no longer exists',
    MFA_REQUIRED: 'Multi-factor authentication required',
    MFA_INVALID: 'Invalid MFA code',
};

// =============================================================================
// AUTHORIZATION ERRORS
// =============================================================================

export const AuthzErrors = {
    INSUFFICIENT_PERMISSIONS: 'Insufficient permissions for this action',
    ORG_ACCESS_DENIED: 'Access denied to this organization',
    AUDITOR_READ_ONLY: 'Auditors have read-only access',
    ADMIN_ONLY: 'This action requires administrator privileges',
    OWNER_ONLY: 'Only the owner can perform this action',
    ROLE_NOT_ALLOWED: (role, action) => `Role '${role}' is not authorized to ${action}`,
};

// =============================================================================
// VALIDATION ERRORS
// =============================================================================

export const ValidationErrors = {
    INVALID_ID: 'Invalid ID format',
    REQUIRED_FIELD: (field) => `${field} is required`,
    INVALID_ENUM: (field, allowed) => `${field} must be one of: ${allowed.join(', ')}`,
    INVALID_FORMAT: (field, format) => `${field} must be in ${format} format`,
    MIN_LENGTH: (field, min) => `${field} must be at least ${min} characters`,
    MAX_LENGTH: (field, max) => `${field} must be at most ${max} characters`,
    MIN_VALUE: (field, min) => `${field} must be at least ${min}`,
    MAX_VALUE: (field, max) => `${field} must be at most ${max}`,
    INVALID_DATE_RANGE: 'End date must be after start date',
    INVALID_EMAIL: 'Invalid email format',
    WEAK_PASSWORD: 'Password must be at least 12 characters with uppercase, lowercase, number, and special character',
};

// =============================================================================
// NOT FOUND ERRORS
// =============================================================================

export const NotFoundErrors = {
    NOT_FOUND: (entity) => `${entity} not found`,
    USER_NOT_FOUND: 'User not found',
    ORG_NOT_FOUND: 'Organization not found',
    CONTROL_NOT_FOUND: 'Control not found',
    EVIDENCE_NOT_FOUND: 'Evidence not found',
    POLICY_NOT_FOUND: 'Policy not found',
    RISK_NOT_FOUND: 'Risk not found',
    AUDIT_NOT_FOUND: 'Audit not found',
};

// =============================================================================
// DUPLICATE/CONFLICT ERRORS
// =============================================================================

export const ConflictErrors = {
    ALREADY_EXISTS: (field) => `${field} already exists`,
    EMAIL_IN_USE: 'Email is already in use',
    IDENTIFIER_IN_USE: 'Identifier is already in use',
    DUPLICATE_ENTRY: (entity) => `Duplicate ${entity} entry`,
};

// =============================================================================
// BUSINESS LOGIC ERRORS
// =============================================================================

export const BusinessErrors = {
    ALREADY_DELETED: 'Resource is already deleted',
    CANNOT_DELETE: (reason) => `Cannot delete: ${reason}`,
    CANNOT_MODIFY: (reason) => `Cannot modify: ${reason}`,
    OPERATION_FAILED: (operation) => `${operation} failed`,
    IMMUTABLE: 'This resource cannot be modified',
    INVALID_STATE: (current, required) => `Invalid state: expected ${required}, got ${current}`,
    DEPENDENCY_EXISTS: (entity) => `Cannot delete: ${entity} has dependencies`,
};

// =============================================================================
// INTEGRATION ERRORS
// =============================================================================

export const IntegrationErrors = {
    CONNECTION_FAILED: (service) => `Failed to connect to ${service}`,
    TIMEOUT: (service) => `${service} request timed out`,
    RATE_LIMITED: 'Rate limit exceeded - please try again later',
    SERVICE_UNAVAILABLE: (service) => `${service} is currently unavailable`,
};

// =============================================================================
// COMBINED EXPORT
// =============================================================================

export const ErrorMessages = {
    ...AuthErrors,
    ...AuthzErrors,
    ...ValidationErrors,
    ...NotFoundErrors,
    ...ConflictErrors,
    ...BusinessErrors,
    ...IntegrationErrors,
};

export default ErrorMessages;
