# Imagomum Backend - Frontend Integration Guide

## 🎯 Overview

This guide covers all backend APIs and integrations for the Imagomum pregnancy app. The backend provides authentication, user management, pregnancy tracking, ultrasound analysis, AI chat, and real-time audio features.

**Base URL**: `http://localhost:3000/api/v1` (Development)  
**Authentication**: JWT Bearer tokens  
**Content-Type**: `application/json` (unless specified otherwise)

---

## 🔐 Authentication & User Management

### Login
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "test@imagomum.com",
  "password": "Pass@123"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "id": "819a2f7a-b61b-41a9-bb39-df1eb4ec5ff4",
      "fullName": "God'sGrace Chioma",
      "email": "test@imagomum.com",
      "phoneNumber": "909038303993",
      "isVerified": true,
      "onboardingCompleted": true,
      "pregnancyInfo": {
        "currentWeek": 12,
        "trimester": "first_trimester",
        "edd": "2026-01-08",
        "gestationalWeeks": 12,
        "gestationalDays": 3
      }
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "status": "success",
  "message": "Logout successful"
}
```

**Frontend Implementation:**
```javascript
// Logout function
async function logout() {
  try {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
  } finally {
    // Always clear tokens on logout (even if API call fails)
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    window.location.href = '/login';
  }
}
```

### Get User Profile
```http
GET /api/v1/users/profile
Authorization: Bearer YOUR_JWT_TOKEN
```

### Update Profile
```http
PUT /api/v1/users/profile
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "fullName": "God'sGrace Chioma",
  "phoneNumber": "909038303993"
}
```

### 🔐 Change Password
```http
PUT /api/v1/users/change-password
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "currentPassword": "Pass@123",
  "newPassword": "NewPass@456"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Password changed successfully"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter  
- At least one number
- At least one special character (@$!%*?&)

---

## 🤰 Onboarding & Pregnancy Tracking

### Get Onboarding Status
```http
GET /api/v1/onboarding/status
Authorization: Bearer YOUR_JWT_TOKEN
```

### Submit LMP Date (Last Menstrual Period)
```http
POST /api/v1/onboarding/answer
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "questionId": "lmp_date",
  "answerType": "exact_date",
  "answer": "2025-06-29"
}
```

**Or for approximate date:**
```json
{
  "questionId": "lmp_date",
  "answerType": "approximate_month", 
  "answer": {
    "month": 6,
    "year": 2025
  }
}
```

**Response (with AI Context Sync):**
```json
{
  "status": "success",
  "message": "Onboarding completed successfully!",
  "data": {
    "onboarding": {
      "isCompleted": true,
      "currentStep": 1,
      "totalSteps": 1,
      "progress": 100
    },
    "pregnancyInfo": {
      "currentWeek": 12,
      "gestationalDays": 3,
      "trimester": "first_trimester",
      "edd": "2026-01-08",
      "lmpDate": "2025-06-29",
      "isApproximate": false
    },
    "aiContext": {
      "synced": true,
      "exists": true,
      "currentWeek": 12,
      "trimester": "first_trimester"
    }
  }
}
```

**🤖 AI Context Integration:**
- Automatically syncs pregnancy data with AI team after onboarding completion
- AI team receives user's pregnancy week, trimester, and profile data
- Used for personalized AI chat responses

---

## 📸 Ultrasound Scan Management

### Upload Ultrasound Scan
```http
POST /api/v1/ultrasounds/upload
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data

Form Data:
- ultrasoundImage: (file) - Image file (JPEG, PNG, BMP, TIFF, max 50MB)
- scanType: "2D" | "3D" | "4D" | "Doppler" | "Other"
- gestationalAge: "12 weeks 3 days" (optional)
- scanDate: "2025-08-15" (optional)
- notes: "First trimester scan" (optional)
```

**Response:**
```json
{
  "status": "success",
  "message": "Ultrasound scan uploaded successfully. AI analysis started.",
  "data": {
    "scan": {
      "id": "scan_1755239544087_9f2400",
      "originalFileName": "ultrasound_12weeks.jpg",
      "scanType": "2D",
      "aiAnalysisStatus": "processing",
      "createdAt": "2025-08-15T08:30:00.000Z"
    }
  }
}
```

