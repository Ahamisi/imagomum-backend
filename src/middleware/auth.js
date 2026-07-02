const jwt = require('jsonwebtoken');
const { AuthenticationError, AuthorizationError } = require('./errorHandler');
const logger = require('../utils/logger');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Access token required');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    if (!token) {
      throw new AuthenticationError('Access token required');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Add user to request object (will be expanded when User model is created)
    req.user = {
      id: decoded.id,
      email: decoded.email,
      userType: decoded.userType,
      isEmailVerified: decoded.isEmailVerified
    };

    // Log authentication event
    logger.debug('User authenticated', {
      userId: req.user.id,
      userType: req.user.userType,
      route: req.originalUrl,
      method: req.method
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Token expired');
    } else {
      throw error;
    }
  }
};

// Middleware to check user type
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.userType)) {
      logger.logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
        userId: req.user.id,
        userType: req.user.userType,
        requiredRoles: allowedRoles,
        route: req.originalUrl,
        ip: req.ip
      });
      
      throw new AuthenticationError('Access denied for this user type');
    }
    next();
  };
};

/**
 * CMS RBAC guard. Must run after `auth`. Loads the user's cms_role from the DB
 * (the JWT does not carry it) and rejects anyone whose role is not allowed.
 * On success attaches the full Sequelize user as req.cmsUser for downstream use.
 *
 * Usage: router.post('/x', auth, requireCmsRole('editor', 'admin'), handler)
 */
const requireCmsRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const user = await User.findByPk(req.user.id);

      if (!user || !user.cmsRole || !allowedRoles.includes(user.cmsRole)) {
        logger.logSecurityEvent?.('CMS_UNAUTHORIZED_ACCESS_ATTEMPT', {
          userId: req.user.id,
          cmsRole: user?.cmsRole || null,
          requiredRoles: allowedRoles,
          route: req.originalUrl,
          ip: req.ip
        });
        throw new AuthorizationError('CMS access denied: requires one of [' + allowedRoles.join(', ') + ']');
      }

      req.cmsUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware to check email verification
const requireEmailVerification = (req, res, next) => {
  if (!req.user.isEmailVerified) {
    throw new AuthenticationError('Email verification required');
  }
  next();
};

module.exports = auth;
module.exports.auth = auth;
module.exports.authorize = authorize;
module.exports.requireCmsRole = requireCmsRole;
module.exports.requireEmailVerification = requireEmailVerification; 