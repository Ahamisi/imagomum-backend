const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../middleware/auth');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SignupRequest:
 *       type: object
 *       required:
 *         - fullName
 *         - email
 *         - phoneNumber
 *         - password
 *         - confirmPassword
 *       properties:
 *         fullName:
 *           type: string
 *           example: "Warith Yellow"
 *           description: "User's full name"
 *         email:
 *           type: string
 *           format: email
 *           example: "yellow@gmail.com"
 *           description: "User's email address"
 *         phoneNumber:
 *           type: string
 *           example: "909038303993"
 *           description: "User's phone number"
 *         password:
 *           type: string
 *           minLength: 8
 *           example: "SecurePass123!"
 *           description: "Password (minimum 8 characters)"
 *         confirmPassword:
 *           type: string
 *           example: "SecurePass123!"
 *           description: "Password confirmation (must match password)"
 *     SignupResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           example: "success"
 *         message:
 *           type: string
 *           example: "Signup successful. OTP sent to your email and phone."
 *         data:
 *           type: object
 *           properties:
 *             userId:
 *               type: string
 *               format: uuid
 *               example: "123e4567-e89b-12d3-a456-426614174000"
 *             email:
 *               type: string
 *               example: "yellow@gmail.com"
 *             phoneNumber:
 *               type: string
 *               example: "909038303993"
 *             otpSent:
 *               type: boolean
 *               example: true
 *             otpExpiresAt:
 *               type: string
 *               format: date-time
 *               example: "2024-01-15T10:15:00Z"
 */

/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     summary: Register a new user
 *     description: |
 *       Creates a new user account and sends a 6-digit OTP for verification.
 *       
 *       **Process:**
 *       1. User submits signup form
 *       2. Server validates input and creates user account
 *       3. 6-digit OTP is generated and sent to email and phone
 *       4. User needs to verify OTP using `/verify-otp` endpoint
 *       
 *       **OTP Details:**
 *       - 6-digit numeric code
 *       - Valid for 10 minutes
 *       - Sent to both email and SMS
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *           example:
 *             fullName: "Warith Yellow"
 *             email: "yellow@gmail.com"
 *             phoneNumber: "909038303993"
 *             password: "SecurePass123!"
 *             confirmPassword: "SecurePass123!"
 *     responses:
 *       201:
 *         description: Signup successful, OTP sent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SignupResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "fail"
 *                 message:
 *                   type: string
 *                   example: "Validation failed"
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       field:
 *                         type: string
 *                         example: "email"
 *                       message:
 *                         type: string
 *                         example: "Invalid email format"
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "fail"
 *                 message:
 *                   type: string
 *                   example: "User with this email or phone number already exists"
 */
router.post('/signup', [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Full name can only contain letters and spaces'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('phoneNumber')
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
    .isLength({ min: 10, max: 15 })
    .withMessage('Phone number must be between 10 and 15 digits'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
], asyncHandler(authController.signup));

/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     summary: Verify OTP and activate account
 *     description: |
 *       Verifies the 6-digit OTP sent during signup and activates the user account.
 *       
 *       **Process:**
 *       1. User enters 6-digit OTP received via email/SMS
 *       2. Server validates OTP and expiry time
 *       3. Account is activated and JWT tokens are issued
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "yellow@gmail.com"
 *               otp:
 *                 type: string
 *                 example: "123456"
 *                 description: "6-digit OTP code"
 *           example:
 *             email: "yellow@gmail.com"
 *             otp: "123456"
 *     responses:
 *       200:
 *         description: OTP verified successfully, account activated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Account verified successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         fullName:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phoneNumber:
 *                           type: string
 *                         isVerified:
 *                           type: boolean
 *                           example: true
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         expiresIn:
 *                           type: string
 *                           example: "24h"
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 */
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 }).isNumeric()
], asyncHandler(authController.verifyOTP));

/**
 * @swagger
 * /api/v1/auth/resend-otp:
 *   post:
 *     summary: Resend OTP
 *     description: Resends a new 6-digit OTP to user's email and phone number
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "yellow@gmail.com"
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *       400:
 *         description: Invalid email or user already verified
 *       404:
 *         description: User not found
 */
router.post('/resend-otp', [
  body('email').isEmail().normalizeEmail()
], asyncHandler(authController.resendOTP));

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account not verified
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], asyncHandler(authController.login));

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', [
  body('refreshToken').notEmpty()
], asyncHandler(authController.refreshToken));

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', auth, asyncHandler(authController.logout));

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Password reset email sent
 *       404:
 *         description: User not found
 */
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], asyncHandler(authController.forgotPassword));

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     summary: Reset password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Invalid or expired token
 */
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
], asyncHandler(authController.resetPassword));

/**
 * @swagger
 * /api/v1/auth/test-email:
 *   post:
 *     summary: Test email service
 *     description: Send a test email to verify email service configuration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: test@example.com
 *     responses:
 *       200:
 *         description: Email test completed
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/test-email', [
  body('email').isEmail().withMessage('Valid email is required')
], asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;
    
    logger.info('Testing email service via auth route', { email });

    // Send test OTP
    const testOTP = '123456';
    const result = await emailService.sendOTP(email, testOTP, 'Test User');
    
    // Check email service configuration
    const isConfigured = emailService.isConfigured();
    
    res.status(200).json({
      status: 'success',
      message: 'Email test completed',
      data: {
        email,
        emailServiceConfigured: isConfigured,
        emailSent: result.success,
        messageId: result.messageId || null,
        error: result.error || null,
        mock: result.mock || false,
        fallback: result.fallback || false,
        accepted: result.accepted || null,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          hasEmailUser: !!process.env.EMAIL_USER,
          hasEmailPassword: !!process.env.EMAIL_PASSWORD,
          emailUser: process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 5) + '***' : 'undefined'
        }
      }
    });

  } catch (error) {
    logger.error('Email test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Email test failed',
      error: error.message
    });
  }
}));

/**
 * @swagger
 * /api/v1/auth/debug-user:
 *   post:
 *     summary: Debug user existence
 *     description: Check if user exists with given email (for debugging)
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Debug info returned
 */
router.post('/debug-user', [
  body('email').isEmail().withMessage('Valid email is required')
], asyncHandler(async (req, res) => {
  try {
    const { email } = req.body;
    const User = require('../models/User');
    
    // Check if user exists with exact email
    const exactUser = await User.findOne({ where: { email } });
    
    // Check all users with similar emails (for debugging)
    const similarUsers = await User.findAll({
      where: {
        email: {
          [require('sequelize').Op.like]: `%${email.split('@')[0]}%`
        }
      },
      attributes: ['id', 'email', 'fullName', 'createdAt']
    });
    
    res.status(200).json({
      status: 'success',
      message: 'Debug info retrieved',
      data: {
        searchEmail: email,
        exactUserExists: !!exactUser,
        exactUser: exactUser ? {
          id: exactUser.id,
          email: exactUser.email,
          fullName: exactUser.fullName,
          createdAt: exactUser.createdAt
        } : null,
        similarUsers: similarUsers.map(user => ({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          createdAt: user.createdAt
        })),
        totalSimilarUsers: similarUsers.length
      }
    });

  } catch (error) {
    logger.error('Debug user error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Debug failed',
      error: error.message
    });
  }
}));

module.exports = router; 