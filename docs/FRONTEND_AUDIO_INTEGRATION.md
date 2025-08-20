# Imagomum Audio Chat - Frontend Integration Guide

## 🎯 Overview

The Audio Chat system provides real-time voice conversations with the AI pregnancy assistant. It integrates seamlessly with your existing text chat system using the same authentication, thread management, and database storage.

**Key Features:**
- ✅ Real-time voice conversation (speak → AI responds with voice)
- ✅ Same JWT authentication as existing API
- ✅ Same thread system as text chat (conversation continuity)
- ✅ Conversations appear in existing chat history
- ✅ Multi-language and model support

---

## 🔗 WebSocket Endpoint

### Connection URL
```
ws://localhost:3000/api/v1/chat/audio?token=YOUR_JWT_TOKEN
```

### Authentication
- **Method**: JWT token in query parameter
- **Token**: Same JWT token used for existing API calls
- **No separate authentication needed**

---

## 🤖 Available Models & Languages

### STT Models (Speech-to-Text)
```javascript
const models = [
  'nova-3',      // Latest, most accurate (recommended)
  'nova-2',      // Previous generation
  'base',        // Basic, faster processing
  'enhanced',    // Enhanced accuracy
  'general'      // General purpose
];
```

### Supported Languages
```javascript
const languages = [
  'en-US',       // English (US) - default
  'en-UK',       // English (UK)
  'es',          // Spanish
  'fr',          // French
  'de',          // German
  'it',          // Italian
  'pt'           // Portuguese
];
```

---

## 📱 Frontend Implementation

### 1. WebSocket Connection

```javascript
class AudioChatService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.currentThreadId = null;
  }

  async connect(jwtToken) {
    const wsUrl = `ws://localhost:3000/api/v1/chat/audio?token=${jwtToken}`;
    
    this.socket = new WebSocket(wsUrl);
    this.socket.binaryType = 'blob';
    
    return new Promise((resolve, reject) => {
      this.socket.onopen = () => {
        this.isConnected = true;
        console.log('✅ Audio chat connected');
        resolve();
      };
      
      this.socket.onerror = (error) => {
        console.error('❌ Audio chat connection failed:', error);
        reject(error);
      };
      
      this.socket.onmessage = (event) => {
        this.handleMessage(event);
      };
      
      this.socket.onclose = () => {
        this.isConnected = false;
        console.log('🔌 Audio chat disconnected');
      };
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }
}
```

### 2. Start Audio Session

```javascript
async startVoiceChat(model = 'nova-3', language = 'en-US') {
  if (!this.isConnected) {
    throw new Error('Not connected to audio service');
  }

  // Start audio session
  this.socket.send(JSON.stringify({
    action: 'start',
    model: model,
    language: language
  }));

  // Optional: Continue existing conversation
  if (this.currentThreadId) {
    this.socket.send(JSON.stringify({
      action: 'set_thread',
      threadId: this.currentThreadId
    }));
  }

  // Initialize microphone
  await this.initializeMicrophone();
}
```

### 3. Audio Processing Setup

```javascript
async initializeMicrophone() {
  try {
    // Create audio context
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });

    // Load audio processor
    await this.audioContext.audioWorklet.addModule('/static/audio-processor.js');
    this.processor = new AudioWorkletNode(this.audioContext, 'audio-processor');

    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    // Connect audio pipeline
    this.input = this.audioContext.createMediaStreamSource(stream);
    this.input.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    // Handle PCM data from processor
    this.processor.port.onmessage = (event) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(event.data); // Send raw PCM buffer
      }
    };

    console.log('🎤 Microphone initialized');
  } catch (error) {
    console.error('❌ Microphone initialization failed:', error);
    throw error;
  }
}
```

### 4. Audio Playback (TTS)

```javascript
initializeSpeaker() {
  this.speakerContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 24000
  });
  this.nextPlayTime = this.speakerContext.currentTime;
}

