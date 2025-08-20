const logger = require('../utils/logger');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
  }
}

class MedicalDataError extends AppError {
  constructor(message = 'Medical data processing error') {
    super(message, 422);
  }
}

// Handle different types of errors
const handleSequelizeError = (error) => {
  if (error.name === 'SequelizeValidationError') {
    const errors = error.errors.map(err => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));
    return new ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    const field = error.errors[0]?.path || 'field';
    return new ConflictError(`${field} already exists`);
  }

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return new ValidationError('Invalid reference to related resource');
  }

  if (error.name === 'SequelizeDatabaseError') {
    return new AppError('Database operation failed', 500, false);
  }

  return new AppError(error.message, 500, false);
};

const handleJWTError = (error) => {
  if (error.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  if (error.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }
  return new AuthenticationError('Token verification failed');
};

const handleMulterError = (error) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return new ValidationError('File size too large');
  }
  if (error.code === 'LIMIT_FILE_COUNT') {
    return new ValidationError('Too many files');
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return new ValidationError('Unexpected file field');
  }
  return new ValidationError('File upload error');
};

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
};

const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      timestamp: new Date().toISOString()
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('ERROR', err);
    
    res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString()
    });
  }
};

// Main error handling middleware
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;
  error.status = err.status || 'error';

  // Enhanced logging for JSON parsing errors
  if (error.message && error.message.includes('JSON')) {
    console.log('🚨 ===== JSON PARSING ERROR DEBUG =====');
    console.log('🚨 Error Message:', error.message);
    console.log('🚨 Request Headers:', JSON.stringify(req.headers, null, 2));
    console.log('🚨 Content-Type:', req.headers['content-type']);
    console.log('🚨 Content-Length:', req.headers['content-length']);
    console.log('🚨 Raw Body Type:', typeof req.body);
    console.log('🚨 Body Keys:', Object.keys(req.body || {}));
    console.log('🚨 Body Content:', JSON.stringify(req.body, null, 2));
    console.log('🚨 ===== END JSON ERROR DEBUG =====');
  }

  // Log error with context
  logger.error('Error occurred:', {
    message: error.message,
    statusCode: error.statusCode,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id || 'anonymous',
    body: req.method !== 'GET' ? req.body : undefined,
    params: req.params,
    query: req.query,
    stack: error.stack
  });

  // Handle specific error types
  if (error.name && error.name.startsWith('Sequelize')) {
    error = handleSequelizeError(error);
  } else if (error.name && error.name.includes('JsonWebToken')) {
    error = handleJWTError(error);
  } else if (error.code && error.code.startsWith('LIMIT_')) {
    error = handleMulterError(error);
  }

  // Send error response
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, res);
  } else {
    sendErrorProd(error, res);
  }
};

// Async error wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  MedicalDataError
}; 