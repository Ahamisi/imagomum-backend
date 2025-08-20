# 🔧 Azure Blob Storage Setup Guide

## 📋 Overview
This guide will help you set up Azure Blob Storage for storing ultrasound images and providing public URLs to the AI service.

## 🚀 Step 1: Create Azure Storage Account

### Via Azure Portal:
1. **Login to Azure Portal**: https://portal.azure.com
2. **Create Storage Account**:
   - Click "Create a resource"
   - Search for "Storage account"
   - Click "Create"

3. **Configure Storage Account**:
   ```
   Subscription: Your Azure subscription
   Resource Group: Create new or use existing
   Storage Account Name: imagomumstorageXXXX (must be globally unique)
   Region: East US 2 (same as your AI service)
   Performance: Standard
   Redundancy: LRS (Locally Redundant Storage)
   ```

4. **Review and Create**: Click "Review + create" then "Create"

### Via Azure CLI:
```bash
# Login to Azure
az login

# Create resource group (if needed)
az group create --name imagomum-rg --location eastus2

# Create storage account
az storage account create \
  --name imagomumstorageXXXX \
  --resource-group imagomum-rg \
  --location eastus2 \
  --sku Standard_LRS \
  --kind StorageV2
```

## 🔑 Step 2: Get Connection String

### Via Azure Portal:
1. **Navigate to Storage Account**
2. **Go to "Access keys"** (under Security + networking)
3. **Copy Connection String** from Key1 or Key2

### Via Azure CLI:
```bash
az storage account show-connection-string \
  --name imagomumstorageXXXX \
  --resource-group imagomum-rg
```

**Example Connection String:**
```
DefaultEndpointsProtocol=https;AccountName=imagomumstorageXXXX;AccountKey=abcd1234...;EndpointSuffix=core.windows.net
```

## ⚙️ Step 3: Configure Environment Variables

Add these to your `.env` file:

```bash
# Azure Storage Configuration
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=imagomumstorageXXXX;AccountKey=your_account_key_here;EndpointSuffix=core.windows.net
AZURE_STORAGE_CONTAINER_NAME=ultrasound-images
```

## 🧪 Step 4: Test the Setup

### 1. Start Your Server:
```bash
npm run dev
```

**Look for these logs:**
```
☁️ Azure Storage initialized successfully
Azure Storage container created successfully
```

### 2. Upload a Test File:
```bash
curl -X POST http://localhost:3000/api/v1/ultrasounds/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "ultrasound_image=@test.jpg" \
  -F "scanType=2D"
```

**Expected logs:**
```
☁️ Uploading to Azure Storage...
☁️ Azure upload successful: https://imagomumstorageXXXX.blob.core.windows.net/ultrasound-images/...
🚀 Making AI request to: https://imagomum-app.agreeablebeach-10200fd5.eastus2.azurecontainerapps.io/api/ultrasound/analyze
📤 Request payload: {
  "user_id": "user-id",
  "image_path": "https://imagomumstorageXXXX.blob.core.windows.net/ultrasound-images/..."
}
```

## 🔒 Step 5: Security Configuration

### Container Access Level:
The container is configured with **"blob"** access level, which means:
- ✅ **Individual files are publicly readable** (needed for AI service)
- ❌ **Container listing is private** (can't browse all files)
- ✅ **Upload/delete requires authentication** (secure)

### File Organization:
Files are organized by user ID:
```
ultrasound-images/
├── user-id-1/
│   ├── 1691234567890-abc123def.jpg
│   └── 1691234567891-def456ghi.jpg
└── user-id-2/
    └── 1691234567892-ghi789jkl.jpg
```

## 📊 Step 6: Monitor Usage

### Via Azure Portal:
1. **Go to Storage Account**
2. **Click "Metrics"** to see:
   - Storage usage
   - Request count
   - Bandwidth usage

### Via Azure CLI:
```bash
# Check storage usage
az storage account show-usage \
  --name imagomumstorageXXXX \
  --resource-group imagomum-rg
```

## 💰 Cost Estimation

**Azure Blob Storage Pricing (East US 2):**
- **Storage**: ~$0.018 per GB/month
- **Transactions**: ~$0.0004 per 10,000 operations
- **Bandwidth**: First 5GB free, then ~$0.087 per GB

**Example Monthly Cost:**
- 1,000 ultrasound images (~2MB each) = 2GB storage = ~$0.04
- 10,000 API calls = ~$0.004
- **Total: ~$0.05/month** for moderate usage

## 🛠️ Troubleshooting

### Issue: "Azure Storage connection string not provided"
**Solution:** Check your `.env` file has the correct connection string

### Issue: "Failed to initialize Azure Storage container"
**Solution:** 
1. Verify connection string is correct
2. Check Azure account permissions
3. Ensure storage account exists

### Issue: "Azure upload failed"
**Solution:**
1. Check storage account access keys
2. Verify container permissions
3. Check network connectivity

### Issue: AI service still says "Image file not found"
**Solution:**
1. Verify the blob URL is publicly accessible
2. Check if AI service can access Azure Blob Storage
3. Contact AI team to confirm they can access the URLs

## 🔧 Advanced Configuration

### Custom Container Name:
```bash
AZURE_STORAGE_CONTAINER_NAME=my-custom-container
```

### Multiple Environments:
```bash
# Development
AZURE_STORAGE_CONTAINER_NAME=ultrasound-images-dev

# Production
AZURE_STORAGE_CONTAINER_NAME=ultrasound-images-prod
```

### CORS Configuration (if needed):
```bash
az storage cors add \
  --services b \
  --methods GET POST PUT \
  --origins "*" \
  --allowed-headers "*" \
  --account-name imagomumstorageXXXX
```

## ✅ Success Checklist

- [ ] Azure Storage Account created
- [ ] Connection string obtained
- [ ] Environment variables configured
- [ ] Container initialized successfully
- [ ] Test file upload works
- [ ] Public URLs are accessible
- [ ] AI service receives correct URLs
- [ ] Logs show successful Azure uploads

## 🎯 Next Steps

Once Azure Storage is working:
1. **Test with real ultrasound images**
2. **Verify AI service can process the images**
3. **Monitor storage usage and costs**
4. **Set up backup/retention policies**

---

**Need help?** Contact the backend team for Azure Storage configuration assistance. 