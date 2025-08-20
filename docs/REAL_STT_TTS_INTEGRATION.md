# Real STT/TTS Integration Guide

## 🎯 Overview

Replace the mock STT/TTS services with real **Deepgram** (Speech-to-Text) and **ElevenLabs** (Text-to-Speech) APIs.

**👥 Who implements this:** Backend Developer (You/Your Team)

---

## 📋 Implementation Checklist

### 1. **Environment Setup**
- [ ] Get Deepgram API key
- [ ] Get ElevenLabs API key  
- [ ] Add environment variables
- [ ] Install required packages

### 2. **Code Updates**
- [ ] Replace `simulateSTT()` with real Deepgram integration
- [ ] Replace `simulateTTS()` with real ElevenLabs integration
- [ ] Update audio processing logic
- [ ] Add error handling for API failures

### 3. **Testing**
- [ ] Test STT accuracy
- [ ] Test TTS quality
- [ ] Test error scenarios
- [ ] Performance testing

---

## 🔑 Step 1: Get API Keys

### Deepgram (STT)
1. Sign up at [deepgram.com](https://deepgram.com)
2. Get API key from dashboard
3. Choose model: `nova-2` (recommended) or `base`

### ElevenLabs (TTS)
1. Sign up at [elevenlabs.io](https://elevenlabs.io)
2. Get API key from profile
3. Choose voice ID (e.g., `21m00Tcm4TlvDq8ikWAM` for Rachel)

---

## 🔧 Step 2: Install Dependencies

```bash
npm install @deepgram/sdk axios form-data
```

---

## 📝 Step 3: Environment Variables

Add to your `.env` file:

```env
# STT Service (Deepgram)
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# TTS Service (ElevenLabs)
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

---

## 💻 Step 4: Code Implementation

### Create Deepgram Service

Create `src/services/deepgramService.js`:

```javascript
const { createClient } = require('@deepgram/sdk');
const logger = require('../utils/logger');

class DeepgramService {
  constructor() {
    this.client = createClient(process.env.DEEPGRAM_API_KEY);
    this.connections = new Map();
  }

  /**
   * Create live transcription connection
   */
  async createLiveConnection(sessionId, options = {}) {
    try {
      const connection = this.client.listen.live({
        model: options.model || 'nova-2',
        language: options.language || 'en-US',
        smart_format: true,
        interim_results: true,
        endpointing: 300,
        utterance_end_ms: 1000,
        vad_events: true
      });

      // Store connection
      this.connections.set(sessionId, connection);

      logger.info('Deepgram connection created', { 
        sessionId, 
        model: options.model || 'nova-2',
        language: options.language || 'en-US'
      });

      return connection;

    } catch (error) {
      logger.error('Failed to create Deepgram connection', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send audio data to Deepgram
   */
  async sendAudio(sessionId, audioBuffer) {
    const connection = this.connections.get(sessionId);
    if (!connection) {
      throw new Error('No active Deepgram connection');
    }

    try {
      connection.send(audioBuffer);
    } catch (error) {
      logger.error('Failed to send audio to Deepgram', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Close connection
   */
  async closeConnection(sessionId) {
    const connection = this.connections.get(sessionId);
    if (connection) {
      try {
        connection.finish();
        this.connections.delete(sessionId);
        logger.info('Deepgram connection closed', { sessionId });
      } catch (error) {
        logger.error('Error closing Deepgram connection', {
          sessionId,
          error: error.message
        });
      }
    }
  }

  /**
   * Setup event handlers for connection
   */
  setupEventHandlers(sessionId, callbacks) {
    const connection = this.connections.get(sessionId);
    if (!connection) return;

    // Transcript results
    connection.on('Results', (data) => {
      const result = data.channel.alternatives[0];
      if (result && result.transcript) {
        callbacks.onTranscript({
          text: result.transcript,
          interim: !data.is_final,
          final: data.is_final,
          confidence: result.confidence
        });
      }
    });

    // Speech started
    connection.on('SpeechStarted', () => {
      callbacks.onSpeechStart?.();
    });

    // Utterance end
    connection.on('UtteranceEnd', () => {
      callbacks.onUtteranceEnd?.();
    });

    // Errors
    connection.on('Error', (error) => {
      logger.error('Deepgram connection error', {
        sessionId,
        error: error.message
      });
      callbacks.onError?.(error);
    });

    // Connection opened
    connection.on('Open', () => {
      logger.info('Deepgram connection opened', { sessionId });
      callbacks.onOpen?.();
    });

    // Connection closed
    connection.on('Close', () => {
      logger.info('Deepgram connection closed', { sessionId });
      callbacks.onClose?.();
    });
  }
}

module.exports = new DeepgramService();
```

### Create ElevenLabs Service

Create `src/services/elevenLabsService.js`:

```javascript
const axios = require('axios');
const logger = require('../utils/logger');

class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    this.baseURL = 'https://api.elevenlabs.io/v1';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Generate speech from text
   */
  async generateSpeech(text, options = {}) {
    try {
      const response = await this.client.post(`/text-to-speech/${this.voiceId}/stream`, {
        text: text,
        model_id: options.model || 'eleven_monolingual_v1',
        voice_settings: {
          stability: options.stability || 0.5,
          similarity_boost: options.similarity_boost || 0.75,
          style: options.style || 0.0,
          use_speaker_boost: options.use_speaker_boost || true
        }
      }, {
        responseType: 'stream'
      });

      logger.info('ElevenLabs TTS generated', {
        textLength: text.length,
        voiceId: this.voiceId,
        model: options.model || 'eleven_monolingual_v1'
      });

      return response.data;

    } catch (error) {
      logger.error('ElevenLabs TTS error', {
        error: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });
      throw error;
    }
  }

  /**
   * Generate speech and return as chunks
   */
  async generateSpeechChunks(text, options = {}) {
    try {
      const audioStream = await this.generateSpeech(text, options);
      const chunks = [];

      return new Promise((resolve, reject) => {
        audioStream.on('data', (chunk) => {
          chunks.push(chunk);
        });

        audioStream.on('end', () => {
          logger.info('ElevenLabs audio stream completed', {
            totalChunks: chunks.length,
            totalSize: chunks.reduce((sum, chunk) => sum + chunk.length, 0)
          });
          resolve(chunks);
        });

        audioStream.on('error', (error) => {
          logger.error('ElevenLabs stream error', { error: error.message });
          reject(error);
        });
      });

    } catch (error) {
      logger.error('Failed to generate speech chunks', { error: error.message });
      throw error;
    }
  }

  /**
   * Get available voices
   */
  async getVoices() {
    try {
      const response = await this.client.get('/voices');
      return response.data.voices;
    } catch (error) {
      logger.error('Failed to get ElevenLabs voices', { error: error.message });
      throw error;
    }
  }
}

module.exports = new ElevenLabsService();
```

---

## 🔄 Step 5: Update Audio WebSocket Service

Replace the mock functions in `src/services/audioWebSocketService.js`:

### Add imports at the top:
```javascript
const deepgramService = require('./deepgramService');
const elevenLabsService = require('./elevenLabsService');
```

### Replace `simulateSTT()` method:
```javascript
/**
 * Setup real STT with Deepgram
 */
async setupSTT(sessionId, options = {}) {
  const session = this.sessions.get(sessionId);
  if (!session) return;

  const { ws } = session;

  try {
    // Create Deepgram connection
    const connection = await deepgramService.createLiveConnection(sessionId, options);

    // Setup event handlers
    deepgramService.setupEventHandlers(sessionId, {
      onTranscript: (result) => {
        if (result.interim) {
          this.sendMessage(ws, {
            type: 'interim_transcript',
            transcript: result.text,
            confidence: result.confidence
          });
        } else if (result.final) {
          this.sendMessage(ws, {
            type: 'final_transcript',
            transcript: result.text,
            confidence: result.confidence
          });

          // Process with AI
          this.processTranscriptWithAI(sessionId, result.text);
        }
      },

      onSpeechStart: () => {
        this.sendMessage(ws, {
          type: 'status',
          message: 'Speech detected'
        });
      },

      onUtteranceEnd: () => {
        this.sendMessage(ws, {
          type: 'status',
          message: 'Speech ended'
        });
      },

      onError: (error) => {
        this.sendMessage(ws, {
          type: 'error',
          message: 'Speech recognition error: ' + error.message
        });
      },

      onOpen: () => {
        this.sendMessage(ws, {
          type: 'status',
          message: 'Speech recognition ready'
        });
      }
    });

    session.deepgramConnection = connection;
    logger.info('STT setup completed', { sessionId });

  } catch (error) {
    logger.error('STT setup failed', {
      sessionId,
      error: error.message
    });

    this.sendMessage(ws, {
      type: 'error',
      message: 'Failed to setup speech recognition'
    });
  }
}

/**
 * Handle incoming PCM audio data (updated)
 */
async handleAudioData(sessionId, audioData) {
  const session = this.sessions.get(sessionId);
  if (!session || !session.isTranscribing) return;

  try {
    // Send directly to Deepgram
    await deepgramService.sendAudio(sessionId, audioData);

  } catch (error) {
    logger.error('Audio data processing error', {
      sessionId,
      error: error.message
    });
  }
}
```

### Replace `simulateTTS()` method:
```javascript
/**
 * Generate TTS with ElevenLabs (replaces simulateTTS)
 */
async generateAndSendTTS(sessionId, text) {
  const session = this.sessions.get(sessionId);
  if (!session) return;

  const { ws } = session;

  try {
    this.sendMessage(ws, {
      type: 'status',
      message: 'Generating speech...'
    });

    // Generate speech with ElevenLabs
    const audioChunks = await elevenLabsService.generateSpeechChunks(text, {
      model: 'eleven_monolingual_v1',
      stability: 0.5,
      similarity_boost: 0.75
    });

    // Send audio chunks as binary data
    for (const chunk of audioChunks) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(chunk);
      }
    }

    this.sendMessage(ws, {
      type: 'status',
      message: 'Speech playback complete'
    });

    logger.info('Real TTS audio sent', {
      sessionId,
      textLength: text.length,
      chunks: audioChunks.length
    });

  } catch (error) {
    logger.error('Real TTS generation error', {
      sessionId,
      error: error.message
    });
    
    this.sendMessage(ws, {
      type: 'tts_error',
      message: 'Failed to generate speech: ' + error.message
    });
  }
}
```

### Update `handleControlMessage()` to use real STT:
```javascript
case 'start':
  session.isTranscribing = true;
  session.model = data.model || 'nova-2';
  session.language = data.language || 'en-US';
  
  // Setup real STT instead of mock
  await this.setupSTT(sessionId, {
    model: session.model,
    language: session.language
  });
  
  this.sendMessage(ws, {
    type: 'status',
    message: `Started transcription with ${session.model} (${session.language})`
  });
  break;
```

### Update cleanup to close Deepgram connections:
```javascript
/**
 * Cleanup session (updated)
 */
cleanupSession(sessionId) {
  const session = this.sessions.get(sessionId);
  if (session) {
    session.isTranscribing = false;
    session.audioBuffer = null;
    
    // Close Deepgram connection
    deepgramService.closeConnection(sessionId);
    
    this.sessions.delete(sessionId);
    logger.info('Audio session cleaned up', { sessionId });
  }
}
```

---

## 🧪 Step 6: Testing

### Test STT:
```bash
# Test with curl (after starting server)
curl -X POST http://localhost:3000/api/v1/chat/audio/test-stt \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "audio=@test-audio.wav"
```

### Test TTS:
```bash
# Test with curl
curl -X POST http://localhost:3000/api/v1/chat/audio/test-tts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, this is a test of the text to speech system"}'
```

### Test Full Audio Chat:
1. Open `http://localhost:3000/audio-demo.html`
2. Click "Start Transcription"
3. Speak into microphone
4. Verify real transcription appears
5. Verify AI responds with real TTS audio

---

## ⚠️ Error Handling

### Common Issues:

1. **API Key Issues**:
   ```javascript
   if (!process.env.DEEPGRAM_API_KEY) {
     throw new Error('DEEPGRAM_API_KEY not set');
   }
   ```

2. **Rate Limiting**:
   ```javascript
   if (error.response?.status === 429) {
     logger.warn('Rate limited, retrying...', { sessionId });
     // Implement retry logic
   }
   ```

3. **Connection Failures**:
   ```javascript
   connection.on('Error', (error) => {
     // Fallback to mock or retry
     this.fallbackToMock(sessionId);
   });
   ```

---

## 🚀 Step 7: Deployment

### Environment Variables (Production):
```env
DEEPGRAM_API_KEY=your_production_deepgram_key
ELEVENLABS_API_KEY=your_production_elevenlabs_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
```

### Performance Considerations:
- **Deepgram**: ~100ms latency for transcription
- **ElevenLabs**: ~500ms-1s latency for TTS generation
- **Concurrent Sessions**: Monitor API usage limits
- **Audio Quality**: Use 16kHz for STT, 24kHz for TTS

---

## 💰 Cost Estimation

### Deepgram Pricing:
- **Pay-as-you-go**: $0.0059 per minute
- **Growth Plan**: $0.0043 per minute (with commitment)

### ElevenLabs Pricing:
- **Starter**: $5/month (30,000 characters)
- **Creator**: $22/month (100,000 characters)
- **Pro**: $99/month (500,000 characters)

### Example Monthly Cost (1000 users, 5 min/user):
- **STT**: 5000 minutes × $0.0059 = ~$30/month
- **TTS**: ~50,000 characters × $0.00022 = ~$11/month
- **Total**: ~$41/month

---

## ✅ Implementation Summary

**Files to modify:**
1. `src/services/audioWebSocketService.js` - Replace mock functions
2. Create `src/services/deepgramService.js` - STT integration
3. Create `src/services/elevenLabsService.js` - TTS integration
4. Update `.env` - Add API keys

**Time estimate:** 4-6 hours for experienced developer

**Testing required:** STT accuracy, TTS quality, error handling, performance

**🎯 Result:** Real-time voice chat with professional-grade STT/TTS services!
