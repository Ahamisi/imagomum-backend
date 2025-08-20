# Frontend Integration Guide - Ultrasound Upload

## 🚀 **Quick Summary**
The frontend needs to send a **multipart/form-data** request with:
- **Authentication**: `Authorization: Bearer <accessToken>`
- **File**: The ultrasound image file
- **Metadata**: JSON fields for scan information

---

## 📱 **React Native Integration**

### **1. Required Dependencies**
```bash
npm install react-native-image-picker react-native-document-picker
# OR
npm install expo-image-picker expo-document-picker
```

### **2. Upload Function**
```javascript
const uploadUltrasound = async (imageUri, scanData) => {
  try {
    // Get access token from your auth storage
    const accessToken = await AsyncStorage.getItem('accessToken');
    
    // Create FormData
    const formData = new FormData();
    
    // Add the image file
    formData.append('ultrasoundImage', {
      uri: imageUri,
      type: 'image/jpeg', // or 'image/png'
      name: 'ultrasound.jpg'
    });
    
    // Add metadata fields
    formData.append('scanType', scanData.scanType || '2D');
    formData.append('gestationalAge', scanData.gestationalAge || '');
    formData.append('scanDate', scanData.scanDate || new Date().toISOString().split('T')[0]);
    formData.append('notes', scanData.notes || '');
    
    // Make the request
    const response = await fetch('https://your-api-domain.com/api/v1/ultrasounds/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Upload successful:', result);
      return result;
    } else {
      console.error('❌ Upload failed:', result);
      throw new Error(result.message || 'Upload failed');
    }
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    throw error;
  }
};
```

### **3. Usage Example**
```javascript
// Example usage in a component
const handleUpload = async () => {
  try {
    setLoading(true);
    
    // Pick image (using react-native-image-picker)
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });
    
    if (result.assets && result.assets[0]) {
      const imageUri = result.assets[0].uri;
      
      // Upload with metadata
      const uploadResult = await uploadUltrasound(imageUri, {
        scanType: '2D',
        gestationalAge: '20 weeks',
        scanDate: '2025-08-13',
        notes: 'Regular checkup scan'
      });
      
      // Handle success
      Alert.alert('Success', 'Ultrasound uploaded successfully!');
      
      // Navigate to results or update UI
      navigation.navigate('ScanResults', { scanId: uploadResult.data.scan.id });
    }
    
  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
};
```

---

## 🌐 **Web/React Integration**

### **1. Upload Function**
```javascript
const uploadUltrasound = async (file, scanData) => {
  try {
    // Get access token from your auth storage
    const accessToken = localStorage.getItem('accessToken');
    
    // Create FormData
    const formData = new FormData();
    
    // Add the image file
    formData.append('ultrasoundImage', file);
    
    // Add metadata fields
    formData.append('scanType', scanData.scanType || '2D');
    formData.append('gestationalAge', scanData.gestationalAge || '');
    formData.append('scanDate', scanData.scanDate || new Date().toISOString().split('T')[0]);
    formData.append('notes', scanData.notes || '');
    
    // Make the request
    const response = await fetch('https://your-api-domain.com/api/v1/ultrasounds/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        // DON'T set Content-Type - let browser set it with boundary
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      return result;
    } else {
      throw new Error(result.message || 'Upload failed');
    }
    
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};
```

