const express = require('express');
const { body } = require('express-validator');
const testController = require('../controllers/testController');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

/**
 * @swagger
 * /api/v1/test/email:
 *   post:
 *     summary: Test email service
 *     description: Send a test email to verify email service configuration
 *     tags: [Testing]
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
 *               testType:
 *                 type: string
 *                 enum: [otp, welcome]
 *                 default: otp
 *                 example: otp
 *     responses:
 *       200:
 *         description: Email test completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Email test completed
 *                 data:
 *                   type: object
 *                   properties:
 *                     emailSent:
 *                       type: boolean
 *                     emailServiceConfigured:
 *                       type: boolean
 *                     messageId:
 *                       type: string
 *                     error:
 *                       type: string
 *       400:
 *         description: Invalid request
 *       500:
 *         description: Server error
 */
router.post('/email', [
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('testType')
    .optional()
    .isIn(['otp', 'welcome'])
    .withMessage('Test type must be "otp" or "welcome"')
], asyncHandler(testController.testEmail));

/**
 * @swagger
 * /api/v1/test/health:
 *   get:
 *     summary: Health check
 *     description: Check the health status of the application and its services
 *     tags: [Testing]
 *     responses:
 *       200:
 *         description: Health check completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Health check completed
 *                 data:
 *                   type: object
 *                   properties:
 *                     server:
 *                       type: string
 *                       example: running
 *                     database:
 *                       type: string
 *                       example: connected
 *                     emailService:
 *                       type: object
 *                       properties:
 *                         configured:
 *                           type: boolean
 *                         hasCredentials:
 *                           type: boolean
 *       500:
 *         description: Server error
 */
router.get('/health', asyncHandler(testController.healthCheck));

module.exports = router;
