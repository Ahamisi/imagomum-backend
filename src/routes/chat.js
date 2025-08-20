const express = require('express');
const { body, param, query } = require('express-validator');
const authenticate = require('../middleware/auth');
const audioWebSocketService = require('../services/audioWebSocketService');

// Inlined validate middleware
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const { ValidationError } = require('../middleware/errorHandler');
    throw new ValidationError('Invalid input data', errors.array());
  }
  next();
};

const chatController = require('../controllers/chatController');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatConversation:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         threadId:
 *           type: string
 *         title:
 *           type: string
 *         lastMessage:
 *           type: string
 *         lastMessageAt:
 *           type: string
 *           format: date-time
 *         messageCount:
 *           type: integer
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     ChatMessage:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         messageType:
 *           type: string
 *           enum: [user, assistant]
 *         contentType:
 *           type: string
 *           enum: [text, image, voice, file]
 *         content:
 *           type: string
 *         attachmentUrl:
 *           type: string
 *         attachmentType:
 *           type: string
 *         attachmentSize:
 *           type: integer
 *         isStreaming:
 *           type: boolean
 *         streamingComplete:
 *           type: boolean
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     
 *     ChatFileUpload:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         originalName:
 *           type: string
 *         fileName:
 *           type: string
 *         filePath:
 *           type: string
 *         cloudUrl:
 *           type: string
 *         fileSize:
 *           type: integer
 *         mimeType:
 *           type: string
 *         uploadedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/v1/chat/audio/connect:
 *   get:
 *     summary: Upgrade to WebSocket for audio chat
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       101:
 *         description: WebSocket connection established
 *       401:
 *         description: Unauthorized
 */
router.get('/audio/connect', authenticate, (req, res) => {
  // This will be handled by WebSocket upgrade
  res.status(426).json({
    status: 'fail',
    message: 'Upgrade Required - Use WebSocket connection'
  });
});

/**
 * @swagger
 * /api/v1/chat/threads:
 *   get:
 *     summary: Get user's chat threads (like ChatGPT thread list)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of threads per page
 *     responses:
 *       200:
 *         description: Threads retrieved successfully
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
 *                     threads:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           threadId:
 *                             type: string
 *                           title:
 *                             type: string
 *                           firstMessageAt:
 *                             type: string
 *                             format: date-time
 *                           lastActivityAt:
 *                             type: string
 *                             format: date-time
 *                           lastMessage:
 *                             type: string
 *                           totalMessages:
 *                             type: integer
 *                     pagination:
 *                       type: object
 */
router.get('/threads',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validate,
  chatController.getThreads
);

/**
 * @swagger
 * /api/v1/chat/threads/{threadId}/messages:
 *   get:
 *     summary: Get all messages in a specific thread
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: string
 *         description: Thread ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: Thread messages retrieved successfully
 */
router.get('/threads/:threadId/messages',
  authenticate,
  [
    param('threadId').notEmpty().withMessage('Thread ID is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validate,
  chatController.getThreadMessages
);

/**
 * @swagger
 * /api/v1/chat/conversations:
 *   get:
 *     summary: Get user's chat conversations
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of conversations per page
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
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
 *                     conversations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ChatConversation'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         hasNext:
 *                           type: boolean
 */
router.get('/conversations',
  authenticate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validate,
  chatController.getConversations
);

/**
 * @swagger
 * /api/v1/chat/conversations/{conversationId}/messages:
 *   get:
 *     summary: Get messages for a specific conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Conversation ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of messages per page
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
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
 *                     conversation:
 *                       $ref: '#/components/schemas/ChatConversation'
 *                     messages:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ChatMessage'
 *                     pagination:
 *                       type: object
 */
router.get('/conversations/:conversationId/messages',
  authenticate,
  [
    param('conversationId').isUUID().withMessage('Invalid conversation ID'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  validate,
  chatController.getConversationMessages
);

/**
 * @swagger
 * /api/v1/chat/message:
 *   post:
 *     summary: Send a regular chat message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               conversationId:
 *                 type: string
 *                 format: uuid
 *                 description: Existing conversation ID (optional for new conversations)
 *               threadId:
 *                 type: string
 *                 description: Thread ID (optional, will be generated if not provided)
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 description: User message content
 *               imagePath:
 *                 type: string
 *                 description: Path to uploaded image (optional)
 *     responses:
 *       200:
 *         description: Message sent successfully
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
 *                     conversation:
 *                       $ref: '#/components/schemas/ChatConversation'
 *                     userMessage:
 *                       $ref: '#/components/schemas/ChatMessage'
 *                     aiMessage:
 *                       $ref: '#/components/schemas/ChatMessage'
 *                     aiResponse:
 *                       type: object
 */
router.post('/message',
  authenticate,
  [
    body('threadId').optional().isString().withMessage('Thread ID must be a string'),
    body('conversationId').optional().isUUID().withMessage('Invalid conversation ID'),
    body('message').notEmpty().withMessage('Message is required'),
    body('imagePath').optional().isString().withMessage('Image path must be a string')
  ],
  validate,
  chatController.sendMessage
);

/**
 * @swagger
 * /api/v1/chat/stream:
 *   post:
 *     summary: Send a streaming chat message
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               conversationId:
 *                 type: string
 *                 format: uuid
 *                 description: Existing conversation ID (optional for new conversations)
 *               threadId:
 *                 type: string
 *                 description: Thread ID (optional, will be generated if not provided)
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 description: User message content
 *               imagePath:
 *                 type: string
 *                 description: Path to uploaded image (optional)
 *     responses:
 *       200:
 *         description: Streaming response (Server-Sent Events)
 *         content:
 *           text/event-stream:
 *             schema:
 *               type: string
 *               description: SSE stream with JSON chunks
 */
router.post('/stream',
  authenticate,
  [
    body('threadId').optional().isString().withMessage('Thread ID must be a string'),
    body('conversationId').optional().isUUID().withMessage('Invalid conversation ID'),
    body('message').notEmpty().withMessage('Message is required'),
    body('imagePath').optional().isString().withMessage('Image path must be a string')
  ],
  validate,
  chatController.sendStreamingMessage
);

/**
 * @swagger
 * /api/v1/chat/upload:
 *   post:
 *     summary: Upload file for chat (image/voice)
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Image or audio file to upload
 *     responses:
 *       200:
 *         description: File uploaded successfully
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
 *                     file:
 *                       $ref: '#/components/schemas/ChatFileUpload'
 */
router.post('/upload',
  authenticate,
  chatController.uploadChatFile
);

/**
 * @swagger
 * /api/v1/chat/conversations/{conversationId}:
 *   delete:
 *     summary: Delete a conversation
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Conversation ID to delete
 *     responses:
 *       200:
 *         description: Conversation deleted successfully
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
 *                   example: Conversation deleted successfully
 */
router.delete('/conversations/:conversationId',
  authenticate,
  [
    param('conversationId').isUUID().withMessage('Invalid conversation ID')
  ],
  validate,
  chatController.deleteConversation
);

module.exports = router; 