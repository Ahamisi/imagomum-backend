const express = require('express');
const controller = require('../controllers/deliveryController');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

/**
 * @swagger
 * tags:
 *   - name: Deliveries
 *     description: Mobile weekly-delivery read API (CMS spec §7, §10)
 *
 * /api/v1/deliveries/current:
 *   get:
 *     summary: Get the authenticated mother's current weekly delivery
 *     description: >
 *       Returns the most recent precomputed WeeklyDelivery for the user, nested
 *       as topics -> content items -> media assets, for the full-screen Stories
 *       UI. Only published + medically-approved items are included. Marks a
 *       delivered delivery as opened.
 *     tags: [Deliveries]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The current delivery (or null if none exists yet)
 *       401:
 *         description: Unauthenticated
 */
router.get('/current', asyncHandler(controller.getCurrent));

module.exports = router;
