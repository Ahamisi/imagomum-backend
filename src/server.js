require('dotenv').config();
require('express-async-errors');

const app = require('./app');
const { connectToDatabase, sequelize } = require('./config/database');
const { initAssociations } = require('./models/associations');
const azureStorageService = require('./services/azureStorageService');
const audioWebSocketService = require('./services/audioWebSocketService');
const { initDeliveryScheduler, closeDeliveryScheduler } = require('./services/deliveryScheduler');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 8080;
const NODE_ENV = process.env.NODE_ENV || 'development';

let server;

// Start the server
async function startServer() {
  try {
    logger.info('🚀 Starting Imagomum Backend Server...');
    logger.info(`📊 Environment: ${NODE_ENV}`);
    logger.info(`🔌 Port: ${PORT}`);
    
    // Connect to database
    logger.info('🔗 Connecting to database...');
    try {
      await connectToDatabase();
      logger.info('✅ Database connected successfully');

      // Wire model associations (CMS data model + existing models)
      initAssociations();
      logger.info('🔗 Model associations initialised');

      // Sync database models (create tables if they don't exist)
      logger.info('🔄 Syncing database models...');
      await sequelize.sync({ alter: false });
      logger.info('✅ Database models synced successfully');
    } catch (dbError) {
      logger.error('❌ Database connection failed:', dbError.message);
      logger.error('Stack:', dbError.stack);
      throw dbError;
    }

    // Weekly delivery scheduler (BullMQ + Redis). No-op unless enabled.
    try {
      initDeliveryScheduler();
    } catch (schedErr) {
      logger.error('⚠️ Delivery scheduler init failed (continuing):', schedErr.message);
    }

    // Initialize Azure Storage
    logger.info('☁️ Initializing Azure Storage...');
    if (azureStorageService.isConfigured()) {
      await azureStorageService.initializeContainer();
      logger.info('✅ Azure Storage initialized successfully');
    } else {
      logger.info('📁 Azure Storage not configured, using local file storage');
    }

    // Start the HTTP server
    logger.info(`🌐 Starting HTTP server on port ${PORT}...`);
    server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Imagomum Backend Server running on port ${PORT} in ${NODE_ENV} mode`);
      logger.info(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
      logger.info(`🏥 Health check available at http://localhost:${PORT}/health`);
      logger.info(`🌍 External access: http://0.0.0.0:${PORT}`);
    });

    // Initialize WebSocket server for audio
    audioWebSocketService.initialize(server);
    logger.info(`🎧 Audio WebSocket server initialized on ws://localhost:${PORT}/api/v1/chat/audio`);

    // Handle server shutdown gracefully
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    logger.info('✅ Server startup completed successfully');

  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    logger.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await closeDeliveryScheduler();
        if (sequelize) {
          await sequelize.close();
          logger.info('Database connections closed');
        }
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force close after 30 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 30000);
  }
}

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Debug: Log all process signals
process.on('SIGTERM', () => {
  console.log('🚨 Received SIGTERM signal');
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🚨 Received SIGINT signal (Ctrl+C)');
  gracefulShutdown('SIGINT');
});

// Debug: Log if something is trying to exit
process.on('exit', (code) => {
  console.log('🚨 Process exiting with code:', code);
});

// Start the server
startServer(); 