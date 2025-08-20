const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');
const { sequelize } = require('../config/database');
const aiChatService = require('../services/aiChatService');
const azureStorageService = require('../services/azureStorageService');
const { ValidationError, NotFoundError, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configure multer for chat file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/chat');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + crypto.randomBytes(8).toString('hex');
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images and voice files
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp3|wav|m4a|aac/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new ValidationError('Only image and audio files are allowed'));
    }
  }
});

class ChatController {
  /**
   * Get user's chat threads (grouped conversations) - ChatGPT style
   */
  async getThreads(req, res) {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    // Get unique threads with their metadata
    const threads = await ChatConversation.findAndCountAll({
      where: {
        userId,
        isActive: true
      },
      attributes: [
        'threadId',
        'title',
        [sequelize.fn('MIN', sequelize.col('created_at')), 'firstMessageAt'],
        [sequelize.fn('MAX', sequelize.col('last_message_at')), 'lastActivityAt'],
        [sequelize.fn('SUM', sequelize.col('message_count')), 'totalMessages']
      ],
      group: ['threadId', 'title'],
      order: [[sequelize.fn('MAX', sequelize.col('last_message_at')), 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      raw: true
    });

    // For each thread, get the latest user message as preview
    const threadsWithPreviews = await Promise.all(
      threads.rows.map(async (thread) => {
        // Get the most recent user message for preview
        const latestUserMessage = await ChatMessage.findOne({
          where: {
            threadId: thread.threadId,
            messageType: 'user'
          },
          order: [['created_at', 'DESC']],
          attributes: ['content'],
          raw: true
        });

        // Create a short preview (first 80 characters)
        let preview = '';
        if (latestUserMessage && latestUserMessage.content) {
          preview = latestUserMessage.content.length > 80 
            ? latestUserMessage.content.substring(0, 80) + '...'
            : latestUserMessage.content;
        } else {
          preview = 'New conversation';
        }

        return {
          threadId: thread.threadId,
          title: thread.title || 'New Chat',
          firstMessageAt: thread.firstMessageAt,
          lastActivityAt: thread.lastActivityAt,
          preview: preview, // Short preview instead of full lastMessage
          totalMessages: parseInt(thread.totalMessages) || 0
        };
      })
    );

    logger.info('Chat threads retrieved', {
      userId,
      count: threads.count.length,
      page: parseInt(page)
    });

    res.json({
      status: 'success',
      data: {
        threads: threadsWithPreviews,
        pagination: {
          total: threads.count.length,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(threads.count.length / limit),
          hasNext: offset + threads.rows.length < threads.count.length
        }
      }
    });
  }

  /**
   * Get user's chat conversations
   */
  async getConversations(req, res) {
    const userId = req.user.id;
    const { page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;

    const conversations = await ChatConversation.findAndCountAll({
      where: {
        userId,
        isActive: true
      },
      order: [['lastMessageAt', 'DESC'], ['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    logger.info('Chat conversations retrieved', {
      userId,
      count: conversations.count,
      page: parseInt(page)
    });

    res.json({
      status: 'success',
      data: {
        conversations: conversations.rows.map(conv => conv.getSafeConversationInfo()),
        pagination: {
          total: conversations.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(conversations.count / limit),
          hasNext: offset + conversations.rows.length < conversations.count
        }
      }
    });
  }

  /**
   * Get all messages for a specific thread
   */
  async getThreadMessages(req, res) {
    const userId = req.user.id;
    const { threadId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    // Get all messages for this thread
    const messages = await ChatMessage.findAndCountAll({
      where: {
        threadId,
        userId
      },
      order: [['created_at', 'ASC']], // Chronological order
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    logger.info('Thread messages retrieved', {
      userId,
      threadId,
      count: messages.count,
      page: parseInt(page)
    });

    res.json({
      status: 'success',
      data: {
        threadId,
        messages: messages.rows.map(message => message.getSafeMessageInfo()),
        pagination: {
          total: messages.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(messages.count / limit),
          hasNext: offset + messages.rows.length < messages.count
        }
      }
    });
  }

  /**
   * Get messages for a specific conversation
   */
  async getConversationMessages(req, res) {
    const userId = req.user.id;
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify conversation belongs to user
    const conversation = await ChatConversation.findOne({
      where: {
        id: conversationId,
        userId
      }
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const offset = (page - 1) * limit;

    const messages = await ChatMessage.findAndCountAll({
      where: {
        conversationId
      },
      order: [['created_at', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    logger.info('Chat messages retrieved', {
      userId,
      conversationId,
      count: messages.count,
      page: parseInt(page)
    });

    res.json({
      status: 'success',
      data: {
        conversation: conversation.getSafeConversationInfo(),
        messages: messages.rows.map(msg => msg.getSafeMessageInfo()),
        pagination: {
          total: messages.count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(messages.count / limit),
          hasNext: offset + messages.rows.length < messages.count
        }
      }
    });
  }

  /**
   * SIMPLIFIED: Send a regular chat message
   */
  async sendMessage(req, res) {
    const userId = req.user.id;
    const { threadId, message, imagePath } = req.body;

    try {
      let finalThreadId = threadId;
      let conversation;

      // SIMPLE LOGIC:
      // 1. If threadId provided -> use existing conversation
      // 2. If no threadId -> create new conversation
      
      if (threadId) {
        // Continue existing conversation
        conversation = await ChatConversation.findOne({
          where: { threadId, userId }
        });
        
        if (!conversation) {
          throw new NotFoundError('Thread not found');
        }
      } else {
        // Create new conversation
        finalThreadId = aiChatService.generateThreadId(userId);
        
        conversation = await ChatConversation.create({
          userId,
          threadId: finalThreadId,
          title: message.length > 50 ? message.substring(0, 50) + '...' : message,
          lastMessage: 'Starting conversation...',
          lastMessageAt: new Date(),
          messageCount: 0
        });
      }

      // Save user message
      const userMessage = await ChatMessage.create({
        conversationId: conversation.id,
        userId,
        threadId: finalThreadId,
        messageType: 'user',
        contentType: imagePath ? 'image' : 'text',
        content: message,
        attachmentUrl: imagePath || null
      });

      // Send to AI service
      const aiResponse = await aiChatService.sendChatMessage(
        userId,
        finalThreadId,
        message,
        imagePath
      );

      console.log('🤖 AI Response:', JSON.stringify(aiResponse, null, 2));

      // Extract response data
      const responseText = aiResponse?.data?.response || aiResponse?.response || 'No response from AI service';
      const processingTime = aiResponse?.processingTime || 0;

      // Save AI response
      const aiMessage = await ChatMessage.create({
        conversationId: conversation.id,
        userId,
        threadId: finalThreadId,
        messageType: 'assistant',
        contentType: 'text',
        content: responseText,
        aiResponseTime: processingTime
      });

      // Update conversation
      await conversation.update({
        lastMessage: responseText.length > 100 
          ? responseText.substring(0, 100) + '...' 
          : responseText,
        lastMessageAt: new Date(),
        messageCount: conversation.messageCount + 2
      });

      logger.info('Chat message sent successfully', {
        userId,
        threadId: finalThreadId,
        messageLength: message.length,
        hasImage: !!imagePath
      });

      res.json({
        status: 'success',
        data: {
          conversation: {
            id: conversation.id,
            threadId: finalThreadId,
            title: conversation.title,
            messageCount: conversation.messageCount
          },
          userMessage: userMessage.getSafeMessageInfo(),
          aiMessage: aiMessage.getSafeMessageInfo(),
          aiResponse
        }
      });

    } catch (error) {
      logger.error('Send message error', {
        error: error.message,
        userId,
        threadId,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Send a streaming chat message
   */
  async sendStreamingMessage(req, res) {
    const userId = req.user.id;
    const { conversationId, threadId, message, imagePath } = req.body;

    let conversation;
    let finalThreadId = threadId;

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    try {
      // Handle conversation setup (same as regular message)
      if (conversationId) {
        conversation = await ChatConversation.findOne({
          where: {
            id: conversationId,
            userId
          }
        });

        if (!conversation) {
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'Conversation not found' })}\n\n`);
          res.end();
          return;
        }

        finalThreadId = conversation.threadId;
      } else {
        if (!finalThreadId) {
          finalThreadId = aiChatService.generateThreadId(userId);
        }

        conversation = await ChatConversation.findOne({
          where: {
            threadId: finalThreadId,
            userId
          }
        });

        if (!conversation) {
          conversation = await ChatConversation.create({
            userId,
            threadId: finalThreadId,
            title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
            lastMessage: 'Starting conversation...',
            lastMessageAt: new Date(),
            messageCount: 0
          });
        }
      }

      // Save user message
      const userMessage = await ChatMessage.create({
        conversationId: conversation.id,
        userId,
        threadId: finalThreadId,
        messageType: 'user',
        contentType: imagePath ? 'image' : 'text',
        content: message,
        attachmentPath: imagePath,
        attachmentUrl: imagePath
      });

      // Send initial response with conversation info
      res.write(`data: ${JSON.stringify({
        type: 'conversation',
        conversation: conversation.getSafeConversationInfo(),
        userMessage: userMessage.getSafeMessageInfo()
      })}\n\n`);

      let fullAiResponse = '';

      // Send streaming request to AI service
      const streamResult = await aiChatService.sendStreamingChatMessage(
        userId,
        finalThreadId,
        message,
        imagePath,
        (chunkData) => {
          // Forward each chunk to client
          res.write(`data: ${JSON.stringify(chunkData)}\n\n`);
          if (chunkData.delta) {
            fullAiResponse += chunkData.delta;
          }
        }
      );

      if (streamResult.success) {
        // Save complete AI response
        const aiMessage = await ChatMessage.create({
          conversationId: conversation.id,
          userId,
          threadId: finalThreadId,
          messageType: 'assistant',
          contentType: 'text',
          content: fullAiResponse,
          isStreaming: true,
          streamingComplete: true,
          aiResponseTime: streamResult.processingTime
        });

        // Update conversation with AI response preview
        await conversation.update({
          lastMessage: fullAiResponse.substring(0, 100) + (fullAiResponse.length > 100 ? '...' : ''),
          lastMessageAt: new Date(),
          messageCount: conversation.messageCount + 2
        });

        // Send final completion message
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          aiMessage: aiMessage.getSafeMessageInfo(),
          conversation: conversation.getSafeConversationInfo(),
          timestamp: streamResult.timestamp
        })}\n\n`);

        logger.info('Streaming chat message completed', {
          userId,
          conversationId: conversation.id,
          threadId: finalThreadId,
          chunkCount: streamResult.chunkCount
        });
      } else {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: streamResult.error
        })}\n\n`);
      }

    } catch (error) {
      console.error('❌ Streaming chat error:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        message: error.message
      })}\n\n`);
    }

    res.end();
  }

  /**
   * Upload file for chat (image/voice)
   */
  async uploadChatFile(req, res) {
    const userId = req.user.id;

    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    let cloudUrl = null;
    let cloudBlobName = null;

    // Try to upload to Azure Storage
    if (azureStorageService.isConfigured()) {
      try {
        const uploadResult = await azureStorageService.uploadFile(
          req.file.path,
          `chat/${userId}`,
          req.file.filename
        );

        if (uploadResult.success) {
          cloudUrl = uploadResult.url;
          cloudBlobName = uploadResult.blobName;
          console.log('✅ Chat file uploaded to Azure:', cloudUrl);
        }
      } catch (error) {
        console.warn('⚠️ Azure upload failed for chat file, using local storage:', error.message);
      }
    }

    const fileInfo = {
      id: crypto.randomUUID(),
      originalName: req.file.originalname,
      fileName: req.file.filename,
      filePath: req.file.path,
      cloudUrl,
      cloudBlobName,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString()
    };

    logger.info('Chat file uploaded', {
      userId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      cloudUrl: !!cloudUrl
    });

    res.json({
      status: 'success',
      data: {
        file: fileInfo
      }
    });
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(req, res) {
    const userId = req.user.id;
    const { conversationId } = req.params;

    const conversation = await ChatConversation.findOne({
      where: {
        id: conversationId,
        userId
      }
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Soft delete conversation and all its messages
    await conversation.destroy();
    await ChatMessage.destroy({
      where: {
        conversationId
      }
    });

    logger.info('Chat conversation deleted', {
      userId,
      conversationId
    });

    res.json({
      status: 'success',
      message: 'Conversation deleted successfully'
    });
  }
}

const chatController = new ChatController();

module.exports = {
  getThreads: chatController.getThreads.bind(chatController),
  getThreadMessages: chatController.getThreadMessages.bind(chatController),
  getConversations: chatController.getConversations.bind(chatController),
  getConversationMessages: chatController.getConversationMessages.bind(chatController),
  sendMessage: chatController.sendMessage.bind(chatController),
  sendStreamingMessage: chatController.sendStreamingMessage.bind(chatController),
  uploadChatFile: [upload.single('file'), chatController.uploadChatFile.bind(chatController)],
  deleteConversation: chatController.deleteConversation.bind(chatController)
}; 