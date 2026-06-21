/**
 * Global Error Handler Middleware
 * Handles all errors thrown in the application
 * Never exposes raw database errors to the client in production
 */

/**
 * Global error handler middleware
 * @param {Error} err - Error object
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 * @param {import('express').NextFunction} next - Express next function
 */
export const errorHandler = (err, req, res, next) => {
  // Log error for debugging (in production, use proper logging service)
  console.error('Error:', {
    message: err.message,
    name: err.name,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
  });
  
  // Log full stack in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Full error stack:', err.stack);
  }

  // Handle Zod validation errors
  if (err.name === 'ZodError' && err.errors && Array.isArray(err.errors)) {
    const errorMessages = err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    return res.status(400).json({
      success: false,
      data: null,
      error: `Validation error: ${errorMessages}`,
      meta: process.env.NODE_ENV === 'development' ? { details: err.errors } : null,
    });
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errorMessages = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    return res.status(400).json({
      success: false,
      data: null,
      error: `Validation error: ${errorMessages}`,
      meta: null,
    });
  }

  // Handle Mongoose duplicate key errors (MongoError and MongoBulkWriteError)
  if (err.code === 11000) {
    let message = 'A record with this value already exists';
    const keyPattern = err.keyPattern ?? err.writeErrors?.[0]?.err?.keyPattern;
    if (keyPattern && typeof keyPattern === 'object') {
      const fields = Object.keys(keyPattern);
      if (fields.length > 0) {
        message = `Duplicate: ${fields.join(', ')} combination already exists`;
      }
    }
    return res.status(409).json({
      success: false,
      data: null,
      error: message,
      meta: null,
    });
  }

  // Handle Mongoose cast errors (invalid ObjectId, etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      data: null,
      error: 'Invalid ID format',
      meta: null,
    });
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Invalid token',
      meta: null,
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      data: null,
      error: 'Token expired',
      meta: null,
    });
  }

  // Default error response
  // Preserve user-facing 4xx messages (auth, validation, etc.); mask only 5xx in production
  const status = err.statusCode || 500;
  const isUserFacing = status >= 400 && status < 500;
  const errorMessage =
    process.env.NODE_ENV === 'production' && !isUserFacing
      ? 'An internal server error occurred'
      : err.message || 'An unexpected error occurred';

  return res.status(status).json({
    success: false,
    data: null,
    error: errorMessage,
    ...(err.openFindings ? { openFindings: err.openFindings } : {}),
    meta: {
      ...(err.code ? { code: err.code } : {}),
      ...(err.user ? { user: err.user } : {}),
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
  });
};

/**
 * 404 Not Found handler
 * @param {import('express').Request} req - Express request object
 * @param {import('express').Response} res - Express response object
 */
export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    data: null,
    error: `Route ${req.method} ${req.path} not found`,
    meta: null,
  });
};
