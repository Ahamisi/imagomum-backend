const express = require('express');
const { body } = require('express-validator');
const controller = require('../controllers/cmsAdminController');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../middleware/auth');
const { requireCmsRole } = require('../middleware/auth');

const router = express.Router();
router.use(auth);

/**
 * @swagger
 * tags:
 *   - name: CMS - Admin
 *     description: CMS staff/role management (CMS spec §10 RBAC)
 *
 * /api/v1/cms-admin/staff:
 *   get:
 *     tags: [CMS - Admin]
 *     security: [{ bearerAuth: [] }]
 *     summary: List all CMS staff and their roles (admin)
 *     responses: { 200: { description: Staff list } }
 *
 * /api/v1/cms-admin/users/{id}/role:
 *   patch:
 *     tags: [CMS - Admin]
 *     security: [{ bearerAuth: [] }]
 *     summary: Grant or revoke a CMS role for a user (admin)
 *     parameters: [{ in: path, name: id, required: true, schema: { type: string, format: uuid } }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cmsRole: { type: string, enum: [editor, reviewer, publisher, admin], nullable: true }
 *               cmsCredentials: { type: string }
 *     responses: { 200: { description: Role updated } }
 */
router.get('/staff', requireCmsRole('admin'), asyncHandler(controller.listStaff));
router.patch('/users/:id/role',
  requireCmsRole('admin'),
  [body('cmsRole').optional({ nullable: true }).isIn(['editor', 'reviewer', 'publisher', 'admin']).withMessage('invalid cmsRole')],
  asyncHandler(controller.setRole));

module.exports = router;
