const axios = require('axios');
const logger = require('../utils/logger');

class AIChatService {
  constructor() {
    this.baseURL = process.env.AI_CHAT_BASE_URL || 'https://imagomum-app.agreeablebeach-10200fd5.eastus2.azurecontainerapps.io';
    this.timeout = 30000; // 30 seconds
  }

  /**
   * Send a regular chat message to AI service
   * @param {string} userId - User ID
   * @param {string} threadId - Thread ID
   * @param {string} message - User message
   * @param {string} imagePath - Optional image path
   * @returns {Promise<Object>} AI response
   */
  async sendChatMessage(userId, threadId, message, imagePath = null) {
    try {
      const startTime = Date.now();
      
      const payload = {
        user_id: userId,
        thread_id: threadId,
        message: message,
        image_path: imagePath || "" // Always include image_path, empty string if no image
      };

      console.log('🤖 === AI CHAT REQUEST ===');
      console.log('🎯 URL:', `${this.baseURL}/api/pregnancy/chat`);
      console.log('📤 Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(
        `${this.baseURL}/api/pregnancy/chat`,
        payload,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const processingTime = Date.now() - startTime;

      console.log('✅ AI Chat Response Status:', response.status);
      console.log('✅ AI Chat Response Data:', JSON.stringify(response.data, null, 2));
      console.log('⏱️ Processing Time:', processingTime + 'ms');

      // Log successful AI interaction
      logger.info('AI chat message processed successfully', {
        userId,
        threadId,
        processingTime,
        hasImage: !!imagePath
      });

      return {
        success: true,
        data: response.data,
        processingTime
      };

    } catch (error) {
      console.error('❌ AI Chat Error:', error.message);
      console.error('❌ AI Chat Error Response:', error.response?.data);
      console.error('❌ AI Chat Error Status:', error.response?.status);

      logger.error('AI chat service error', {
        error: error.message,
        userId,
        threadId,
        status: error.response?.status,
        responseData: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status || 500,
        data: error.response?.data || null
      };
    }
  }

  /**
   * Send a streaming chat message to AI service
   * @param {string} userId - User ID
   * @param {string} threadId - Thread ID
   * @param {string} message - User message
   * @param {string} imagePath - Optional image path
   * @param {Function} onChunk - Callback for each streaming chunk
   * @returns {Promise<Object>} Stream completion result
   */
  async sendStreamingChatMessage(userId, threadId, message, imagePath = null, onChunk = null) {
    try {
      const startTime = Date.now();
      
      const payload = {
        user_id: userId,
        thread_id: threadId,
        message: message,
        image_path: imagePath || "" // Always include image_path, empty string if no image
      };

      console.log('🌊 === AI CHAT STREAM REQUEST ===');
      console.log('🎯 URL:', `${this.baseURL}/api/pregnancy/chat/stream`);
      console.log('📤 Payload:', JSON.stringify(payload, null, 2));

      const response = await axios.post(
        `${this.baseURL}/api/pregnancy/chat/stream`,
        payload,
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream'
          },
          responseType: 'stream'
        }
      );

      console.log('✅ AI Chat Stream Response Status:', response.status);

      let fullResponse = '';
      let chunkCount = 0;

      return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
          const chunkStr = chunk.toString();
          console.log('📦 Stream Chunk:', chunkStr);

          // Parse SSE format: "data: {json}\n\n"
          const lines = chunkStr.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.substring(6); // Remove "data: "
                const chunkData = JSON.parse(jsonStr);
                
                chunkCount++;
                
                if (chunkData.type === 'chunk' && chunkData.delta) {
                  fullResponse += chunkData.delta;
                  
                  // Call the chunk callback if provided
                  if (onChunk) {
                    onChunk(chunkData);
                  }
                } else if (chunkData.type === 'complete') {
                  const processingTime = Date.now() - startTime;
                  
                  console.log('🏁 Stream Complete!');
                  console.log('📝 Full Response:', fullResponse);
                  console.log('📊 Total Chunks:', chunkCount);
                  console.log('⏱️ Processing Time:', processingTime + 'ms');

                  logger.info('AI chat stream completed successfully', {
                    userId,
                    threadId,
                    processingTime,
                    chunkCount,
                    hasImage: !!imagePath
                  });

                  resolve({
                    success: true,
                    fullResponse,
                    chunkCount,
                    processingTime,
                    timestamp: chunkData.timestamp
                  });
                }
              } catch (parseError) {
                console.error('❌ Failed to parse chunk:', parseError.message);
              }
            }
          }
        });

        response.data.on('end', () => {
          console.log('🔚 Stream ended');
        });

        response.data.on('error', (error) => {
          console.error('❌ Stream error:', error.message);
          reject({
            success: false,
            error: error.message
          });
        });
      });

    } catch (error) {
      console.error('❌ AI Chat Stream Error:', error.message);
      console.error('❌ AI Chat Stream Error Response:', error.response?.data);
      console.error('❌ AI Chat Stream Error Status:', error.response?.status);

      logger.error('AI chat stream service error', {
        error: error.message,
        userId,
        threadId,
        status: error.response?.status,
        responseData: error.response?.data
      });

      return {
        success: false,
        error: error.message,
        status: error.response?.status || 500,
        data: error.response?.data || null
      };
    }
  }

  /**
   * Generate a thread ID for new conversations
   * @param {string} userId - User ID
   * @returns {string} Generated thread ID
   */
  generateThreadId(userId) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `thread_${userId}_${timestamp}_${random}`;
  }

  /**
   * Check if AI chat service is available
   * @returns {Promise<boolean>} Service availability
   */
  async isServiceAvailable() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      console.error('❌ AI Chat service health check failed:', error.message);
      return false;
    }
  }
}

module.exports = new AIChatService(); 