# Ultrasound Upload & AI Analysis API Documentation

## 🎯 Overview
This API allows users to upload ultrasound scans, get AI-powered analysis, and retrieve scan results. The system integrates with an external AI service to provide medical insights.

## 🔑 Prerequisites
- User must be **authenticated** (have valid JWT token)
- User must be **verified** (completed email/phone verification)

## 📋 Complete Integration Flow

### Step 1: User Authentication
```bash
# Login to get JWT token
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "Pass@123"
}

# Response
{
  "status": "success",
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": "24h"
    }
  }
}
```

### Step 2: Upload Ultrasound Scan
```bash
POST /api/v1/ultrasounds/upload
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data

# Form Data Fields:
- ultrasound_image: (file) - The ultrasound image file
- scanType: (string) - "2D", "3D", "4D", or "Doppler"
- gestationalAge: (string, optional) - e.g., "20 weeks"
- scanDate: (string, optional) - YYYY-MM-DD format
- notes: (string, optional) - Additional notes
```

**Example Request:**
```javascript
const formData = new FormData();
formData.append('ultrasound_image', fileInput.files[0]);
formData.append('scanType', '2D');
formData.append('gestationalAge', '20 weeks');
formData.append('scanDate', '2025-07-30');
formData.append('notes', 'First trimester scan');

fetch('/api/v1/ultrasounds/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`
  },
  body: formData
});
```

**Success Response:**
```json
{
  "status": "success",
  "message": "Ultrasound scan uploaded successfully. AI analysis is processing.",
  "data": {
    "scan": {
      "id": "2d84247a-bb8a-4dc8-a95d-1b3e02d2af8c",
      "originalFileName": "ultrasound_scan.jpg",
      "scanType": "2D",
      "gestationalAge": "20 weeks",
      "scanDate": "2025-07-30",
      "notes": "First trimester scan",
      "aiAnalysisStatus": "pending"
    }
  }
}
```

### Step 3: Check AI Analysis Status
The AI analysis happens asynchronously. You can check the status:

```bash
GET /api/v1/ultrasounds/{scanId}
Authorization: Bearer {accessToken}
```

**Response (Analysis Pending):**
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

**Response (Analysis Complete):**
```json
{
  "status": "success",
  "data": {
    "scan": {
      "id": "2d84247a-bb8a-4dc8-a95d-1b3e02d2af8c",
      "originalFileName": "ultrasound_scan.jpg",
      "scanType": "2D",
      "gestationalAge": "20 weeks",
      "scanDate": "2025-07-30",
      "fileSize": 2048576,
      "mimeType": "image/jpeg",
      "viewCount": 1,
      "aiAnalysis": {
        "status": "completed",
        "confidenceScore": "0.8500",
        "findings": {
          "analysis_id": "ai_12345",
          "analysis_text": "The ultrasound shows normal fetal development...",
          "processed_timestamp": "2025-07-30T16:23:21.679807"
        },
        "recommendations": [
          "Continue regular prenatal care",
          "Schedule next appointment in 4 weeks"
        ],
        "modelVersion": "v2.1.0",
        "processingTime": 1961,
        "completedAt": "2025-07-30T16:23:21.517Z"
      }
    }
  }
}
```

### Step 4: Get User's All Scans
```bash
GET /api/v1/ultrasounds
Authorization: Bearer {accessToken}

