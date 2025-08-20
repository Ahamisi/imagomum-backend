const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const aiChatService = require('./aiChatService');
const ChatConversation = require('../models/ChatConversation');
const ChatMessage = require('../models/ChatMessage');

class AudioWebSocketService {
  constructor() {
    this.wss = null;
    this.sessions = new Map(); // Store active audio sessions
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/api/v1/chat/audio',
      verifyClient: (info) => {
        // Extract JWT token from query string or headers
        const url = new URL(info.req.url, 'http://localhost');
        const token = url.searchParams.get('token') || 
                     info.req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          logger.warn('WebSocket connection rejected: No token provided');
          return false;
        }

        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          info.req.user = decoded; // Store user info for connection handler
          return true;
        } catch (error) {
          logger.warn('WebSocket connection rejected: Invalid token', { error: error.message });
          return false;
        }
      }
    });

    this.wss.on('connection', (ws, req) => {
      const sessionId = uuidv4();
      const user = req.user; // From verifyClient
      
      logger.info('Audio WebSocket connection established', { 
        sessionId, 
        userId: user.id 
      });

      // Initialize session with authenticated user
      const session = {
        id: sessionId,
        ws,
        userId: user.id,
        threadId: null,
        isTranscribing: false,
        audioBuffer: Buffer.alloc(0),
        transcriptionService: null,
        conversationId: null
      };

      this.sessions.set(sessionId, session);

      // Send connection confirmation
      this.sendMessage(ws, {
        type: 'connected',
        sessionId,
        userId: user.id,
        message: 'Audio chat connected successfully'
      });

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          if (data instanceof Buffer) {
            // Raw PCM audio data
            await this.handleAudioData(sessionId, data);
          } else {
            // JSON control messages
            const message = JSON.parse(data.toString());
            await this.handleControlMessage(sessionId, message);
          }
        } catch (error) {
          logger.error('WebSocket message handling error', {
            sessionId,
            error: error.message,
            stack: error.stack
          });
          this.sendMessage(ws, {
            type: 'error',
            message: 'Failed to process message'
          });
        }
      });

      // Handle connection close
      ws.on('close', () => {
        logger.info('Audio WebSocket connection closed', { sessionId });
        this.cleanupSession(sessionId);
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error('Audio WebSocket error', {
          sessionId,
          error: error.message
        });
        this.cleanupSession(sessionId);
      });
    });

    logger.info('Audio WebSocket server initialized on /ws/transcribe');
  }

  /**
   * Handle control messages (start/stop/config)
   */
  async handleControlMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { ws } = session;

    switch (message.action) {
      case 'start':
        await this.startTranscription(sessionId, message);
        break;

      case 'stop':
        await this.stopTranscription(sessionId);
        break;



      case 'set_thread':
        session.threadId = message.threadId;
        logger.info('Thread ID set for audio session', {
          sessionId,
          threadId: message.threadId
        });
        break;

      default:
        this.sendMessage(ws, {
          type: 'error',
          message: `Unknown action: ${message.action}`
        });
    }
  }

  /**
   * Start transcription session
   */
  async startTranscription(sessionId, config) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { ws } = session;

    try {
      session.isTranscribing = true;
      session.model = config.model || 'nova-3';
      session.language = config.language || 'en-US';

      this.sendMessage(ws, {
        type: 'status',
        message: `Transcription started with model: ${session.model}, language: ${session.language}`
      });

      logger.info('Audio transcription started', {
        sessionId,
        model: session.model,
        language: session.language
      });

    } catch (error) {
      logger.error('Failed to start transcription', {
        sessionId,
        error: error.message
      });
      this.sendMessage(ws, {
        type: 'error',
        message: 'Failed to start transcription'
      });
    }
  }

  /**
   * Stop transcription session
   */
  async stopTranscription(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { ws } = session;

    try {
      session.isTranscribing = false;
      session.audioBuffer = Buffer.alloc(0);

      this.sendMessage(ws, {
        type: 'status',
        message: 'Transcription stopped'
      });

      logger.info('Audio transcription stopped', { sessionId });

    } catch (error) {
      logger.error('Failed to stop transcription', {
        sessionId,
        error: error.message
      });
    }
  }

  /**
   * Handle incoming PCM audio data
   */
  async handleAudioData(sessionId, audioData) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isTranscribing) return;

    try {
      // Accumulate audio data
      session.audioBuffer = Buffer.concat([session.audioBuffer, audioData]);

      // Process audio in chunks (simulate Deepgram processing)
      if (session.audioBuffer.length >= 3200) { // ~200ms at 16kHz
        await this.processAudioChunk(sessionId, session.audioBuffer);
        session.audioBuffer = Buffer.alloc(0);
      }

    } catch (error) {
      logger.error('Audio data processing error', {
        sessionId,
        error: error.message
      });
    }
  }

  /**
   * Process audio chunk (simulate STT)
   */
  async processAudioChunk(sessionId, audioBuffer) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { ws } = session;

    try {
      // Simulate speech-to-text processing
      // In real implementation, this would call Deepgram API
      const mockTranscript = await this.simulateSTT(audioBuffer);

      if (mockTranscript.interim) {
        this.sendMessage(ws, {
          type: 'interim_transcript',
          transcript: mockTranscript.text
        });
      }

      if (mockTranscript.final) {
        this.sendMessage(ws, {
          type: 'final_transcript',
          transcript: mockTranscript.text
        });

        // Process with AI and generate TTS response
        await this.processTranscriptWithAI(sessionId, mockTranscript.text);
      }

    } catch (error) {
      logger.error('Audio chunk processing error', {
        sessionId,
        error: error.message
      });
    }
  }

  /**
   * Process transcript with AI and generate TTS
   */
  async processTranscriptWithAI(sessionId, transcript) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { ws, userId, threadId } = session;

    try {
      this.sendMessage(ws, {
        type: 'llm_processing',
        message: 'Processing with AI...'
      });

      // Create or get conversation
      let conversation;
      let finalThreadId = threadId;

      if (!finalThreadId) {
        // Create new conversation for audio chat
        finalThreadId = aiChatService.generateThreadId(userId || 'anonymous');
        session.threadId = finalThreadId;

        if (userId) {
          conversation = await ChatConversation.create({
            userId,
            threadId: finalThreadId,
            title: transcript.length > 50 ? transcript.substring(0, 50) + '...' : transcript,
            lastMessage: 'Audio conversation started...',
            lastMessageAt: new Date(),
            messageCount: 0
          });
          session.conversationId = conversation.id;
        }
      } else if (userId) {
        conversation = await ChatConversation.findOne({
          where: { threadId: finalThreadId, userId }
        });
      }

      // Save user message (audio)
      if (userId && conversation) {
        await ChatMessage.create({
          conversationId: conversation.id,
          userId,
          threadId: finalThreadId,
          messageType: 'user',
          contentType: 'voice',
          content: transcript, // Transcribed text
          attachmentType: 'audio/pcm'
        });
      }

      // Send to AI service
      const aiResponse = await aiChatService.sendChatMessage(
        userId || 'anonymous',
        finalThreadId,
        transcript
      );

      this.sendMessage(ws, {
        type: 'llm_complete',
        message: 'AI processing complete'
      });

      // Save AI response
      if (userId && conversation) {
        await ChatMessage.create({
          conversationId: conversation.id,
          userId,
          threadId: finalThreadId,
          messageType: 'assistant',
          contentType: 'text',
          content: aiResponse?.data?.response || aiResponse?.response || 'No response',
          aiResponseTime: aiResponse?.processingTime || 0
        });

        // Update conversation
        await conversation.update({
          lastMessage: (aiResponse?.data?.response || aiResponse?.response || 'No response').substring(0, 100),
          lastMessageAt: new Date(),
          messageCount: conversation.messageCount + 2
        });
      }

      // Generate TTS audio and send back
      await this.generateAndSendTTS(sessionId, aiResponse?.data?.response || aiResponse?.response || 'No response');

    } catch (error) {
      logger.error('AI processing error', {
        sessionId,
        error: error.message,
        stack: error.stack
      });
      
      this.sendMessage(ws, {
        type: 'error',
        message: 'Failed to process with AI'
      });
    }
  }

  /**
   * Generate TTS and send audio back
   */
  async generateAndSendTTS(sessionId, text) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { ws } = session;

    try {
      // Simulate TTS generation (ElevenLabs)
      // In real implementation, this would call ElevenLabs API
      const audioChunks = await this.simulateTTS(text);

      // Send audio chunks as binary data
      for (const chunk of audioChunks) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunk);
        }
      }

      logger.info('TTS audio sent', {
        sessionId,
        textLength: text.length,
        chunks: audioChunks.length
      });

    } catch (error) {
      logger.error('TTS generation error', {
        sessionId,
        error: error.message
      });
      
      this.sendMessage(ws, {
        type: 'tts_error',
        message: 'Failed to generate speech'
      });
    }
  }

  /**
   * Simulate STT (replace with Deepgram API)
   */
  async simulateSTT(audioBuffer) {
    // Mock transcription - replace with actual Deepgram integration
    const mockPhrases = [
      "I need nutrition tips for my pregnancy",
      "What should I eat during second trimester",
      "I have stomach constipation",
      "Can you help me with meal planning",
      "Is it safe to exercise during pregnancy"
    ];

    const randomPhrase = mockPhrases[Math.floor(Math.random() * mockPhrases.length)];
    
    return {
      text: randomPhrase,
      interim: Math.random() > 0.7, // 30% chance of interim
      final: Math.random() > 0.3    // 70% chance of final
    };
  }

  /**
   * Simulate TTS (replace with ElevenLabs API)
   */
  async simulateTTS(text) {
    // Mock TTS - replace with actual ElevenLabs integration
    const chunks = [];
    const chunkSize = 1024;
    const totalChunks = Math.ceil(text.length / 10); // Simulate audio length

    for (let i = 0; i < totalChunks; i++) {
      // Generate mock PCM audio data
      const mockAudio = Buffer.alloc(chunkSize);
      for (let j = 0; j < chunkSize; j += 2) {
        const sample = Math.sin(2 * Math.PI * 440 * j / 48000) * 0.1; // 440Hz tone
        mockAudio.writeInt16LE(sample * 32767, j);
      }
      chunks.push(mockAudio);
    }

    return chunks;
  }



  /**
   * Send JSON message to WebSocket client
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Cleanup session
   */
  cleanupSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isTranscribing = false;
      session.audioBuffer = null;
      this.sessions.delete(sessionId);
      logger.info('Audio session cleaned up', { sessionId });
    }
  }

  /**
   * Get active sessions count
   */
  getActiveSessionsCount() {
    return this.sessions.size;
  }
}

module.exports = new AudioWebSocketService(); 