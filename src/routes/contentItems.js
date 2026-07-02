const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/contentItemController');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../middleware/auth');
const { requireCmsRole } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

const ANY_STAFF = ['editor', 'reviewer', 'publisher', 'admin'];

/**
 * @swagger
 * tags:
 *   - name: CMS - Content
 *     description: ContentItem editorial lifecycle & medical review (CMS spec §3.3, §6, §8)
 * components:
 *   schemas:
 *     ContentItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         title: { type: string, maxLength: 200 }
 *         body: { type: string, description: Markdown }
 *         contentType: { type: string, enum: [tip, nutrition, baby_dev, warning_sign, scan_info, mental_health, antenatal_prep, exercise] }
 *         gestationalWeekMin: { type: integer, minimum: 1, maximum: 42 }
 *         gestationalWeekMax: { type: integer, minimum: 1, maximum: 42 }
 *         trimester: { type: integer, enum: [1, 2, 3] }
 *         sourceId: { type: string, format: uuid, nullable: true }
 *         sourceUrl: { type: string, nullable: true }
 *         localizedForNigeria: { type: boolean }
 *         culturalContext: { type: string, enum: [universal, nigerian, west_african] }
 *         tags: { type: array, items: { type: string } }
 *         status: { type: string, enum: [draft, under_review, approved, published, archived] }
 *     ContentItemCreate:
 *       type: object
 *       required: [title, body, contentType]
 *       properties:
 *         title: { type: string }
 *         body: { type: string }
 *         contentType: { type: string, enum: [tip, nutrition, baby_dev, warning_sign, scan_info, mental_health, antenatal_prep, exercise] }
 *         gestationalWeekMin: { type: integer }
 *         gestationalWeekMax: { type: integer }
 *         trimester: { type: integer }
 *         sourceId: { type: string, format: uuid }
 *         sourceUrl: { type: string }
 *         localizedForNigeria: { type: boolean }
 *         culturalContext: { type: string }
 *         tags: { type: array, items: { type: string } }
 */

const createValidators = [
  body('title').isString().trim().isLength({ min: 1, max: 200 }).withMessage('title is required (<=200 chars)'),
  body('body').isString().notEmpty().withMessage('body is required'),
  body('contentType').isIn(['tip', 'nutrition', 'baby_dev', 'warning_sign', 'scan_info', 'mental_health', 'antenatal_prep', 'exercise']).withMessage('invalid contentType'),
  body('gestationalWeekMin').optional().isInt({ min: 1, max: 42 }),
  body('gestationalWeekMax').optional().isInt({ min: 1, max: 42 }),
  body('trimester').optional().isInt({ min: 1, max: 3 }),
  body('sourceId').optional().isUUID(),
  body('culturalContext').optional().isIn(['universal', 'nigerian', 'west_african'])
];

const mediaValidators = [
  body('type').isIn(['image', 'video_embed', 'video_file', 'infographic']).withMessage('invalid media type'),
  body('url').isString().notEmpty().withMessage('url is required'),
  body('licenseType').isString().notEmpty().withMessage('licenseType is required'),
  body('youtubeVideoId').optional().isString().isLength({ max: 20 })
];

// ---- CRUD ----

/**
 * @swagger
 * /api/v1/content-items:
 *   get:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: List/filter content items (Content Library View)
 *     parameters:
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: contentType, schema: { type: string } }
 *       - { in: query, name: gestationalWeek, schema: { type: integer } }
 *       - { in: query, name: sourceId, schema: { type: string } }
 *       - { in: query, name: localizedForNigeria, schema: { type: boolean } }
 *       - { in: query, name: culturalContext, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses: { 200: { description: Paginated content items } }
 *   post:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: Create a draft content item (editor)
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { $ref: '#/components/schemas/ContentItemCreate' } } }
 *     responses: { 201: { description: Draft created } }
 */
router.get('/', requireCmsRole(...ANY_STAFF), asyncHandler(controller.list));
router.post('/', requireCmsRole('editor', 'admin'), createValidators, asyncHandler(controller.create));

/**
 * @swagger
 * /api/v1/content-items/{id}:
 *   get:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Content item with source, media, review }, 404: { description: Not found } }
 *   patch:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: Edit a draft content item (editor)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Updated }, 409: { description: Not editable in current status } }
 */
router.get('/:id', requireCmsRole(...ANY_STAFF), asyncHandler(controller.getById));
router.patch('/:id', requireCmsRole('editor', 'admin'), asyncHandler(controller.update));

/**
 * @swagger
 * /api/v1/content-items/{id}/versions:
 *   get:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: Append-only body version / approval audit trail
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Version history } }
 */
router.get('/:id/versions', requireCmsRole(...ANY_STAFF), asyncHandler(controller.getVersions));

/**
 * @swagger
 * /api/v1/content-items/{id}/media:
 *   post:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: Attach a media asset (editor)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 201: { description: Media attached } }
 */
router.post('/:id/media', requireCmsRole('editor', 'admin'), mediaValidators, asyncHandler(controller.addMedia));

// ---- Workflow transitions ----

/**
 * @swagger
 * /api/v1/content-items/{id}/submit-for-review:
 *   post:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: Submit draft for medical review; assigns a reviewer (editor)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reviewerId]
 *             properties:
 *               reviewerId: { type: string, format: uuid }
 *               reviewerCredentials: { type: string }
 *     responses: { 200: { description: Under review }, 409: { description: Invalid status transition } }
 */
router.post('/:id/submit-for-review',
  requireCmsRole('editor', 'admin'),
  [body('reviewerId').isUUID().withMessage('reviewerId (uuid) is required')],
  asyncHandler(controller.submitForReview));

/**
 * @swagger
 * /api/v1/content-items/{id}/approve:
 *   post:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: Approve the pending review (assigned reviewer)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Approved + audit version written } }
 */
router.post('/:id/approve', requireCmsRole('reviewer', 'admin'), asyncHandler(controller.approve));

/**
 * @swagger
 * /api/v1/content-items/{id}/request-revision:
 *   post:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: Request revision with mandatory notes (assigned reviewer)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [notes], properties: { notes: { type: string } } } } }
 *     responses: { 200: { description: Returned to editor }, 400: { description: notes required } }
 */
router.post('/:id/request-revision',
  requireCmsRole('reviewer', 'admin'),
  [body('notes').isString().trim().notEmpty().withMessage('notes are required')],
  asyncHandler(controller.requestRevision));

/**
 * @swagger
 * /api/v1/content-items/{id}/publish:
 *   post:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: Publish an approved item (publisher) - GATE enforces approved review
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Published }, 409: { description: Publish gate failed } }
 */
router.post('/:id/publish', requireCmsRole('publisher', 'admin'), asyncHandler(controller.publish));

/**
 * @swagger
 * /api/v1/content-items/{id}/revise:
 *   post:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: Edit body of an approved/published item; triggers re-review (editor)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content: { application/json: { schema: { type: object, required: [body], properties: { body: { type: string } } } } }
 *     responses: { 200: { description: Back under review } }
 */
router.post('/:id/revise',
  requireCmsRole('editor', 'admin'),
  [body('body').isString().notEmpty().withMessage('body is required')],
  asyncHandler(controller.revise));

/**
 * @swagger
 * /api/v1/content-items/{id}/archive:
 *   post:
 *     tags: [CMS - Content]
 *     security: [{ bearerAuth: [] }]
 *     summary: Archive an item (publisher/admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     responses: { 200: { description: Archived } }
 */
router.post('/:id/archive', requireCmsRole('publisher', 'admin'), asyncHandler(controller.archive));

module.exports = router;