playTTSAudio(audioBlob) {
  const reader = new FileReader();
  reader.onload = () => {
    const arrayBuffer = reader.result;
    const pcmData = new Int16Array(arrayBuffer);
    this.scheduleAudioPlayback(pcmData);
  };
  reader.readAsArrayBuffer(audioBlob);
}

scheduleAudioPlayback(pcmData) {
  if (!this.speakerContext) return;

  const frameCount = pcmData.length;
  const audioBuffer = this.speakerContext.createBuffer(1, frameCount, 24000);
  const bufferData = audioBuffer.getChannelData(0);

  // Convert PCM to float
  for (let i = 0; i < frameCount; i++) {
    bufferData[i] = pcmData[i] / 32768.0;
  }

  const source = this.speakerContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(this.speakerContext.destination);

  // Schedule seamless playback
  const currentTime = this.speakerContext.currentTime;
  if (this.nextPlayTime < currentTime) {
    this.nextPlayTime = currentTime;
  }

  source.start(this.nextPlayTime);
  this.nextPlayTime += audioBuffer.duration;
}
```

### 5. Message Handling

```javascript
handleMessage(event) {
  if (event.data instanceof Blob) {
    // Binary audio data (TTS response)
    this.playTTSAudio(event.data);
    this.onAudioReceived?.(event.data);
  } else {
    // JSON control messages
    try {
      const message = JSON.parse(event.data);
      this.handleControlMessage(message);
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  }
}

handleControlMessage(message) {
  switch (message.type) {
    case 'connected':
      console.log(`🔗 Connected: Session ${message.sessionId}`);
      this.onConnected?.(message);
      break;

    case 'status':
      console.log(`ℹ️ Status: ${message.message}`);
      this.onStatus?.(message.message);
      break;

    case 'interim_transcript':
      console.log(`👂 Hearing: "${message.transcript}"`);
      this.onInterimTranscript?.(message.transcript);
      break;

    case 'final_transcript':
      console.log(`🗣️ You said: "${message.transcript}"`);
      this.onFinalTranscript?.(message.transcript);
      break;

    case 'llm_processing':
      console.log(`🤖 ${message.message}`);
      this.onAIProcessing?.(message.message);
      break;

    case 'llm_complete':
      console.log(`✅ ${message.message}`);
      this.onAIComplete?.(message.message);
      break;

    case 'error':
      console.error(`❌ Error: ${message.message}`);
      this.onError?.(message.message);
      break;

    default:
      console.log('Unknown message type:', message);
  }
}
```

### 6. Stop Audio Session

```javascript
async stopVoiceChat() {
  // Stop transcription
  if (this.socket && this.socket.readyState === WebSocket.OPEN) {
    this.socket.send(JSON.stringify({ action: 'stop' }));
  }

  // Stop microphone
  if (this.processor) {
    this.processor.disconnect();
    this.processor = null;
  }
  
  if (this.input) {
    this.input.disconnect();
    this.input = null;
  }
  
  if (this.audioContext) {
    await this.audioContext.close();
    this.audioContext = null;
  }

  // Stop speaker
  if (this.speakerContext) {
    await this.speakerContext.close();
    this.speakerContext = null;
    this.nextPlayTime = 0;
  }

  console.log('🛑 Voice chat stopped');
}
```

---

## 🔄 Thread Management (Conversation Continuity)

### New Conversation
```javascript
// Don't set threadId - creates new conversation
audioChat.currentThreadId = null;
await audioChat.startVoiceChat('nova-3', 'en-US');
```

### Continue Existing Conversation
```javascript
// Set threadId from existing chat history
audioChat.currentThreadId = 'thread_819a2f7a-b61b-41a9-bb39-df1eb4ec5ff4_1755065387486_jdznyx';
await audioChat.startVoiceChat('nova-3', 'en-US');
```

### Get Thread from Chat History
```javascript
// Use existing chat API to get threads
const response = await fetch('/api/v1/chat/threads', {
  headers: { 'Authorization': `Bearer ${jwtToken}` }
});
const { threads } = await response.json();

// Continue a specific thread
const selectedThread = threads[0];
audioChat.currentThreadId = selectedThread.threadId;
```

---

## 📋 Complete Usage Example

```javascript
class VoiceChatComponent {
  constructor() {
    this.audioChat = new AudioChatService();
    this.isRecording = false;
  }

  async startVoiceChat() {
    try {
      // Get JWT token (your existing method)
      const token = await this.getAuthToken();
      
      // Connect to audio service
      await this.audioChat.connect(token);
      
      // Set up event handlers
      this.audioChat.onFinalTranscript = (transcript) => {
        this.displayUserMessage(transcript);
      };
      
      this.audioChat.onAudioReceived = (audioBlob) => {
        this.showAIResponseIndicator();
      };
      
      this.audioChat.onError = (error) => {
        this.showError(error);
      };
      
      // Start voice session
      await this.audioChat.startVoiceChat('nova-3', 'en-US');
      
      this.isRecording = true;
      this.updateUI();
      
    } catch (error) {
      console.error('Failed to start voice chat:', error);
      this.showError('Failed to start voice chat');
    }
  }

  async stopVoiceChat() {
    try {
      await this.audioChat.stopVoiceChat();
      this.audioChat.disconnect();
      
      this.isRecording = false;
      this.updateUI();
      
    } catch (error) {
      console.error('Failed to stop voice chat:', error);
    }
  }

  displayUserMessage(transcript) {
    // Add user message to chat UI
    this.addMessageToChat({
      type: 'user',
      content: transcript,
      timestamp: new Date()
    });
  }

  showAIResponseIndicator() {
    // Show "AI is speaking" indicator
    this.addMessageToChat({
      type: 'assistant',
      content: '🔊 AI is responding...',
      timestamp: new Date()
    });
  }

  updateUI() {
    // Update button states, recording indicators, etc.
    const recordButton = document.getElementById('record-button');
    recordButton.textContent = this.isRecording ? '🛑 Stop' : '🎤 Start Voice Chat';
    recordButton.disabled = false;
  }
}
```

---

## 🎛️ UI Integration Examples

### React Component
```jsx
import React, { useState, useRef } from 'react';

const VoiceChatButton = ({ jwtToken, threadId }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('');
  const audioChat = useRef(new AudioChatService());

  const handleVoiceChat = async () => {
    if (isRecording) {
      await audioChat.current.stopVoiceChat();
      setIsRecording(false);
      setStatus('');
    } else {
      try {
        await audioChat.current.connect(jwtToken);
        audioChat.current.currentThreadId = threadId;
        
        audioChat.current.onStatus = setStatus;
        audioChat.current.onFinalTranscript = (transcript) => {
          console.log('User said:', transcript);
        };
        
        await audioChat.current.startVoiceChat('nova-3', 'en-US');
        setIsRecording(true);
        setStatus('Listening...');
      } catch (error) {
        setStatus('Error: ' + error.message);
      }
    }
  };

  return (
    <div>
      <button onClick={handleVoiceChat} disabled={!jwtToken}>
        {isRecording ? '🛑 Stop' : '🎤 Voice Chat'}
      </button>
      {status && <p>{status}</p>}
    </div>
  );
};
```

### Vue Component
```vue
<template>
  <div>
    <button @click="toggleVoiceChat" :disabled="!jwtToken">
      {{ isRecording ? '🛑 Stop' : '🎤 Voice Chat' }}
    </button>
    <p v-if="status">{{ status }}</p>
  </div>
</template>

<script>
export default {
  props: ['jwtToken', 'threadId'],
  data() {
    return {
      isRecording: false,
      status: '',
      audioChat: new AudioChatService()
    };
  },
  methods: {
    async toggleVoiceChat() {
      if (this.isRecording) {
        await this.audioChat.stopVoiceChat();
        this.isRecording = false;
        this.status = '';
      } else {
        try {
          await this.audioChat.connect(this.jwtToken);
          this.audioChat.currentThreadId = this.threadId;
          
          this.audioChat.onStatus = (msg) => this.status = msg;
          this.audioChat.onFinalTranscript = (transcript) => {
            this.$emit('userMessage', transcript);
          };
          
          await this.audioChat.startVoiceChat('nova-3', 'en-US');
          this.isRecording = true;
          this.status = 'Listening...';
        } catch (error) {
          this.status = 'Error: ' + error.message;
        }
      }
    }
  }
};
</script>
```

---

## 🔧 Error Handling

### Common Issues & Solutions

```javascript
// 1. Microphone Permission Denied
if (error.name === 'NotAllowedError') {
  showError('Microphone access denied. Please allow microphone access and try again.');
}

// 2. WebSocket Connection Failed
socket.onerror = (error) => {
  if (error.code === 1006) {
    showError('Connection failed. Please check your internet connection.');
  } else {
    showError('Audio service unavailable. Please try again later.');
  }
};

// 3. Audio Context Issues (Safari/iOS)
if (audioContext.state === 'suspended') {
  // Resume on user interaction
  document.addEventListener('click', () => {
    audioContext.resume();
  }, { once: true });
}

// 4. JWT Token Expired
socket.onclose = (event) => {
  if (event.code === 1008) { // Policy violation (auth failed)
    showError('Session expired. Please login again.');
    redirectToLogin();
  }
};
```

---

## 📊 Testing & Debugging

### Browser Console Testing
```javascript
// Test WebSocket connection
const token = 'your_jwt_token_here';
const ws = new WebSocket(`ws://localhost:3000/api/v1/chat/audio?token=${token}`);

ws.onopen = () => console.log('✅ Connected');
ws.onmessage = (e) => console.log('📥 Message:', e.data);
ws.onerror = (e) => console.error('❌ Error:', e);

// Test start session
ws.send(JSON.stringify({
  action: 'start',
  model: 'nova-3',
  language: 'en-US'
}));
```

### Network Tab Monitoring
- **WebSocket Connection**: Look for `101 Switching Protocols`
- **Binary Messages**: Audio data should show as binary frames
- **JSON Messages**: Control messages should be readable JSON

---

## 🚀 Production Considerations

### Performance
- **Audio Context**: Reuse audio contexts to avoid memory leaks
- **Buffer Management**: Clear audio buffers after processing
- **Connection Pooling**: Limit concurrent WebSocket connections

### Security
- **Token Validation**: JWT tokens are validated on connection
- **Rate Limiting**: Built-in rate limiting prevents abuse
- **HTTPS Required**: Use `wss://` in production

### Browser Compatibility
- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Requires user interaction for audio context
- **Mobile**: Test thoroughly on iOS/Android

---

## 📞 Support & Integration Help

### Required Files
1. **Audio Processor**: `/static/audio-processor.js` (served by backend)
2. **WebSocket Endpoint**: `ws://localhost:3000/api/v1/chat/audio`
3. **JWT Token**: Use existing authentication tokens

### Integration Checklist
- [ ] WebSocket connection with JWT token
- [ ] Audio processor loaded and connected
- [ ] Microphone permission handling
- [ ] Speaker audio playback
- [ ] Message type handling
- [ ] Error handling and user feedback
- [ ] Thread continuity (optional)
- [ ] UI state management

### Quick Start
1. Copy the `AudioChatService` class
2. Add microphone permission request
3. Add voice chat button to UI
4. Handle audio playback
5. Test with existing JWT tokens

---

**🎉 You're ready to integrate voice chat! The system uses your existing authentication and chat infrastructure - no additional backend setup required.** 