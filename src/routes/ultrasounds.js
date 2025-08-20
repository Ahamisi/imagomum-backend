const express = require('express');
const { body, param, query } = require('express-validator');
const auth = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const ultrasoundController = require('../controllers/ultrasoundController');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     UltrasoundScan:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique scan identifier
 *         originalFileName:
 *           type: string
 *           description: Original filename of uploaded scan
 *         scanType:
 *           type: string
 *           enum: ['2D', '3D', '4D', 'Doppler', 'Other']
 *           description: Type of ultrasound scan
 *         gestationalAge:
 *           type: string
 *           description: Gestational age at time of scan
 *         scanDate:
 *           type: string
 *           format: date
 *           description: Date when scan was performed
 *         notes:
 *           type: string
 *           description: User notes about the scan
 *         aiAnalysisStatus:
 *           type: string
 *           enum: ['pending', 'processing', 'completed', 'failed', 'error']
 *           description: Status of AI analysis
 *         aiAnalysis:
 *           type: object
 *           description: AI analysis results
 *         medicalReview:
 *           type: object
 *           description: Medical review information
 *         createdAt:
 *           type: string
 *           format: date-time
 *         viewCount:
 *           type: integer
 *           description: Number of times scan was viewed
 */

/**
 * @swagger
 * /api/v1/ultrasounds/upload:
 *   post:
 *     summary: Upload ultrasound scan for AI analysis
 *     tags: [Ultrasounds]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - ultrasound_image
 *             properties:
 *               ultrasound_image:
 *                 type: string
 *                 format: binary
 *                 description: Ultrasound image file (JPEG, PNG, BMP, TIFF, DICOM)
 *               scanType:
 *                 type: string
 *                 enum: ['2D', '3D', '4D', 'Doppler', 'Other']
 *                 description: Type of ultrasound scan
 *               gestationalAge:
 *                 type: string
 *                 description: Gestational age (e.g., "20 weeks 3 days")
 *               scanDate:
 *                 type: string
 *                 format: date
 *                 description: Date when scan was performed
 *               notes:
 *                 type: string
 *                 description: Optional notes about the scan
 *     responses:
 *       201:
 *         description: Scan uploaded successfully
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
 *                     scan:
 *                       $ref: '#/components/schemas/UltrasoundScan'
 *       400:
 *         description: Invalid file or missing required fields
 *       409:
 *         description: Duplicate scan (same file already uploaded)
 *       413:
 *         description: File too large (max 50MB)
 *       415:
 *         description: Unsupported file type
 */
router.post('/upload',
  auth,
  // File upload middleware
  (req, res, next) => {
    ultrasoundController.uploadMiddleware(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            status: 'fail',
            message: 'File too large. Maximum size is 50MB.'
          });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            status: 'fail',
            message: 'Only one file is allowed.'
          });
        }
        return next(err);
      }
      next();
    });
  },
  // Validation
  [
    body('scanType')
      .optional()
      .customSanitizer(value => {
        if (!value) return value;
        // Convert to uppercase and handle common variations
        const normalized = value.toString().toUpperCase().trim();
        const validTypes = {
          '2D': '2D',
          '3D': '3D', 
          '4D': '4D',
          'DOPPLER': 'Doppler',
          'OTHER': 'Other'
        };
        return validTypes[normalized] || normalized;
      })
      .isIn(['2D', '3D', '4D', 'Doppler', 'Other'])
      .withMessage('Invalid scan type. Use: 2D, 3D, 4D, Doppler, or Other'),
    body('gestationalAge').optional().isLength({ min: 1, max: 50 }).withMessage('Gestational age must be 1-50 characters'),
    body('scanDate').optional().isISO8601().withMessage('Invalid scan date format'),
    body('notes').optional().isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters')
  ],
  asyncHandler(ultrasoundController.uploadScan)
);

/**
 * @swagger
 * /api/v1/ultrasounds:
 *   get:
 *     summary: Get user's ultrasound scans
 *     tags: [Ultrasounds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of scans per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: ['pending', 'processing', 'completed', 'failed', 'error']
 *         description: Filter by AI analysis status
 *       - in: query
 *         name: scanType
 *         schema:
 *           type: string
 *           enum: ['2D', '3D', '4D', 'Doppler', 'Other']
 *         description: Filter by scan type
 *     responses:
 *       200:
 *         description: List of user's ultrasound scans
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
 *                     scans:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UltrasoundScan'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalCount:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 */
router.get('/',
  auth,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'error']).withMessage('Invalid status'),
    query('scanType').optional().isIn(['2D', '3D', '4D', 'Doppler', 'Other']).withMessage('Invalid scan type')
  ],
  asyncHandler(ultrasoundController.getUserScans)
);

/**
 * @swagger
 * /api/v1/ultrasounds/{scanId}:
 *   get:
 *     summary: Get detailed information about a specific scan
 *     tags: [Ultrasounds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scanId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Scan ID
 *     responses:
 *       200:
 *         description: Detailed scan information
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
 *                     scan:
 *                       $ref: '#/components/schemas/UltrasoundScan'
 *       404:
 *         description: Scan not found
 */
router.get('/:scanId',
  auth,
  [
    param('scanId').isUUID().withMessage('Invalid scan ID format')
  ],
  asyncHandler(ultrasoundController.getScanDetails)
);

/**
 * @swagger
 * /api/v1/ultrasounds/{scanId}/download:
 *   get:
 *     summary: Download ultrasound scan file
 *     tags: [Ultrasounds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scanId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Scan ID
 *     responses:
 *       200:
 *         description: Scan file download
 *         content:
 *           image/*:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Scan or file not found
 */
router.get('/:scanId/download',
  auth,
  [
    param('scanId').isUUID().withMessage('Invalid scan ID format')
  ],
  asyncHandler(ultrasoundController.downloadScan)
);

/**
 * @swagger
 * /api/v1/ultrasounds/{scanId}:
 *   delete:
 *     summary: Archive (soft delete) an ultrasound scan
 *     tags: [Ultrasounds]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scanId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Scan ID
 *     responses:
 *       200:
 *         description: Scan archived successfully
 *       404:
 *         description: Scan not found
 */
router.delete('/:scanId',
  auth,
  [
    param('scanId').isUUID().withMessage('Invalid scan ID format')
  ],
  asyncHandler(ultrasoundController.deleteScan)
);

/**
 * @swagger
 * /api/v1/ultrasounds/ai/health:
 *   get:
 *     summary: Check AI service health status
 *     tags: [Ultrasounds]
 *     responses:
 *       200:
 *         description: AI service health status
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
 *                     aiService:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: ['healthy', 'unhealthy']
 *                         response:
 *                           type: object
 *                         latency:
 *                           type: string
 *                         error:
 *                           type: string
 */
router.get('/ai/health',
  asyncHandler(ultrasoundController.getAIServiceHealth)
);

module.exports = router; 