### **2. React Component Example**
```jsx
import React, { useState } from 'react';

const UltrasoundUpload = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanData, setScanData] = useState({
    scanType: '2D',
    gestationalAge: '',
    scanDate: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file');
      return;
    }

    try {
      setLoading(true);
      
      const result = await uploadUltrasound(file, scanData);
      
      alert('Upload successful!');
      console.log('Upload result:', result);
      
      // Reset form
      setFile(null);
      setScanData({
        scanType: '2D',
        gestationalAge: '',
        scanDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
      
    } catch (error) {
      alert(`Upload failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Upload Ultrasound Scan</h2>
      
      <div>
        <label>Select Image:</label>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileChange}
        />
      </div>
      
      <div>
        <label>Scan Type:</label>
        <select 
          value={scanData.scanType} 
          onChange={(e) => setScanData({...scanData, scanType: e.target.value})}
        >
          <option value="2D">2D</option>
          <option value="3D">3D</option>
          <option value="4D">4D</option>
          <option value="Doppler">Doppler</option>
        </select>
      </div>
      
      <div>
        <label>Gestational Age:</label>
        <input 
          type="text" 
          placeholder="e.g., 20 weeks"
          value={scanData.gestationalAge}
          onChange={(e) => setScanData({...scanData, gestationalAge: e.target.value})}
        />
      </div>
      
      <div>
        <label>Scan Date:</label>
        <input 
          type="date" 
          value={scanData.scanDate}
          onChange={(e) => setScanData({...scanData, scanDate: e.target.value})}
        />
      </div>
      
      <div>
        <label>Notes (Optional):</label>
        <textarea 
          placeholder="Any additional notes..."
          value={scanData.notes}
          onChange={(e) => setScanData({...scanData, notes: e.target.value})}
        />
      </div>
      
      <button onClick={handleUpload} disabled={loading || !file}>
        {loading ? 'Uploading...' : 'Upload Scan'}
      </button>
    </div>
  );
};

export default UltrasoundUpload;
```

---

## 🔧 **Common Issues & Solutions**

### **Issue 1: "Unexpected token 'n', null is not valid JSON"**
**Cause**: Frontend is sending invalid JSON or missing authentication.

**Solution**:
- ✅ Always include `Authorization: Bearer <token>` header
- ✅ Use `multipart/form-data` (FormData), not JSON
- ✅ Don't manually set `Content-Type` header when using FormData

### **Issue 2: "No ultrasound image file provided"**
**Cause**: File not properly attached to FormData.

**Solution**:
```javascript
// ✅ Correct way
formData.append('ultrasoundImage', file); // Web
formData.append('ultrasoundImage', {     // React Native
  uri: imageUri,
  type: 'image/jpeg',
  name: 'ultrasound.jpg'
});

// ❌ Wrong way
formData.append('file', file); // Wrong field name
```

### **Issue 3: Authentication Errors**
**Cause**: Missing or invalid access token.

**Solution**:
- ✅ Check token is not expired
- ✅ Use correct header format: `Authorization: Bearer <token>`
- ✅ Handle token refresh if needed

---

## 📋 **API Response Format**

### **Success Response (201)**
```json
{
  "status": "success",
  "message": "Ultrasound scan uploaded successfully. AI analysis is processing.",
  "data": {
    "scan": {
      "id": "uuid-here",
      "fileName": "ultrasound.jpg",
      "fileSize": 1234567,
      "scanType": "2D",
      "gestationalAge": "20 weeks",
      "scanDate": "2025-08-13",
      "aiAnalysisStatus": "processing",
      "createdAt": "2025-08-13T10:30:00.000Z"
    }
  }
}
```

### **Error Response (400/401/500)**
```json
{
  "status": "error",
  "message": "Validation failed",
  "errors": [
    {
      "field": "ultrasoundImage",
      "message": "No ultrasound image file provided"
    }
  ]
}
```

---

## 🔄 **Getting Analysis Results**

After upload, use the scan ID to check analysis status:

```javascript
const checkAnalysisStatus = async (scanId) => {
  const response = await fetch(`/api/v1/ultrasounds/${scanId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  });
  
  const result = await response.json();
  
  if (result.data.scan.aiAnalysisStatus === 'completed') {
    console.log('Analysis complete:', result.data.scan.aiAnalysisResult);
  } else if (result.data.scan.aiAnalysisStatus === 'processing') {
    console.log('Still processing...');
    // Poll again in a few seconds
  } else if (result.data.scan.aiAnalysisStatus === 'failed') {
    console.log('Analysis failed:', result.data.scan.aiErrorMessage);
  }
};
```

---

## 🧪 **Testing with cURL**

```bash
# Test upload (replace with your token and file)
curl -X POST http://localhost:3000/api/v1/ultrasounds/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "ultrasoundImage=@/path/to/ultrasound.jpg" \
  -F "scanType=2D" \
  -F "gestationalAge=20 weeks" \
  -F "scanDate=2025-08-13"
```

---

## 📞 **Need Help?**

If you're still having issues:
1. Check the server logs for detailed error messages
2. Verify your authentication token is valid
3. Ensure you're sending `multipart/form-data` correctly
4. Test with cURL first to isolate frontend vs backend issues 