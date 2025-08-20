const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { asyncHandler } = require('../middleware/errorHandler');
const auth = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(auth);

/**
 * @swagger
 * /api/v1/appointments:
 *   post:
 *     summary: Schedule new appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Appointment scheduled successfully
 */
router.post('/', asyncHandler(appointmentController.scheduleAppointment));

/**
 * @swagger
 * /api/v1/appointments:
 *   get:
 *     summary: Get user's appointments
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointments retrieved successfully
 */
router.get('/', asyncHandler(appointmentController.getAppointments));

/**
 * @swagger
 * /api/v1/appointments/{id}:
 *   put:
 *     summary: Update appointment status
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Appointment updated successfully
 */
router.put('/:id', asyncHandler(appointmentController.updateAppointment));

module.exports = router; 