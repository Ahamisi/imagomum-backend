const axios = require('axios');
const logger = require('../utils/logger');

class AIContextService {
  constructor() {
    this.baseURL = 'https://imagomum-app.agreeablebeach-10200fd5.eastus2.azurecontainerapps.io/api/pregnancy';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Create or update user's pregnancy context in AI system
   */
  async createOrUpdateContext(userId, contextData) {
    try {
      logger.info('Creating/updating AI pregnancy context', {
        userId,
        currentWeek: contextData.current_week,
        trimester: this.calculateTrimester(contextData.current_week)
      });

      const payload = {
        user_id: userId,
        current_week: contextData.current_week || 0,
        age: contextData.age || 0,
        first_pregnancy: contextData.first_pregnancy !== false, // Default to true
        high_risk_conditions: contextData.high_risk_conditions || [],
        allergies: contextData.allergies || [],
        medications: contextData.medications || [],
        dietary_restrictions: contextData.dietary_restrictions || [],
        cultural_preferences: contextData.cultural_preferences || {},
        partner_involved: contextData.partner_involved || false
      };

      const response = await this.client.post('/context', payload);

      logger.info('AI pregnancy context created/updated successfully', {
        userId,
        aiResponse: {
          exists: response.data.exists,
          currentWeek: response.data.current_week,
          trimester: response.data.trimester,
          createdAt: response.data.created_at
        }
      });

      return {
        success: true,
        data: response.data,
        exists: response.data.exists,
        profile: response.data.profile
      };

    } catch (error) {
      logger.error('Failed to create/update AI pregnancy context', {
        userId,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status || 500
      };
    }
  }

  /**
   * Get user's current pregnancy context from AI system
   */
  async getContext(userId) {
    try {
      logger.info('Fetching AI pregnancy context', { userId });

      const response = await this.client.get(`/context/${userId}`);

      logger.info('AI pregnancy context retrieved successfully', {
        userId,
        exists: response.data.exists,
        currentWeek: response.data.current_week,
        trimester: response.data.trimester
      });

      return {
        success: true,
        data: response.data,
        exists: response.data.exists,
        profile: response.data.profile
      };

    } catch (error) {
      logger.error('Failed to get AI pregnancy context', {
        userId,
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status || 500
      };
    }
  }

  /**
   * Calculate trimester from gestational week
   */
  calculateTrimester(week) {
    if (week <= 12) return 'first_trimester';
    if (week <= 27) return 'second_trimester';
    return 'third_trimester';
  }

  /**
   * Build context data from user pregnancy information
   */
  buildContextFromUser(user, additionalData = {}) {
    const contextData = {
      current_week: user.gestationalWeeks || 0,
      age: additionalData.age || 0,
      first_pregnancy: additionalData.first_pregnancy !== false,
      high_risk_conditions: additionalData.high_risk_conditions || [],
      allergies: additionalData.allergies || [],
      medications: additionalData.medications || [],
      dietary_restrictions: additionalData.dietary_restrictions || [],
      cultural_preferences: additionalData.cultural_preferences || {},
      partner_involved: additionalData.partner_involved || false
    };

    logger.info('Built AI context data from user', {
      userId: user.id,
      contextData
    });

    return contextData;
  }

  /**
   * Sync user's pregnancy data with AI context
   */
  async syncUserContext(user, additionalData = {}) {
    try {
      // Only sync if user has pregnancy information
      if (!user.gestationalWeeks && !user.lmpDate) {
        logger.info('Skipping AI context sync - no pregnancy data', { userId: user.id });
        return { success: true, skipped: true, reason: 'No pregnancy data' };
      }

      const contextData = this.buildContextFromUser(user, additionalData);
      const result = await this.createOrUpdateContext(user.id, contextData);

      if (result.success) {
        logger.info('User pregnancy context synced with AI', {
          userId: user.id,
          exists: result.exists,
          currentWeek: result.data?.current_week
        });
      }

      return result;

    } catch (error) {
      logger.error('Failed to sync user context with AI', {
        userId: user.id,
        error: error.message
      });

      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new AIContextService();
