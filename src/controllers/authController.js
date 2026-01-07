const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { ValidationError, ConflictError, AuthenticationError, NotFoundError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { normalizeEmail, hasEmailAlias, getEmailAlias } = require('../utils/emailUtils');

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Generate JWT tokens
const generateTokens = (userId, email) => {
  const accessToken = jwt.sign(
    { id: userId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );

  const refreshToken = jwt.sign(
    { id: userId, email },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

// Send OTP via email and SMS
const sendOTP = async (email, phoneNumber, otp, userName = 'User') => {
  try {
    // Send email OTP
    const emailResult = await emailService.sendOTP(email, otp, userName);
    
    // Log the attempt (without exposing the actual OTP in logs)
    logger.info('OTP sent', { 
      email, 
      phoneNumber, 
      emailSent: emailResult.success,
      mock: emailResult.mock || false
    });
    
    // TODO: Add SMS sending here when needed
    // For now, also log to console for development
    if (process.env.NODE_ENV === 'development') {
      console.log(`📧 EMAIL OTP to ${email}: ${otp}`);
      console.log(`📱 SMS OTP to ${phoneNumber}: ${otp}`);
    }
    
    return emailResult.success;
  } catch (error) {
    logger.error('Failed to send OTP:', error);
    // Fallback: log to console
    console.log(`🔐 [FALLBACK] OTP for ${email}: ${otp}`);
    return false;
  }
};

const authController = {
  async signup(req, res) {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }));
      
      return res.status(400).json({
        status: 'fail',
        message: 'Validation failed',
        errors: errorMessages
      });
    }

    const { fullName, email, phoneNumber, password, confirmPassword } = req.body;

    try {
      // Check if user already exists (using exact email - aliases are treated as different emails)
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email },
            { phoneNumber }
          ]
        }
      });

      if (existingUser) {
        if (existingUser.email === email) {
          throw new ConflictError('User with this email already exists');
        }
        if (existingUser.phoneNumber === phoneNumber) {
          throw new ConflictError('User with this phone number already exists');
        }
      }

      // Hash password
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Generate OTP and expiry
      const otp = generateOTP();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      // Create user in database - each email (including aliases) creates a separate account
      const newUser = await User.create({
        fullName,
        email,
        phoneNumber,
        password: hashedPassword,
        otp,
        otpExpiresAt,
        isVerified: false,
        isActive: false
      });
      
      // Log email alias usage for analytics (but treat as separate account)
      if (hasEmailAlias(email)) {
        logger.info('User signed up with email alias (separate account)', {
          userId: newUser.id,
          email: email,
          alias: getEmailAlias(email)
        });
      }

      // Send OTP
      await sendOTP(email, phoneNumber, otp, fullName);

      // Log signup event
      logger.logSystemEvent('USER_SIGNUP_INITIATED', {
        userId: newUser.id,
        email,
        phoneNumber,
        fullName
      });

      res.status(201).json({
        status: 'success',
        message: 'Signup successful. OTP sent to your email and phone.',
        data: {
          userId: newUser.id,
          email,
          phoneNumber,
          otpSent: true,
          otpExpiresAt: otpExpiresAt.toISOString()
        }
      });

    } catch (error) {
      logger.error('Signup error:', error);
      throw error;
    }
  },

  async verifyOTP(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid input data');
    }

    const { email, otp } = req.body;

    try {
      // Find user by email
      const user = await User.findOne({ where: { email } });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.isVerified) {
        throw new ValidationError('Account is already verified');
      }

      // Check OTP validity
      if (user.otp !== otp) {
        logger.logSecurityEvent('INVALID_OTP_ATTEMPT', {
          email,
          providedOTP: otp,
          ip: req.ip
        });
        throw new AuthenticationError('Invalid OTP');
      }

      // Check OTP expiry
      if (new Date() > user.otpExpiresAt) {
        throw new AuthenticationError('OTP has expired');
      }

      // Activate user account
      await user.update({
        isVerified: true,
        isActive: true,
        otp: null,
        otpExpiresAt: null
      });

      // Generate JWT tokens
      const tokens = generateTokens(user.id, user.email);

      // Send welcome email
      try {
        await emailService.sendWelcomeEmail(user.email, user.fullName);
      } catch (emailError) {
        logger.error('Failed to send welcome email:', emailError);
        // Don't fail the verification if email fails
      }

      // Log successful verification
      logger.logSystemEvent('USER_ACCOUNT_VERIFIED', {
        userId: user.id,
        email: user.email
      });

      res.status(200).json({
        status: 'success',
        message: 'Account verified successfully',
        data: {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            isVerified: user.isVerified,
            onboarding: {
              isCompleted: user.onboardingCompleted,
              currentStep: user.onboardingStep
            }
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
          }
        }
      });

    } catch (error) {
      logger.error('OTP verification error:', error);
      throw error;
    }
  },

  async resendOTP(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid email address');
    }

    const { email } = req.body;

    try {
      // Find user by email
      const user = await User.findOne({ where: { email } });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      if (user.isVerified) {
        throw new ValidationError('Account is already verified');
      }

      // Generate new OTP
      const newOtp = generateOTP();
      const newOtpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Update user with new OTP
      await user.update({
        otp: newOtp,
        otpExpiresAt: newOtpExpiresAt
      });

      // Send new OTP
      await sendOTP(user.email, user.phoneNumber, newOtp, user.fullName);

      // Log resend event
      logger.logSystemEvent('OTP_RESEND', {
        userId: user.id,
        email: user.email
      });

      res.status(200).json({
        status: 'success',
        message: 'New OTP sent to your email and phone',
        data: {
          email: user.email,
          phoneNumber: user.phoneNumber,
          otpExpiresAt: newOtpExpiresAt.toISOString()
        }
      });

    } catch (error) {
      logger.error('Resend OTP error:', error);
      throw error;
    }
  },

  async login(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Invalid email or password');
    }

    const { email, password } = req.body;

    try {
      // Find user by email
      const user = await User.findOne({ where: { email } });

      if (!user) {
        throw new AuthenticationError('Invalid email or password');
      }

      // Verify password FIRST before checking account status
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        logger.logSecurityEvent('INVALID_LOGIN_ATTEMPT', {
          email,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        throw new AuthenticationError('Invalid email or password');
      }

      // Only check verification status AFTER password is confirmed correct
      if (!user.isVerified) {
        throw new AuthenticationError('Please verify your account first');
      }

      if (!user.isActive) {
        throw new AuthenticationError('Account is inactive');
      }

      // Update last login time
      await user.update({
        lastLoginAt: new Date()
      });

      // Generate tokens
      const tokens = generateTokens(user.id, user.email);

      // Log successful login
      logger.logSystemEvent('USER_LOGIN_SUCCESS', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            isVerified: user.isVerified,
            onboarding: {
              isCompleted: user.onboardingCompleted,
              currentStep: user.onboardingStep
            },
            pregnancyInfo: user.getSafeUserInfo().pregnancyInfo
          },
          tokens: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: process.env.JWT_EXPIRES_IN || '24h'
          }
        }
      });

    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    }
  },

  async refreshToken(req, res) {
    // TODO: Implement refresh token logic
    res.status(200).json({
      status: 'success',
      message: 'Refresh token endpoint ready - awaiting implementation'
    });
  },

  async logout(req, res) {
    try {
      const userId = req.user?.id;
      const userEmail = req.user?.email;

      // Log the logout event
      logger.logSystemEvent('USER_LOGOUT', {
        userId: userId || 'unknown',
        email: userEmail || 'unknown',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Note: In a production environment with Redis or database-based token blacklisting,
      // you would add the current token to a blacklist here.
      // For now, we rely on client-side token removal.

      res.status(200).json({
        status: 'success',
        message: 'Logout successful'
      });

    } catch (error) {
      logger.error('Logout error:', error);
      // Even if logging fails, we should still return success for logout
      res.status(200).json({
        status: 'success',
        message: 'Logout successful'
      });
    }
  },

  async forgotPassword(req, res) {
    // TODO: Implement forgot password logic
    res.status(200).json({
      status: 'success',
      message: 'Forgot password endpoint ready - awaiting implementation'
    });
  },

  async resetPassword(req, res) {
    // TODO: Implement reset password logic
    res.status(200).json({
      status: 'success',
      message: 'Reset password endpoint ready - awaiting implementation'
    });
  }
};

module.exports = authController; 