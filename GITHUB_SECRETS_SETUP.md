# 🔑 GitHub Secrets Setup for Imagomum Backend

## 📋 **Required GitHub Secrets**

Go to: `https://github.com/Ahamisi/imagomum-backend/settings/secrets/actions`

### **1. AZURE_REGISTRY_USERNAME**
```
imagomumregistry
```

### **2. AZURE_REGISTRY_PASSWORD**
```
tJ3p1/7dwsWXKuB3Cv+KeHvGi2A5LKGIic9dotIqHS+ACRB56n+Q
```

### **3. DATABASE_URL** (PostgreSQL)
```
postgresql://imagodb:ImagoMum2024!@imago-db-server.postgres.database.azure.com:5432/imagomum?sslmode=require
```
**✅ Azure Database for PostgreSQL is already created and working!**

### **4. JWT_SECRET**
```
kGCdHo+SfgEkKYaYHf6sxghDDBerfdR3JjAWC7hgOiw=
```

### **5. AZURE_STORAGE_CONNECTION_STRING**
```
DefaultEndpointsProtocol=https;AccountName=ultrasoundimageupload;AccountKey=jPFkRlFEctbO5R8647WyyNte8KjGPtqtlPiZMjn9S+fNMQ8sBqQ/5q/0/O7EXTjswCvjdb65s+SU+AStZmjTJg==;EndpointSuffix=core.windows.net
```

### **6. AI_SERVICE_BASE_URL**
```
https://imagomum-app.agreeablebeach-10200fd5.eastus2.azurecontainerapps.io
```

### **7. AZURE_CREDENTIALS** (Service Principal)
**You need to create this by running in Azure Cloud Shell:**
```bash
az ad sp create-for-rbac --name "imagomum-deploy" --role contributor --scopes /subscriptions/YOUR_SUBSCRIPTION_ID/resourceGroups/Imago-mum --sdk-auth
```

## 🚀 **Next Steps:**

1. **Create GitHub Repository**: Go to https://github.com/new
   - Repository name: `imagomum-backend`
   - Description: `Imagomum Backend - Ultrasound Interpretation & Care Coordination API`
   - Make it Public
   - Don't initialize with README (we already have code)

2. **Add all the secrets above** to GitHub Actions secrets

3. **Get your Azure Subscription ID**:
   ```bash
   az account show --query id -o tsv
   ```

4. **Create Service Principal** with the subscription ID from step 3

5. **Push code to GitHub** and watch the magic happen! 🎉

## 🎯 **✅ LIVE Deployment URL:**
Your backend is now live at:
```
https://imagomum-backend.agreeablebeach-10200fd5.eastus2.azurecontainerapps.io/api/v1/
```

**Health Check**: https://imagomum-backend.agreeablebeach-10200fd5.eastus2.azurecontainerapps.io/health
**API Docs**: https://imagomum-backend.agreeablebeach-10200fd5.eastus2.azurecontainerapps.io/api-docs/
