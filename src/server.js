require('dotenv').config();
require('express-async-errors');

const app = require('./app');
const { connectToDatabase, sequelize } = require('./config/database');
const azureStorageService = require('./services/azureStorageService');
const audioWebSocketService = require('./services/audioWebSocketService');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

let server;

// Start the server
async function startServer() {
  try {
    // Connect to database
    await connectToDatabase();

    // Initialize Azure Storage
    if (azureStorageService.isConfigured()) {
      await azureStorageService.initializeContainer();
      logger.info('☁️ Azure Storage initialized successfully');
    } else {
      logger.info('📁 Azure Storage not configured, using local file storage');
    }

    // Start the HTTP server
    server = app.listen(PORT, () => {
      logger.info(`🚀 Imagomum Backend Server running on port ${PORT} in ${NODE_ENV} mode`);
      logger.info(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
    });

    // Initialize WebSocket server for audio
    audioWebSocketService.initialize(server);
    logger.info(`🎧 Audio WebSocket server initialized on ws://localhost:${PORT}/api/v1/chat/audio`);

    // Handle server shutdown gracefully
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    logger.error('Failed to start server:', error);
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