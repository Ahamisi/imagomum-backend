const emailService = require('../services/emailService');
const logger = require('../utils/logger');
const { normalizeEmail, hasEmailAlias, getEmailAlias } = require('../utils/emailUtils');

const testController = {
  async testEmail(req, res) {
    try {
      const { email, testType = 'otp' } = req.body;
      
      if (!email) {
        return res.status(400).json({
          status: 'error',
          message: 'Email is required'
        });
      }

      logger.info('Testing email service', { email, testType });

      let result;
      if (testType === 'otp') {
        const testOTP = '123456';
        result = await emailService.sendOTP(email, testOTP, 'Test User');
      } else if (testType === 'welcome') {
        result = await emailService.sendWelcomeEmail(email, 'Test User');
      } else {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid test type. Use "otp" or "welcome"'
        });
      }

      // Check email service configuration
      const isConfigured = emailService.isConfigured();
      
      res.status(200).json({
        status: 'success',
        message: 'Email test completed',
        data: {
          email,
          testType,
          emailServiceConfigured: isConfigured,
          emailSent: result.success,
          messageId: result.messageId || null,
          error: result.error || null,
          mock: result.mock || false,
          fallback: result.fallback || false,
          accepted: result.accepted || null,
          emailNormalization: {
            original: email,
            normalized: normalizeEmail(email),
            hasAlias: hasEmailAlias(email),
            alias: getEmailAlias(email)
          },
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            hasEmailUser: !!process.env.EMAIL_USER,
            hasEmailPassword: !!process.env.EMAIL_PASSWORD,
            emailUser: process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 5) + '***' : 'undefined'
          }
        }
      });

    } catch (error) {
      logger.error('Email test error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Email test failed',
        error: error.message
      });
    }
  },

  async healthCheck(req, res) {
    try {
      const emailConfigured = emailService.isConfigured();
      
      res.status(200).json({
        status: 'success',
        message: 'Health check completed',
        data: {
          server: 'running',
          database: 'connected', // TODO: Add actual DB health check
          emailService: {
            configured: emailConfigured,
            hasCredentials: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD)
          },
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Health check error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        error: error.message
      });
    }
  }
};

module.exports = testController;