### Get Scan History
```http
GET /api/v1/ultrasounds?page=1&limit=10
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "scans": [
      {
        "id": "scan_1755239544087_9f2400",
        "originalFileName": "ultrasound_12weeks.jpg",
        "scanType": "2D",
        "gestationalAge": "12 weeks 3 days",
        "aiAnalysisStatus": "completed",
        "aiAnalysis": {
          "findings": "Normal fetal development observed...",
          "recommendations": "Continue regular prenatal care...",
          "confidence": 0.95
        },
        "createdAt": "2025-08-15T08:30:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Get Specific Scan Details
```http
GET /api/v1/ultrasounds/{scanId}
Authorization: Bearer YOUR_JWT_TOKEN
```

### Download Scan File
```http
GET /api/v1/ultrasounds/{scanId}/download
Authorization: Bearer YOUR_JWT_TOKEN
```

### Delete Scan
```http
DELETE /api/v1/ultrasounds/{scanId}
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 💬 AI Chat System

### Get Chat Threads (ChatGPT-style)
```http
GET /api/v1/chat/threads?page=1&limit=20
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "threads": [
      {
        "threadId": "thread_819a2f7a-b61b-41a9-bb39-df1eb4ec5ff4_1755065387486_jdznyx",
        "title": "Nutrition tips for second trimester",
        "firstMessageAt": "2025-08-13T06:05:05.994Z",
        "lastActivityAt": "2025-08-13T06:05:18.301Z",
        "preview": "I need nutrition tips based on my trimester",
        "totalMessages": 4
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false
    }
  }
}
```

### Get Thread Messages
```http
GET /api/v1/chat/threads/{threadId}/messages?page=1&limit=50
Authorization: Bearer YOUR_JWT_TOKEN
```

### Send Chat Message
```http
POST /api/v1/chat/message
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "message": "I need nutrition tips for my second trimester",
  "threadId": "thread_819a2f7a-b61b-41a9-bb39-df1eb4ec5ff4_1755065387486_jdznyx"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "userMessage": {
      "id": "msg_123",
      "content": "I need nutrition tips for my second trimester",
      "messageType": "user",
      "createdAt": "2025-08-15T09:00:00.000Z"
    },
    "aiResponse": {
      "id": "msg_124", 
      "content": "During your second trimester, focus on...",
      "messageType": "assistant",
      "createdAt": "2025-08-15T09:00:05.000Z"
    },
    "threadId": "thread_819a2f7a-b61b-41a9-bb39-df1eb4ec5ff4_1755065387486_jdznyx"
  }
}
```

### Send Streaming Chat Message
```http
POST /api/v1/chat/message/stream
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "message": "Tell me about fetal development at 20 weeks",
  "threadId": "thread_819a2f7a-b61b-41a9-bb39-df1eb4ec5ff4_1755065387486_jdznyx"
}
```

**Response (Server-Sent Events):**
```
data: {"type": "start", "threadId": "thread_..."}

data: {"type": "chunk", "delta": "At", "threadId": "thread_..."}

data: {"type": "chunk", "delta": " 20", "threadId": "thread_..."}

data: {"type": "chunk", "delta": " weeks", "threadId": "thread_..."}

data: {"type": "complete", "threadId": "thread_...", "messageId": "msg_125"}
```

### Upload Chat File (Image/Voice)
```http
POST /api/v1/chat/upload
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data

Form Data:
- file: (file) - Image or voice file
- threadId: "thread_..." (optional)
```

### Delete Conversation
```http
DELETE /api/v1/chat/conversations/{conversationId}
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## 🎤 Real-Time Audio Chat

### WebSocket Connection
```javascript
const ws = new WebSocket('ws://localhost:3000/api/v1/chat/audio?token=YOUR_JWT_TOKEN');
```

### Start Voice Session
```javascript
ws.send(JSON.stringify({
  action: 'start',
  model: 'nova-3',        // STT model: nova-3, nova-2, base, enhanced, general
  language: 'en-US'       // Language: en-US, en-UK, es, fr, de, it, pt
}));
```

### Message Types Received
```javascript
ws.onmessage = (event) => {
  if (event.data instanceof Blob) {
    // Binary audio data (TTS response from AI)
    playAudioBlob(event.data);
  } else {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'connected':
        console.log('Session:', message.sessionId);
        break;
        
      case 'interim_transcript':
        console.log('Hearing:', message.transcript);
        break;
        
      case 'final_transcript':
        console.log('You said:', message.transcript);
        break;
        
      case 'llm_processing':
        console.log('AI is thinking...');
        break;
        
      case 'error':
        console.error('Error:', message.message);
        break;
    }
  }
};
```

### Send Audio Data
```javascript
// Send PCM audio data from microphone
processor.port.onmessage = (event) => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(event.data); // Raw PCM buffer
  }
};
```

### Stop Voice Session
```javascript
ws.send(JSON.stringify({ action: 'stop' }));
```

**📖 Complete Audio Integration Guide**: See `docs/FRONTEND_AUDIO_INTEGRATION.md`

---

## 🔧 Error Handling

### Standard Error Response
```json
{
  "status": "fail",
  "error": {
    "statusCode": 400,
    "message": "Validation failed",
    "isOperational": true
  },
  "message": "Validation failed",
  "timestamp": "2025-08-15T09:00:00.000Z"
}
```

### Common HTTP Status Codes
- **200**: Success
- **201**: Created (uploads, registrations)
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid/expired token)
- **403**: Forbidden (insufficient permissions)
- **404**: Not Found (resource doesn't exist)
- **409**: Conflict (duplicate data)
- **413**: Payload Too Large (file size exceeded)
- **415**: Unsupported Media Type (invalid file format)
- **429**: Too Many Requests (rate limited)
- **500**: Internal Server Error

### JWT Token Handling
```javascript
// Add token to all requests
const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});

