const axios = require('axios');
const fs = require('fs');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.baseURL = process.env.AI_SERVICE_URL || 'https://imagomum-app.agreeablebeach-10200fd5.eastus2.azurecontainerapps.io';
    this.timeout = parseInt(process.env.AI_SERVICE_TIMEOUT) || 60000; // 60 seconds
    this.retryAttempts = parseInt(process.env.AI_SERVICE_RETRY_ATTEMPTS) || 3;
    this.retryDelay = parseInt(process.env.AI_SERVICE_RETRY_DELAY) || 2000; // 2 seconds
    
    // Create axios instance with default config
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'User-Agent': 'Imagomum-Backend/1.0.0',
        'Accept': 'application/json'
      }
    });

    // Add request/response interceptors for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('AI Service Request:', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: this.sanitizeHeaders(config.headers)
        });
        return config;
      },
      (error) => {
        logger.error('AI Service Request Error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        logger.debug('AI Service Response:', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url
        });
        return response;
      },
      (error) => {
        logger.error('AI Service Response Error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Check if AI service is healthy and reachable
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/');
      return {
        status: 'healthy',
        response: response.data,
        latency: response.headers['x-response-time'] || null
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        code: error.response?.status || 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Analyze ultrasound scan using AI service
   * @param {string} filePath - Path to the ultrasound image file
   * @param {Object} metadata - Additional metadata about the scan
   * @returns {Promise<Object>} AI analysis result
   */
  async analyzeUltrasound(filePath, metadata = {}) {
    const startTime = Date.now();
    
    try {
      logger.info('Starting AI analysis', {
        filePath: filePath.replace(/\/[^\/]*$/, '/[filename]'), // Hide filename for privacy
        metadata: this.sanitizeMetadata(metadata)
      });

      // Prepare JSON payload as per AI service API spec
      const requestPayload = {
        user_id: metadata.userId || 'anonymous',
        image_path: filePath
      };

      // Make request to AI service
      console.log('🚀 Making AI request to:', `${this.baseURL}/api/ultrasound/analyze`);
      console.log('📤 Request payload:', JSON.stringify(requestPayload, null, 2));
      
      const response = await this.retryRequest(async () => {
        return await this.client.post('api/ultrasound/analyze', requestPayload, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
      });

      console.log('📥 AI Response Status:', response.status);
      console.log('📥 AI Response Headers:', JSON.stringify(response.headers, null, 2));
      console.log('📥 AI Response Data:', JSON.stringify(response.data, null, 2));

      const processingTime = Date.now() - startTime;

      logger.info('AI analysis completed successfully', {
        processingTime,
        success: response.data.success,
        analysisId: response.data.analysis_id
      });

      // Standardize the response format for the new API
      return this.standardizeAIResponseNew(response.data, processingTime);

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      console.log('❌ AI Request Failed!');
      console.log('❌ Error Message:', error.message);
      console.log('❌ Error Status:', error.response?.status);
      console.log('❌ Error Response Data:', JSON.stringify(error.response?.data, null, 2));
      console.log('❌ Full Error:', error);
      
      logger.error('AI analysis failed', {
        error: error.message,
        processingTime,
        status: error.response?.status,
        filePath: filePath.replace(/\/[^\/]*$/, '/[filename]')
      });

      throw this.createAIServiceError(error, processingTime);
    }
  }

  /**
   * Retry mechanism for AI requests
   */
  async retryRequest(requestFn, attempt = 1) {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt < this.retryAttempts && this.isRetryableError(error)) {
        logger.warn(`AI service request failed, retrying (${attempt}/${this.retryAttempts})`, {
          error: error.message,
          status: error.response?.status
        });
        
        await this.delay(this.retryDelay * attempt); // Exponential backoff
        return this.retryRequest(requestFn, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableStatuses = [408, 429, 500, 502, 503, 504];
    const status = error.response?.status;
    
    return (
      !status || // Network errors
      retryableStatuses.includes(status) ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT'
    );
  }

  /**
   * Standardize AI response format for new API
   */
  standardizeAIResponseNew(data, processingTime) {
    return {
      // Analysis results from new API format
      success: data.success || false,
      analysis: data.analysis || '',
      analysisId: data.analysis_id || null,
      processedAt: data.processed_at || new Date().toISOString(),
      error: data.error || null,
      
      // Technical details
      processingTime,
      
      // Raw response for debugging
      rawResponse: data,
      
      // Formatted for our database structure
      confidenceScore: data.success ? 0.8 : 0.0, // Default confidence based on success
      findings: {
        analysis_text: data.analysis,
        analysis_id: data.analysis_id,
        processed_timestamp: data.processed_at
      },
      recommendations: data.analysis ? [data.analysis] : [],
      
      // Formatted summary
      summary: this.generateSummaryNew(data),
      
      // Risk assessment
      riskLevel: this.assessRiskLevelNew(data),
      
      // Key measurements (extracted from analysis text if possible)
      measurements: this.extractMeasurementsFromText(data.analysis || '')
    };
  }

  /**
   * Standardize AI response format (legacy method for compatibility)
   */
  standardizeAIResponse(data, processingTime) {
    return {
      // Analysis results
      confidenceScore: data.confidence_score || data.confidence || null,
      findings: data.findings || data.analysis || data.results || {},
      recommendations: data.recommendations || data.suggestions || [],
      
      // Technical details
      modelVersion: data.model_version || data.version || 'unknown',
      processingTime,
      
      // Raw response for debugging
      rawResponse: data,
      
      // Formatted summary
      summary: this.generateSummary(data),
      
      // Risk assessment
      riskLevel: this.assessRiskLevel(data),
      
      // Key measurements (if available)
      measurements: this.extractMeasurements(data)
    };
  }

  /**
   * Generate human-readable summary for new API
   */
  generateSummaryNew(data) {
    if (!data.success) {
      return `AI analysis failed: ${data.error || 'Unknown error'}`;
    }
    
    const analysisText = data.analysis || '';
    
    if (analysisText.length === 0) {
      return 'AI analysis completed but no analysis text provided.';
    }
    
    // Truncate analysis for summary if too long
    if (analysisText.length > 150) {
      return analysisText.substring(0, 147) + '...';
    }
    
    return analysisText;
  }

  /**
   * Generate human-readable summary (legacy)
   */
  generateSummary(data) {
    if (data.summary) return data.summary;
    
    const confidence = data.confidence_score || data.confidence;
    const findings = data.findings || data.analysis || {};
    
    let summary = 'AI analysis completed. ';
    
    if (confidence) {
      if (confidence > 0.8) {
        summary += 'High confidence analysis. ';
      } else if (confidence > 0.6) {
        summary += 'Moderate confidence analysis. ';
      } else {
        summary += 'Low confidence analysis - manual review recommended. ';
      }
    }
    
    if (Object.keys(findings).length > 0) {
      summary += 'Multiple findings detected.';
    } else {
      summary += 'Standard scan appearance.';
    }
    
    return summary;
  }

  /**
   * Assess risk level for new API based on analysis text
   */
  assessRiskLevelNew(data) {
    if (!data.success) return 'high';
    
    const analysisText = (data.analysis || '').toLowerCase();
    
    // Check for high-risk keywords
    const highRiskKeywords = [
      'abnormal', 'concern', 'urgent', 'immediate', 'emergency',
      'critical', 'serious', 'significant', 'worrying'
    ];
    
    const mediumRiskKeywords = [
      'monitor', 'follow-up', 'further', 'evaluate', 'assess',
      'borderline', 'slightly', 'mild'
    ];
    
    if (highRiskKeywords.some(keyword => analysisText.includes(keyword))) {
      return 'high';
    }
    
    if (mediumRiskKeywords.some(keyword => analysisText.includes(keyword))) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Assess risk level based on AI findings (legacy)
   */
  assessRiskLevel(data) {
    const confidence = data.confidence_score || data.confidence || 0;
    const findings = data.findings || {};
    
    // Low confidence = higher risk
    if (confidence < 0.5) return 'high';
    
    // Check for specific risk indicators in findings
    if (findings.abnormalities || findings.concerns || findings.alerts) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Extract measurements from analysis text
   */
  extractMeasurementsFromText(analysisText) {
    if (!analysisText) return null;
    
    const measurements = {};
    const text = analysisText.toLowerCase();
    
    // Common ultrasound measurements with regex patterns
    const measurementPatterns = {
      'bpd': /bpd[:\s]*(\d+\.?\d*)\s*(mm|cm)/i,
      'hc': /hc[:\s]*(\d+\.?\d*)\s*(mm|cm)/i,
      'ac': /ac[:\s]*(\d+\.?\d*)\s*(mm|cm)/i,
      'fl': /fl[:\s]*(\d+\.?\d*)\s*(mm|cm)/i,
      'efw': /efw[:\s]*(\d+\.?\d*)\s*(g|grams)/i,
      'afi': /afi[:\s]*(\d+\.?\d*)\s*(cm)/i,
      'gestational_age': /(\d+)\s*weeks?\s*(\d+)?\s*days?/i
    };
    
    Object.entries(measurementPatterns).forEach(([key, pattern]) => {
      const match = text.match(pattern);
      if (match) {
        if (key === 'gestational_age') {
          const weeks = match[1];
          const days = match[2] || 0;
          measurements[key] = `${weeks}w ${days}d`;
        } else {
          measurements[key] = `${match[1]} ${match[2]}`;
        }
      }
    });
    
    return Object.keys(measurements).length > 0 ? measurements : null;
  }

  /**
   * Extract measurements from AI response (legacy)
   */
  extractMeasurements(data) {
    const measurements = {};
    
    if (data.measurements) {
      return data.measurements;
    }
    
    // Try to extract common measurements from findings
    const findings = data.findings || data.analysis || {};
    
    ['bpd', 'hc', 'ac', 'fl', 'efw', 'afi'].forEach(measurement => {
      if (findings[measurement] || findings[measurement.toUpperCase()]) {
        measurements[measurement] = findings[measurement] || findings[measurement.toUpperCase()];
      }
    });
    
    return Object.keys(measurements).length > 0 ? measurements : null;
  }

  /**
   * Create standardized AI service error
   */
  createAIServiceError(error, processingTime) {
    const aiError = new Error(error.message || 'AI analysis failed');
    aiError.name = 'AIServiceError';
    aiError.status = error.response?.status || 500;
    aiError.processingTime = processingTime;
    aiError.isRetryable = this.isRetryableError(error);
    aiError.originalError = error;
    
    return aiError;
  }

  /**
   * Sanitize headers for logging (remove sensitive info)
   */
  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    delete sanitized.Authorization;
    delete sanitized.authorization;
    return sanitized;
  }

  /**
   * Sanitize metadata for logging
   */
  sanitizeMetadata(metadata) {
    const sanitized = { ...metadata };
    delete sanitized.userId; // Remove for privacy
    return sanitized;
  }

  /**
   * Delay helper for retry mechanism
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new AIService(); 