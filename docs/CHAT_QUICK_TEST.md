# Chat API Quick Test Guide

## Prerequisites
1. Server running on `http://localhost:3000`
2. Valid JWT token from login
3. Database migrations applied

## New ChatGPT-Style Endpoints

### 1. Get Threads (Like ChatGPT Thread List)
```bash
curl -X GET "http://localhost:3000/api/v1/chat/threads" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "threads": [
      {
        "threadId": "thread_user_timestamp_random",
        "title": "How many times do I have to eat the eba",
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

### 2. Get Thread Messages (Click on Thread)
```bash
curl -X GET "http://localhost:3000/api/v1/chat/threads/THREAD_ID/messages" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "threadId": "thread_user_timestamp_random",
    "messages": [
      {
        "id": "uuid",
        "messageType": "user",
        "content": "How many times do I have to eat the eba",
        "createdAt": "2025-08-13T05:00:00.000Z"
      },
      {
        "id": "uuid", 
        "messageType": "assistant",
        "content": "Based on your pregnancy stage...",
        "createdAt": "2025-08-13T05:00:15.000Z"
      }
    ],
    "pagination": {
      "total": 6,
      "page": 1,
      "limit": 50,
      "hasNext": false
    }
  }
}
```

### 3. Continue Thread Conversation
```bash
curl -X POST "http://localhost:3000/api/v1/chat/message" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "EXISTING_THREAD_ID",
    "message": "Can you give me more details about this?"
  }'
```

## How It Works (Like ChatGPT)

### **Frontend Flow:**
1. **Thread List**: Call `GET /threads` → Shows list like ChatGPT sidebar
2. **Click Thread**: Call `GET /threads/{threadId}/messages` → Shows full conversation
3. **Continue Chat**: Send `POST /message` with existing `threadId` → Continues same thread
4. **New Chat**: Send `POST /message` without `threadId` → Creates new thread

### **Thread Behavior:**
- ✅ **New message without threadId** → Creates new thread (new chat)
- ✅ **New message with threadId** → Continues existing thread
- ✅ **Threads group all related messages** → Like ChatGPT conversations
- ✅ **Thread list shows preview** → Title + last message + date

## Test Commands

### 1. Get Threads (Empty State)
```bash
curl -X GET "http://localhost:3000/api/v1/chat/threads" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 2. Send First Message (Creates New Thread)
```bash
curl -X POST "http://localhost:3000/api/v1/chat/message" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What should I eat in my first trimester?"
  }'
```

### 3. Get Threads (After First Message)
```bash
curl -X GET "http://localhost:3000/api/v1/chat/threads" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 4. Continue Same Thread
```bash
# Use threadId from step 2 response
curl -X POST "http://localhost:3000/api/v1/chat/message" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "threadId": "thread_user_timestamp_random",
    "message": "What about foods to avoid?"
  }'
```

### 5. Get Thread Messages
```bash
curl -X GET "http://localhost:3000/api/v1/chat/threads/THREAD_ID/messages" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 6. Start New Thread
```bash
curl -X POST "http://localhost:3000/api/v1/chat/message" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "How much exercise should I do?"
  }'
```

## Frontend Integration

### Thread List Component
```javascript
const getThreads = async () => {
  const response = await fetch('/api/v1/chat/threads', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

### Thread Messages Component  
```javascript
const getThreadMessages = async (threadId) => {
  const response = await fetch(`/api/v1/chat/threads/${threadId}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

### Continue Thread
```javascript
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

### Start New Thread
```javascript
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

## Expected UI Behavior

### **Thread List (Like ChatGPT Sidebar)**
```
Chat History                    [New chat]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🟣 What should I eat in my first...
   Based on your pregnancy stage, here...
   8/13/2025

🟠 How much exercise should I do?
   Gentle exercise during pregnancy...
   8/13/2025

🔴 Can you explain my scan results?
   Looking at your ultrasound image...
   8/12/2025
```

### **Thread View (Click on Thread)**
```
← Back    What should I eat in my first...

User: What should I eat in my first trimester?

AI: Based on your pregnancy stage, here are some 
    nutritional recommendations...

User: What about foods to avoid?

AI: Here are foods to avoid during pregnancy...

[Type your message...]                    [Send]
```

## Old vs New Endpoints

### **Old Way (Individual Conversations)**
- `GET /conversations` → Lists each conversation separately
- `GET /conversations/{id}/messages` → Messages for one conversation

### **New Way (ChatGPT Style)**  
- `GET /threads` → Lists unique threads (grouped conversations)
- `GET /threads/{threadId}/messages` → All messages in thread
- Continue with same `threadId` → Stays in same thread

**Use the new thread endpoints for ChatGPT-like experience!** 🎉 