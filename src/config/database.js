const { Sequelize } = require('sequelize');
const config = require('../../config/database');
const logger = require('../utils/logger');

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

let sequelize = null;

// Create Sequelize instance based on environment
if (dbConfig) {
  if (dbConfig.use_env_variable) {
    sequelize = new Sequelize(process.env[dbConfig.use_env_variable], dbConfig);
  } else {
    sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);
  }
} else {
  logger.error(`Database configuration not found for environment: ${env}`);
  throw new Error(`Database configuration not found for environment: ${env}`);
}

// Test the connection
const connectToDatabase = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
};

module.exports = {
  sequelize,
  connectToDatabase
}; 