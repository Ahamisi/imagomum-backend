# Chat API Documentation

## Overview
The Chat API provides a comprehensive messaging system for pregnancy-related conversations with AI assistance. It supports both regular and streaming responses, file attachments (images/voice), and conversation management.

## Base URL
```
http://localhost:3000/api/v1/chat
```

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <your_jwt_token>
```

## Endpoints

### 1. Get Chat Threads (ChatGPT Style)
**GET** `/threads`

Retrieve user's chat threads grouped by threadId, similar to ChatGPT's conversation list.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response:**
```json
{
  "status": "success",
  "data": {
    "threads": [
      {
        "threadId": "thread_user_timestamp_random",
        "title": "What should I eat in my first trimester?",
        "firstMessageAt": "2025-08-13T05:00:00.000Z",
        "lastActivityAt": "2025-08-13T05:15:00.000Z",
        "lastMessage": "Based on your pregnancy stage, here are some nutritional...",
        "totalMessages": 6
      }
    ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false
    }
  }
}
```

### 2. Get Thread Messages
**GET** `/threads/{threadId}/messages`

Retrieve all messages for a specific thread (like clicking on a ChatGPT conversation).

**Path Parameters:**
- `threadId`: Thread identifier

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Response:**
```json
{
  "status": "success",
  "data": {
    "threadId": "thread_user_timestamp_random",
    "messages": [
      {
        "id": "uuid",
        "messageType": "user",
        "contentType": "text",
        "content": "What should I eat in my first trimester?",
        "attachmentUrl": null,
        "createdAt": "2025-08-13T05:00:00.000Z"
      },
      {
        "id": "uuid",
        "messageType": "assistant",
        "contentType": "text",
        "content": "Based on your pregnancy stage, here are some nutritional recommendations...",
        "isStreaming": false,
        "streamingComplete": true,
        "createdAt": "2025-08-13T05:00:15.000Z"
      }
    ],
    "pagination": {
      "total": 6,
      "page": 1,
      "limit": 50,
      "totalPages": 1,
      "hasNext": false
    }
  }
}
```

### 3. Get Conversations (Legacy)
**GET** `/conversations`

Retrieve user's chat conversations with pagination.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response:**
```json
{
  "status": "success",
  "data": {
    "conversations": [
      {
        "id": "uuid",
        "threadId": "thread_user_timestamp_random",
        "title": "Should I be worried about high fetal heartbeat?",
        "lastMessage": "Everything looks normal based on your scan...",
        "lastMessageAt": "2025-08-13T04:35:17.046Z",
        "messageCount": 8,
        "createdAt": "2025-08-13T04:30:00.000Z",
        "updatedAt": "2025-08-13T04:35:17.046Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1,
      "hasNext": false
    }
  }
}
```

### 2. Get Conversation Messages
**GET** `/conversations/{conversationId}/messages`

Retrieve messages for a specific conversation.

**Path Parameters:**
- `conversationId`: UUID of the conversation

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)

**Response:**
```json
{
  "status": "success",
  "data": {
    "conversation": {
      "id": "uuid",
      "threadId": "thread_user_timestamp_random",
      "title": "Conversation title",
      "messageCount": 8
    },
    "messages": [
      {
        "id": "uuid",
        "messageType": "user",
        "contentType": "text",
        "content": "Should I be worried about high fetal heartbeat?",
        "attachmentUrl": null,
        "createdAt": "2025-08-13T04:30:00.000Z"
      },
      {
        "id": "uuid",
        "messageType": "assistant",
        "contentType": "text",
        "content": "Based on your question about fetal heartbeat...",
        "isStreaming": false,
        "streamingComplete": true,
        "createdAt": "2025-08-13T04:30:15.000Z"
      }
    ],
    "pagination": {
      "total": 8,
      "page": 1,
      "limit": 50,
      "totalPages": 1,
      "hasNext": false
    }
  }
}
```

### 5. Send Regular Message
**POST** `/message`

Send a regular chat message and receive AI response.

**Request Body:**
```json
{
  "conversationId": "uuid", // Optional for existing conversations
  "threadId": "string", // Optional - provide to continue existing thread, omit for new thread
  "message": "Should I be worried about high fetal heartbeat?",
  "imagePath": "https://example.com/ultrasound.jpg" // Optional
}
```

**Thread Behavior:**
- **New Thread**: Omit `threadId` to create a new conversation thread
- **Continue Thread**: Provide existing `threadId` to continue the conversation
- **ChatGPT Style**: Use `threadId` from `/threads` endpoint to continue specific conversations

**Response:**
```json
{
  "status": "success",
  "data": {
    "conversation": {
      "id": "uuid",
      "threadId": "thread_user_timestamp_random",
      "title": "Should I be worried about high fetal heartbeat?",
      "messageCount": 2
    },
    "userMessage": {
      "id": "uuid",
      "messageType": "user",
      "contentType": "text",
      "content": "Should I be worried about high fetal heartbeat?",
      "createdAt": "2025-08-13T04:30:00.000Z"
    },
    "aiMessage": {
      "id": "uuid",
      "messageType": "assistant",
      "contentType": "text",
      "content": "Based on your question about fetal heartbeat...",
      "createdAt": "2025-08-13T04:30:15.000Z"
    },
    "aiResponse": {
      "user_id": "string",
      "thread_id": "string",
      "response": "Based on your question about fetal heartbeat...",
      "timestamp": "2025-08-13T04:30:15.182343"
    }
  }
}
```

### 6. Send Streaming Message
**POST** `/stream`

Send a chat message and receive AI response via Server-Sent Events (SSE).

**Request Body:**
```json
{
  "conversationId": "uuid", // Optional for existing conversations
  "threadId": "string", // Optional - provide to continue existing thread, omit for new thread
  "message": "Should I be worried about high fetal heartbeat?",
  "imagePath": "https://example.com/ultrasound.jpg" // Optional
}
```

**Response:** Server-Sent Events stream

**Event Types:**

1. **Conversation Info** (sent first):
```
data: {
  "type": "conversation",
  "conversation": {
    "id": "uuid",
    "threadId": "thread_user_timestamp_random",
    "title": "Should I be worried about high fetal heartbeat?"
  },
  "userMessage": {
    "id": "uuid",
    "messageType": "user",
    "content": "Should I be worried about high fetal heartbeat?"
  }
}
```

2. **Streaming Chunks**:
```
data: {"type": "chunk", "delta": "Based", "user_id": "string", "thread_id": "string"}
data: {"type": "chunk", "delta": " on", "user_id": "string", "thread_id": "string"}
data: {"type": "chunk", "delta": " your", "user_id": "string", "thread_id": "string"}
```

3. **Completion**:
```
data: {
  "type": "complete",
  "aiMessage": {
    "id": "uuid",
    "messageType": "assistant",
    "content": "Based on your question about fetal heartbeat...",
    "isStreaming": true,
    "streamingComplete": true
  },
  "conversation": {
    "id": "uuid",
    "messageCount": 2
  },
  "timestamp": "2025-08-13T04:30:15.221401"
}
```

4. **Error**:
```
data: {
  "type": "error",
  "message": "Error description"
}
```

### 7. Upload File
**POST** `/upload`

Upload image or voice file for chat use.

**Request:** `multipart/form-data`
- `file`: Image or audio file (max 10MB)

**Supported Types:**
- Images: jpeg, jpg, png, gif, webp
- Audio: mp3, wav, m4a, aac

**Response:**
```json
{
  "status": "success",
  "data": {
    "file": {
      "id": "uuid",
      "originalName": "ultrasound.jpg",
      "fileName": "1692345678-abc123def.jpg",
      "filePath": "/uploads/chat/user_id/filename.jpg",
      "cloudUrl": "https://storage.blob.core.windows.net/chat/user_id/filename.jpg",
      "fileSize": 1024000,
      "mimeType": "image/jpeg",
      "uploadedAt": "2025-08-13T04:30:00.000Z"
    }
  }
}
```

### 8. Delete Conversation
**DELETE** `/conversations/{conversationId}`

Delete a conversation and all its messages.

**Path Parameters:**
- `conversationId`: UUID of the conversation to delete

**Response:**
```json
{
  "status": "success",
  "message": "Conversation deleted successfully"
}
```

## ChatGPT-Style Workflow

### How to Build ChatGPT-Like Experience

#### 1. Thread List (Sidebar)
```javascript
// Get all user's chat threads for sidebar
const getThreads = async () => {
  const response = await fetch('/api/v1/chat/threads', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Display: "What should I eat in my first..." with preview
```

#### 2. Thread Detail (Click on Thread)
```javascript
// User clicks on a thread from sidebar
const openThread = async (threadId) => {
  const response = await fetch(`/api/v1/chat/threads/${threadId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Display: Full conversation history in chronological order
```

#### 3. Continue Conversation
```javascript
// Send message in existing thread
const continueThread = async (threadId, message) => {
  const response = await fetch('/api/v1/chat/message', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ threadId, message })
  });
  return response.json();
};
```

#### 4. Start New Thread
```javascript
// "New Chat" button - omit threadId
const startNewThread = async (message) => {
  const response = await fetch('/api/v1/chat/message', {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message }) // No threadId = new thread
  });
  return response.json();
};
```

### UI Flow
1. **Sidebar**: Shows thread list from `GET /threads`
2. **Click Thread**: Load messages from `GET /threads/{threadId}/messages`
3. **Send Message**: Continue with `POST /message` + `threadId`
4. **New Chat**: Start fresh with `POST /message` (no `threadId`)

## Usage Examples

### JavaScript/Frontend Integration

#### 1. Regular Chat Message
```javascript
const sendMessage = async (message, imagePath = null) => {
  const response = await fetch('/api/v1/chat/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      message,
      imagePath
    })
  });
  
  return await response.json();
};
```

#### 2. Streaming Chat Message
```javascript
const sendStreamingMessage = async (message, onChunk, onComplete) => {
  const response = await fetch('/api/v1/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ message })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          
          if (data.type === 'chunk') {
            onChunk(data.delta);
          } else if (data.type === 'complete') {
            onComplete(data);
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      }
    }
  }
};
```

#### 3. File Upload
```javascript
const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/v1/chat/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  return await response.json();
};
```

## Error Handling

All endpoints return errors in this format:
```json
{
  "status": "fail",
  "error": {
    "statusCode": 400,
    "message": "Error description"
  },
  "message": "Error description",
  "timestamp": "2025-08-13T04:30:00.000Z"
}
```

Common error codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid/missing token)
- `404`: Not Found (conversation/message not found)
- `413`: Payload Too Large (file size exceeded)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Rate Limiting
- Default: 100 requests per 15 minutes per IP
- Streaming endpoints have higher limits
- File uploads count as 5 regular requests

## Data Models

### ChatConversation
- `id`: UUID primary key
- `userId`: User who owns the conversation
- `threadId`: Unique thread identifier for AI service
- `title`: Auto-generated from first message
- `lastMessage`: Preview of last message
- `lastMessageAt`: Timestamp of last activity
- `messageCount`: Total messages in conversation
- `isActive`: Whether conversation is active
- `metadata`: Additional conversation data

### ChatMessage
- `id`: UUID primary key
- `conversationId`: Parent conversation
- `userId`: Message owner
- `threadId`: AI service thread ID
- `messageType`: 'user' or 'assistant'
- `contentType`: 'text', 'image', 'voice', or 'file'
- `content`: Message text content
- `attachmentPath`: Local file path (if applicable)
- `attachmentUrl`: Cloud storage URL (if applicable)
- `attachmentType`: MIME type of attachment
- `attachmentSize`: File size in bytes
- `isStreaming`: Whether message was streamed
- `streamingComplete`: Whether streaming finished
- `aiResponseTime`: AI processing time in ms
- `metadata`: Additional message data

## Integration with AI Service

The chat system integrates with the pregnancy AI service:

**AI Service Endpoints:**
- Regular: `POST /api/pregnancy/chat`
- Streaming: `POST /api/pregnancy/chat/stream`

**Request Format:**
```json
{
  "user_id": "string",
  "thread_id": "string", 
  "message": "string",
  "image_path": "string" // optional
}
```

**Response Format:**
```json
{
  "user_id": "string",
  "thread_id": "string",
  "response": "string",
  "timestamp": "2025-08-13T04:38:52.182343"
}
```

## Storage

### File Storage
- **Local**: `/uploads/chat/{userId}/`
- **Cloud**: Azure Blob Storage `chat/{userId}/`
- **Fallback**: Local storage if cloud unavailable

### Database Storage
- **Conversations**: PostgreSQL with JSONB metadata
- **Messages**: PostgreSQL with full-text search capability
- **Indexes**: Optimized for conversation listing and message retrieval

## Security

- JWT authentication required for all endpoints
- File type validation (images and audio only)
- File size limits (10MB max)
- Rate limiting per IP address
- SQL injection protection via Sequelize ORM
- XSS protection via input validation
- CORS configuration for frontend domains

## Recommended Endpoints for ChatGPT-Style UI

### **Primary Endpoints (Use These)**
- `GET /threads` - Thread list for sidebar
- `GET /threads/{threadId}/messages` - Full thread conversation
- `POST /message` - Send messages (with/without threadId)
- `POST /stream` - Streaming responses
- `POST /upload` - File uploads

### **Legacy Endpoints (Optional)**
- `GET /conversations` - Individual conversations
- `GET /conversations/{id}/messages` - Single conversation messages

### **Thread Management**
- **New Thread**: Send message without `threadId`
- **Continue Thread**: Send message with existing `threadId`
- **Thread Persistence**: All messages in same thread maintain context
- **AI Context**: AI service maintains conversation context per `threadId`

**🎯 This API design perfectly supports ChatGPT-style conversation management!** 