// Handle token expiration
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token expired - redirect to login
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 🧪 Testing & Development

### Health Check
```http
GET /api/v1/health
```

### API Documentation
- **Swagger UI**: `http://localhost:3000/api-docs`
- **Interactive testing**: Available in Swagger interface

### Sample Test User
```json
{
  "email": "test@imagomum.com",
  "password": "Pass@123"
}
```

### File Upload Testing
```bash
# Test ultrasound upload
curl -X POST http://localhost:3000/api/v1/ultrasounds/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "ultrasoundImage=@test-scan.jpg" \
  -F "scanType=2D"
```

### Chat Testing
```bash
# Test chat message
curl -X POST http://localhost:3000/api/v1/chat/message \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, I need pregnancy advice"}'
```

---

## 🚀 Production Considerations

### Environment Variables
```env
# Required for production
NODE_ENV=production
JWT_SECRET=your-super-secret-jwt-key
DB_PASSWORD=your-database-password
AZURE_STORAGE_CONNECTION_STRING=your-azure-connection-string

# Optional API keys (for real STT/TTS)
DEEPGRAM_API_KEY=your-deepgram-key
ELEVENLABS_API_KEY=your-elevenlabs-key
```

### HTTPS/WSS
- **Production API**: Use `https://` for all HTTP requests
- **Production WebSocket**: Use `wss://` for audio chat connections

### Rate Limiting
- **Chat API**: 100 requests per minute per user
- **Upload API**: 10 uploads per minute per user
- **Auth API**: 5 login attempts per minute per IP

### File Size Limits
- **Ultrasound Images**: 50MB maximum
- **Chat Files**: 10MB maximum
- **Supported Formats**: JPEG, PNG, BMP, TIFF, DICOM (ultrasounds), MP3, WAV (voice)

---

## 📞 Support & Integration Help

### Key Integration Points
1. **Authentication Flow**: Login → Store JWT → Use in all requests
2. **Onboarding Flow**: Collect LMP → Auto-sync with AI context
3. **Ultrasound Flow**: Upload → AI analysis → View results
4. **Chat Flow**: Send message → Get AI response → Maintain thread context
5. **Audio Flow**: WebSocket connection → Real-time voice chat

### Thread Management (Important!)
- **New Conversation**: Don't send `threadId` in first message
- **Continue Conversation**: Always send same `threadId` for follow-up messages
- **Thread Persistence**: Store `threadId` locally to continue conversations later

### Common Integration Issues
1. **CORS**: Ensure your frontend domain is allowed
2. **Content-Type**: Use `multipart/form-data` for file uploads, `application/json` for data
3. **Authentication**: Include `Bearer` prefix in Authorization header
4. **WebSocket**: Use query parameter for JWT token authentication

### Quick Start Checklist
- [ ] Implement JWT token storage and refresh
- [ ] Add authentication interceptor to HTTP client
- [ ] Implement file upload with progress tracking
- [ ] Add WebSocket connection for audio chat
- [ ] Handle thread management for chat continuity
- [ ] Implement error handling and user feedback
- [ ] Test all endpoints with sample data

---

**🎉 Your backend is fully ready for frontend integration! All APIs are documented, tested, and production-ready.**

**Need help?** Check the individual documentation files:
- `docs/ULTRASOUND_API_DOCUMENTATION.md` - Detailed ultrasound API guide
- `docs/CHAT_API_DOCUMENTATION.md` - Comprehensive chat API reference  
- `docs/FRONTEND_AUDIO_INTEGRATION.md` - Complete audio chat integration guide
