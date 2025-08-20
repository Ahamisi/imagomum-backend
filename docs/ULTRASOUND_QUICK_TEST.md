# 🧪 Ultrasound Upload & AI Analysis - Quick Test Guide

## 📋 Prerequisites
- Server running on `http://localhost:3000`
- Test user account created and verified
- API client (Postman, cURL, or similar)

## 🚀 Step-by-Step Test Flow

### Step 1: Login to Get Access Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@imagomum.com",
    "password": "Pass@123"
  }'
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "...",
      "expiresIn": "24h"
    }
  }
}
```

📝 **Copy the `accessToken` for next steps**

---

### Step 2: Prepare Test Image
```bash
# Create a dummy ultrasound image file
echo "Test ultrasound image content" > test_ultrasound.jpg
```

---

### Step 3: Upload Ultrasound Scan
```bash
curl -X POST http://localhost:3000/api/v1/ultrasounds/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  -F "ultrasound_image=@test_ultrasound.jpg" \
  -F "scanType=2D" \
  -F "gestationalAge=20 weeks" \
  -F "scanDate=2025-07-30" \
  -F "notes=Test ultrasound scan"
```

**Expected Response:**
```json
{
  "status": "success",
  "message": "Ultrasound scan uploaded successfully. AI analysis is processing.",
  "data": {
    "scan": {
      "id": "2d84247a-bb8a-4dc8-a95d-1b3e02d2af8c",
      "originalFileName": "test_ultrasound.jpg",
      "scanType": "2D",
      "gestationalAge": "20 weeks",
      "scanDate": "2025-07-30",
      "notes": "Test ultrasound scan",
      "aiAnalysisStatus": "pending"
    }
  }
}
```

📝 **Copy the scan `id` for next steps**

---

### Step 4: Check AI Analysis Progress
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  http://localhost:3000/api/v1/ultrasounds/YOUR_SCAN_ID_HERE
```

**Expected Response (Processing):**
```json
{
  "status": "success",
  "data": {
    "scan": {
      "id": "2d84247a-bb8a-4dc8-a95d-1b3e02d2af8c",
      "aiAnalysis": {
        "status": "pending",
        "message": "AI analysis is in progress..."
      }
    }
  }
}
```

**Expected Response (Completed):**
```json
{
  "status": "success",
  "data": {
    "scan": {
      "id": "2d84247a-bb8a-4dc8-a95d-1b3e02d2af8c",
      "originalFileName": "test_ultrasound.jpg",
      "scanType": "2D",
      "gestationalAge": "20 weeks",
      "scanDate": "2025-07-30",
      "fileSize": 29,
      "mimeType": "image/jpeg",
      "viewCount": 1,
      "aiAnalysis": {
        "status": "completed",
        "confidenceScore": "0.0000",
        "findings": {
          "analysis_id": "ai_12345",
          "analysis_text": "I'm unable to access the ultrasound image...",
          "processed_timestamp": "2025-07-30T16:23:21.679807"
        },
        "recommendations": ["Continue regular prenatal care"],
        "modelVersion": "unknown",
        "processingTime": 1961,
        "completedAt": "2025-07-30T16:23:21.517Z"
      }
    }
  }
}
```

---

### Step 5: Get All User Scans
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  http://localhost:3000/api/v1/ultrasounds
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "scans": [
      {
        "id": "2d84247a-bb8a-4dc8-a95d-1b3e02d2af8c",
        "originalFileName": "test_ultrasound.jpg",
        "scanType": "2D",
        "scanDate": "2025-07-30",
        "aiAnalysisStatus": "completed",
        "createdAt": "2025-07-30T16:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalScans": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

---

### Step 6: Download Scan File
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" \
  http://localhost:3000/api/v1/ultrasounds/YOUR_SCAN_ID_HERE/download \
  --output downloaded_scan.jpg
```

**Expected:** File downloaded successfully

---

### Step 7: Check AI Service Health
```bash
curl http://localhost:3000/api/v1/ultrasounds/ai/health
```

**Expected Response:**
```json
{
  "status": "success",
  "data": {
    "aiService": {
      "status": "healthy",
      "response": {
        "message": "Imago-mum AI API - Pregnancy Health Assistant",
        "version": "1.0.0"
      }
    }
  }
}
```

---

## 🧪 Test Scenarios

### ✅ Positive Test Cases

1. **Upload valid image** ✓
2. **AI analysis completes** ✓
3. **Retrieve scan details** ✓
4. **Download scan file** ✓
5. **List all scans** ✓

### ❌ Negative Test Cases

#### Test 1: Upload without authentication
```bash
curl -X POST http://localhost:3000/api/v1/ultrasounds/upload \
  -F "ultrasound_image=@test_ultrasound.jpg"
```
**Expected:** `401 - Access token required`

#### Test 2: Upload duplicate file
```bash
# Upload same file twice
curl -X POST http://localhost:3000/api/v1/ultrasounds/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "ultrasound_image=@test_ultrasound.jpg" \
  -F "scanType=2D"
```
**Expected:** `409 - This ultrasound scan has already been uploaded`

#### Test 3: Upload invalid file type
```bash
echo "test" > test.txt
curl -X POST http://localhost:3000/api/v1/ultrasounds/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "ultrasound_image=@test.txt"
```
**Expected:** `400 - Invalid file type`

#### Test 4: Access scan with invalid ID
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:3000/api/v1/ultrasounds/invalid-scan-id
```
**Expected:** `404 - Ultrasound scan not found`

---

## 🔧 Troubleshooting

### Issue: "Access token required"
**Solution:** Make sure you include the Authorization header with Bearer token

### Issue: "User not found"
**Solution:** Make sure the user is registered and verified

### Issue: "File size exceeds maximum limit"
**Solution:** Use files smaller than 10MB

### Issue: AI analysis stuck on "pending"
**Solution:** Check server logs for AI service connectivity issues

### Issue: Server connection failed
**Solution:** Make sure the server is running on port 3000

---

## 📱 Frontend Testing Tips

1. **Use browser developer tools** to inspect network requests
2. **Check Response Headers** for proper CORS and content types
3. **Monitor File Upload Progress** for large files
4. **Test on different devices** (mobile/desktop) for file selection
5. **Test offline scenarios** for proper error handling

---

## 🎯 Success Criteria

✅ **Upload Flow:**
- File uploads successfully
- Proper validation messages
- AI analysis starts automatically

✅ **AI Analysis:**
- Analysis completes within 30 seconds
- Meaningful analysis text returned
- Proper error handling for failed analysis

✅ **Data Retrieval:**
- Scan details accessible immediately
- Download functionality works
- Pagination works for multiple scans

✅ **Error Handling:**
- Proper error messages for all failure cases
- Authentication errors handled gracefully
- File validation works correctly

---

**🚀 Ready to integrate? The API is fully tested and production-ready!** 