# Optional Query Parameters:
- page: (number) - Page number (default: 1)
- limit: (number) - Items per page (default: 10)
- scanType: (string) - Filter by scan type
- startDate: (string) - Filter scans after this date
- endDate: (string) - Filter scans before this date
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "scans": [
      {
        "id": "scan1",
        "originalFileName": "scan1.jpg",
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

## 🚨 Error Handling

### Upload Errors
```json
// File too large (>10MB)
{
  "status": "fail",
  "error": {
    "statusCode": 413,
    "message": "File size exceeds maximum limit of 10MB"
  }
}

// Invalid file type
{
  "status": "fail",
  "error": {
    "statusCode": 400,
    "message": "Invalid file type. Only JPEG, PNG, and DICOM files are allowed"
  }
}

// Duplicate scan
{
  "status": "fail",
  "error": {
    "statusCode": 409,
    "message": "This ultrasound scan has already been uploaded"
  }
}
```

### Authentication Errors
```json
// Missing token
{
  "status": "fail",
  "error": {
    "statusCode": 401,
    "message": "Access token required"
  }
}

// Invalid token
{
  "status": "fail",
  "error": {
    "statusCode": 401,
    "message": "Invalid or expired token"
  }
}
```

## 🔧 Additional Endpoints

### Download Scan File
```bash
GET /api/v1/ultrasounds/{scanId}/download
Authorization: Bearer {accessToken}

# Response: Binary file data with appropriate headers
Content-Type: image/jpeg
Content-Disposition: attachment; filename="ultrasound_scan.jpg"
```

### Delete Scan (Soft Delete)
```bash
DELETE /api/v1/ultrasounds/{scanId}
Authorization: Bearer {accessToken}

# Response
{
  "status": "success",
  "message": "Ultrasound scan archived successfully"
}
```

### AI Service Health Check
```bash
GET /api/v1/ultrasounds/ai/health
# No authentication required

# Response
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

## 📱 Frontend Implementation Examples

### React Native Example
```javascript
import { launchImageLibrary } from 'react-native-image-picker';

// Select and upload image
const uploadUltrasound = async () => {
  try {
    // 1. Pick image
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8
    });
    
    if (result.assets && result.assets[0]) {
      const asset = result.assets[0];
      
      // 2. Prepare form data
      const formData = new FormData();
      formData.append('ultrasound_image', {
        uri: asset.uri,
        type: asset.type,
        name: asset.fileName || 'ultrasound.jpg'
      });
      formData.append('scanType', '2D');
      formData.append('gestationalAge', '20 weeks');
      formData.append('scanDate', '2025-07-30');
      
      // 3. Upload
      const response = await fetch(`${API_BASE_URL}/api/v1/ultrasounds/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data'
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        const scanId = data.data.scan.id;
        // 4. Poll for AI analysis
        pollForAnalysis(scanId);
      }
    }
  } catch (error) {
    console.error('Upload failed:', error);
  }
};

// Poll for AI analysis completion
const pollForAnalysis = async (scanId) => {
  const maxAttempts = 30; // 5 minutes max
  let attempts = 0;
  
  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/ultrasounds/${scanId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const data = await response.json();
      const analysisStatus = data.data.scan.aiAnalysis.status;
      
      if (analysisStatus === 'completed') {
        // Analysis complete - show results
        const analysisText = data.data.scan.aiAnalysis.findings.analysis_text;
        showAnalysisResult(analysisText);
      } else if (analysisStatus === 'failed') {
        // Analysis failed
        showError('AI analysis failed. Please try again.');
      } else if (attempts < maxAttempts) {
        // Still processing - check again in 10 seconds
        attempts++;
        setTimeout(checkStatus, 10000);
      } else {
        // Timeout
        showError('Analysis is taking longer than expected. Please check back later.');
      }
    } catch (error) {
      console.error('Status check failed:', error);
    }
  };
  
  checkStatus();
};
```

### Web/React Example
```javascript
const UltrasoundUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('ultrasound_image', file);
      formData.append('scanType', '2D');
      formData.append('gestationalAge', '20 weeks');
      formData.append('scanDate', new Date().toISOString().split('T')[0]);
      
      const response = await fetch('/api/v1/ultrasounds/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (data.status === 'success') {
        // Start polling for analysis
        pollForAnalysis(data.data.scan.id);
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
    }
  };
  
  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        disabled={uploading}
      />
      {uploading && <p>Analyzing ultrasound...</p>}
      {analysisResult && (
        <div>
          <h3>AI Analysis Result:</h3>
          <p>{analysisResult}</p>
        </div>
      )}
    </div>
  );
};
```

## 🎯 Key Integration Points

1. **File Validation**: Check file size (<10MB) and type (JPEG/PNG/DICOM) before upload
2. **Progress Indicators**: Show upload progress and AI analysis status
3. **Error Handling**: Handle network errors, file errors, and authentication errors
4. **Polling Strategy**: Poll every 10-15 seconds for AI analysis completion
5. **Caching**: Cache scan results to avoid unnecessary API calls
6. **Offline Support**: Queue uploads when offline, sync when online

## 🔒 Security Notes

- All endpoints require valid JWT authentication
- File uploads are validated on server side
- Duplicate detection prevents data waste
- Files are stored securely with proper access controls

## 📊 Rate Limits

- Upload: 10 scans per hour per user
- Analysis polling: 1 request per 10 seconds
- Download: 50 downloads per hour per user

---

**Need help?** Contact the backend team for additional API support or custom requirements. 