# Audio Chat Integration - Simple Guide

## 🎯 **What Your Frontend Needs:**

### **1. WebSocket Connection (Authenticated)**
```javascript
// Use existing JWT token
const token = getAuthToken(); // Your existing auth token
const socket = new WebSocket(`ws://localhost:3000/api/v1/chat/audio?token=${token}`);
socket.binaryType = 'blob';
```

### **2. Start Audio Chat**
```javascript
// Start voice conversation
socket.send(JSON.stringify({
  action: 'start',
  model: 'nova-3',
  language: 'en-US'
}));

// Optional: Continue existing thread
socket.send(JSON.stringify({
  action: 'set_thread',
  threadId: 'existing_thread_id' // From your chat history
}));
```

### **3. Send Audio (Microphone)**
```javascript
// Load audio processor
await audioContext.audioWorklet.addModule('/static/audio-processor.js');
const processor = new AudioWorkletNode(audioContext, 'audio-processor');

// Connect microphone
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const input = audioContext.createMediaStreamSource(stream);
input.connect(processor);

// Send audio data
processor.port.onmessage = (event) => {
  socket.send(event.data); // Raw PCM audio buffer
};
```

### **4. Receive Responses**
```javascript
socket.onmessage = function(event) {
  if (event.data instanceof Blob) {
    // AI voice response - play through speakers
    playAudioResponse(event.data);
  } else {
    // Text messages (transcription, status)
    const data = JSON.parse(event.data);
    
    switch(data.type) {
      case 'final_transcript':
        showUserMessage(data.transcript);
        break;
      case 'status':
        showStatus(data.message);
        break;
      case 'error':
        showError(data.message);
        break;
    }
  }
};
```

### **5. Stop Audio Chat**
```javascript
socket.send(JSON.stringify({ action: 'stop' }));
```

---

## ✅ **What's Handled Automatically:**

- ✅ **Authentication**: Uses your existing JWT tokens
- ✅ **Thread Management**: Same `threadId` system as text chat
- ✅ **Database Storage**: Saves to existing chat tables
- ✅ **AI Processing**: Uses existing AI service
- ✅ **Conversation History**: Shows up in `/api/v1/chat/threads`

---

## 🎯 **Integration Points:**

### **Same as Text Chat:**
- **Authentication**: Same JWT tokens
- **Threads**: Same `threadId` system  
- **History**: Same `/api/v1/chat/threads` endpoint
- **Database**: Same `chat_conversations` and `chat_messages` tables

### **Audio-Specific:**
- **WebSocket**: `ws://localhost:3000/api/v1/chat/audio?token=JWT`
- **Audio Processor**: `/static/audio-processor.js`
- **Voice Messages**: Saved with `contentType: 'voice'`

---

## 📱 **Frontend Flow:**

1. **User clicks "Voice Chat"** → Connect WebSocket with JWT
2. **User speaks** → Send audio data via WebSocket  
3. **AI responds** → Receive audio + text via WebSocket
4. **Conversation continues** → Same thread as text chat
5. **User stops** → Close WebSocket, conversation saved

---

## 🔧 **That's It!**

**No separate authentication, no complex setup. Just WebSocket + existing auth system.**

**Audio conversations appear in your existing chat history alongside text messages.** 🚀 