const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 */
router.get('/profile', asyncHandler(userController.getProfile));

/**
 * @swagger
 * /api/v1/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *                 description: User's full name
 *               phoneNumber:
 *                 type: string
 *                 description: User's phone number
 *     responses:
 *       200:
 *         description: Profile updated successfully
 */
router.put('/profile', 
  [
    body('fullName').optional().isLength({ min: 2, max: 100 }).withMessage('Full name must be 2-100 characters'),
    body('phoneNumber').optional().isMobilePhone().withMessage('Invalid phone number format')
  ],
  asyncHandler(userController.updateProfile)
);

/**
 * @swagger
 * /api/v1/users/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: Current password
 *               newPassword:
 *                 type: string
 *                 description: New password (min 8 chars, must contain uppercase, lowercase, number, special char)
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation failed or current password incorrect
 */
router.put('/change-password',
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ],
  asyncHandler(userController.changePassword)
);

module.exports = router; 