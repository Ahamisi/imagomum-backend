const express = require('express');
const controller = require('../controllers/deliveryController');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

/**
 * @swagger
 * tags:
 *   - name: Content Library
 *     description: Evergreen browse-by-category content (CMS spec §9)
 *
 * /api/v1/content-library:
 *   get:
 *     summary: Browse the evergreen content library, optionally by category
 *     description: >
 *       Returns published + medically-approved library topics (nested as
 *       topics -> items -> media) for the category tabs. Week-agnostic and
 *       distinct from the personalised weekly delivery.
 *     tags: [Content Library]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [nutrition, baby_dev, antenatal_care, mental_health, warning_signs, exercise, wellness, symptoms, postpartum_prep]
 *         description: Filter to a single category; omit for all
 *     responses:
 *       200:
 *         description: Library topics
 *       401:
 *         description: Unauthenticated
 */
router.get('/', asyncHandler(controller.getLibrary));

module.exports = router;
