const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/contentSourceController');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../middleware/auth');
const { requireCmsRole } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

/**
 * @swagger
 * tags:
 *   - name: CMS - Sources
 *     description: Content source registry (CMS spec §3.2, §4)
 * components:
 *   schemas:
 *     ContentSource:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string, enum: [WHO, NHS, MedlinePlus, ACOG, FMOH, YouTube, Original] }
 *         type: { type: string, enum: [api, manual_curation, original] }
 *         apiEndpoint: { type: string, nullable: true }
 *         syncFrequency: { type: string, enum: [daily, weekly, monthly, manual] }
 *         licenseType: { type: string }
 *         attributionRequired: { type: boolean }
 *         active: { type: boolean }
 */

const createValidators = [
  body('name').isIn(['WHO', 'NHS', 'MedlinePlus', 'ACOG', 'FMOH', 'YouTube', 'Original']).withMessage('invalid source name'),
  body('type').isIn(['api', 'manual_curation', 'original']).withMessage('invalid source type'),
  body('licenseType').isString().notEmpty().withMessage('licenseType is required'),
  body('syncFrequency').optional().isIn(['daily', 'weekly', 'monthly', 'manual']),
  body('attributionRequired').optional().isBoolean(),
  body('active').optional().isBoolean()
];

/**
 * @swagger
 * /api/v1/content-sources:
 *   get:
 *     tags: [CMS - Sources]
 *     security: [{ bearerAuth: [] }]
 *     summary: List content sources
 *     responses:
 *       200: { description: List of sources }
 *   post:
 *     tags: [CMS - Sources]
 *     security: [{ bearerAuth: [] }]
 *     summary: Register a content source (admin)
 *     responses:
 *       201: { description: Source created }
 */
router.get('/', requireCmsRole('editor', 'reviewer', 'publisher', 'admin'), asyncHandler(controller.list));
router.post('/', requireCmsRole('admin'), createValidators, asyncHandler(controller.create));

/**
 * @swagger
 * /api/v1/content-sources/{id}:
 *   get:
 *     tags: [CMS - Sources]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Source }, 404: { description: Not found } }
 *   patch:
 *     tags: [CMS - Sources]
 *     security: [{ bearerAuth: [] }]
 *     summary: Update a content source (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Updated } }
 */
router.get('/:id', requireCmsRole('editor', 'reviewer', 'publisher', 'admin'), asyncHandler(controller.getById));
router.patch('/:id', requireCmsRole('admin'), asyncHandler(controller.update));

module.exports = router;
