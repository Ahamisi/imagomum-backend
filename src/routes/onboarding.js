const express = require('express');
const { body } = require('express-validator');
const onboardingController = require('../controllers/onboardingController');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * @swagger
 * components:
 *   schemas:
 *     OnboardingStatus:
 *       type: object
 *       properties:
 *         isCompleted:
 *           type: boolean
 *         currentStep:
 *           type: integer
 *         totalSteps:
 *           type: integer
 *         currentQuestion:
 *           type: object
 *         pregnancyInfo:
 *           type: object
 *     
 *     OnboardingAnswer:
 *       type: object
 *       required:
 *         - questionId
 *         - answerType
 *         - answer
 *       properties:
 *         questionId:
 *           type: string
 *           enum: [lmp_date]
 *         answerType:
 *           type: string
 *           enum: [exact_date, approximate_month]
 *         answer:
 *           oneOf:
 *             - type: string
 *               format: date
 *               description: LMP date in YYYY-MM-DD format
 *             - type: object
 *               properties:
 *                 month:
 *                   type: integer
 *                   minimum: 1
 *                   maximum: 12
 *                 year:
 *                   type: integer
 *                   minimum: 2020
 *                   maximum: 2030
 *     
 *     PregnancyInfo:
 *       type: object
 *       properties:
 *         edd:
 *           type: string
 *           format: date
 *         eddFormatted:
 *           type: string
 *         gestationalAge:
 *           type: string
 *         gestationalWeeks:
 *           type: integer
 *         trimester:
 *           type: string
 *         lmpDate:
 *           type: string
 *           format: date
 *         isApproximate:
 *           type: boolean
 */

/**
 * @swagger
 * /api/v1/onboarding/status:
 *   get:
 *     summary: Get user's onboarding status
 *     description: Returns current onboarding progress, current question, and pregnancy information if available
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/OnboardingStatus'
 */
router.get('/status', asyncHandler(onboardingController.getOnboardingStatus));

/**
 * @swagger
 * /api/v1/onboarding/submit:
 *   post:
 *     summary: Submit answer to onboarding question
 *     description: |
 *       Submit answers for onboarding questions. Currently supports LMP date collection.
 *       
 *       **For exact LMP date:**
 *       ```json
 *       {
 *         "questionId": "lmp_date",
 *         "answerType": "exact_date", 
 *         "answer": "2024-06-26"
 *       }
 *       ```
 *       
 *       **For approximate month:**
 *       ```json
 *       {
 *         "questionId": "lmp_date",
 *         "answerType": "approximate_month",
 *         "answer": { "month": 6, "year": 2024 }
 *       }
 *       ```
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OnboardingAnswer'
 *           examples:
 *             exact_date:
 *               summary: Exact LMP Date
 *               value:
 *                 questionId: "lmp_date"
 *                 answerType: "exact_date"
 *                 answer: "2024-06-26"
 *             approximate_month:
 *               summary: Approximate Month
 *               value:
 *                 questionId: "lmp_date"
 *                 answerType: "approximate_month"
 *                 answer:
 *                   month: 6
 *                   year: 2024
 *     responses:
 *       200:
 *         description: Answer submitted successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     isCompleted:
 *                       type: boolean
 *                     pregnancyInfo:
 *                       $ref: '#/components/schemas/PregnancyInfo'
 *                     nextQuestion:
 *                       type: object
 *       400:
 *         description: Validation error
 *       404:
 *         description: User not found
 */
router.post('/submit', [
  body('questionId')
    .notEmpty()
    .withMessage('Question ID is required'),
  
  body('answerType')
    .isIn(['exact_date', 'approximate_month'])
    .withMessage('Answer type must be "exact_date" or "approximate_month"'),
  
  body('answer')
    .custom((value, { req }) => {
      if (req.body.answerType === 'exact_date') {
        // Validate date string
        if (typeof value !== 'string' || !value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          throw new Error('Date must be in YYYY-MM-DD format');
        }
        
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          throw new Error('Invalid date');
        }
        
        // Check if date is not in the future
        if (date > new Date()) {
          throw new Error('LMP date cannot be in the future');
        }
        
        // Check if date is not too far in the past (1 year)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (date < oneYearAgo) {
          throw new Error('LMP date cannot be more than 1 year ago');
        }
        
      } else if (req.body.answerType === 'approximate_month') {
        // Validate month/year object
        if (typeof value !== 'object' || !value.month || !value.year) {
          throw new Error('Month answer must include month and year');
        }
        
        if (value.month < 1 || value.month > 12) {
          throw new Error('Month must be between 1 and 12');
        }
        
        const currentYear = new Date().getFullYear();
        if (value.year < currentYear - 1 || value.year > currentYear) {
          throw new Error('Year must be current year or previous year');
        }
      }
      
      return true;
    })
], asyncHandler(onboardingController.submitAnswer));

/**
 * @swagger
 * /api/v1/onboarding/config:
 *   get:
 *     summary: Get onboarding configuration
 *     description: Returns the available onboarding questions and configuration for the frontend
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     version:
 *                       type: string
 *                     totalSteps:
 *                       type: integer
 *                     questions:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get('/config', asyncHandler(onboardingController.getOnboardingConfig));

/**
 * @swagger
 * /api/v1/onboarding/skip:
 *   post:
 *     summary: Skip onboarding
 *     description: Allows users to skip the onboarding process (for future use)
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding skipped successfully
 */
router.post('/skip', asyncHandler(onboardingController.skipOnboarding));

/**
 * @swagger
 * /api/v1/onboarding/restart:
 *   post:
 *     summary: Restart onboarding
 *     description: Resets the onboarding process to the beginning
 *     tags: [Onboarding]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Onboarding restarted successfully
 */
router.post('/restart', asyncHandler(onboardingController.restartOnboarding));

module.exports = router; 