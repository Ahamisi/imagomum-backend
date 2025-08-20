const { BlobServiceClient } = require('@azure/storage-blob');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

class AzureStorageService {
  constructor() {
    // Azure Storage configuration
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'ultrasound-images';
    
    if (!this.connectionString) {
      logger.warn('Azure Storage connection string not provided. File uploads will be stored locally.');
      this.isEnabled = false;
      return;
    }

    try {
      console.log('🔧 Azure Storage Configuration:');
      console.log('📝 Connection String Length:', this.connectionString.length);
      console.log('📦 Container Name:', this.containerName);
      console.log('🔗 Connection String Preview:', this.connectionString.substring(0, 50) + '...');
      
      this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
      this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      this.isEnabled = true;
      
      console.log('✅ Azure Storage service initialized successfully!');
      logger.info('Azure Storage service initialized successfully', {
        containerName: this.containerName
      });
    } catch (error) {
      console.log('❌ Azure Storage initialization failed:', error.message);
      logger.error('Failed to initialize Azure Storage service', { error: error.message });
      this.isEnabled = false;
    }
  }

  /**
   * Initialize the container (create if it doesn't exist)
   */
  async initializeContainer() {
    if (!this.isEnabled) {
      return false;
    }

    try {
      // Create container if it doesn't exist
      const createContainerResponse = await this.containerClient.createIfNotExists({
        access: 'blob' // Allow public read access to blobs
      });

      if (createContainerResponse.succeeded) {
        logger.info('Azure Storage container created successfully', {
          containerName: this.containerName
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to initialize Azure Storage container', {
        error: error.message,
        containerName: this.containerName
      });
      return false;
    }
  }

  /**
   * Upload a file to Azure Blob Storage
   * @param {string} filePath - Local file path
   * @param {string} fileName - Original filename
   * @param {string} userId - User ID for organizing files
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  async uploadFile(filePath, fileName, userId) {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'Azure Storage is not configured'
      };
    }

    try {
      // Generate unique blob name
      const fileExtension = path.extname(fileName);
      const timestamp = Date.now();
      const randomId = crypto.randomBytes(8).toString('hex');
      const blobName = `${userId}/${timestamp}-${randomId}${fileExtension}`;

      // Get blob client
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);

      // Set content type based on file extension
      const contentType = this.getContentType(fileExtension);

      // Read file and upload as buffer (more reliable than uploadFile)
      const fs = require('fs');
      const fileBuffer = fs.readFileSync(filePath);
      
      console.log('📁 File details:');
      console.log('📁 File path:', filePath);
      console.log('📁 File size:', fileBuffer.length);
      console.log('📁 Blob name:', blobName);
      console.log('📁 Content type:', contentType);

      // Upload file buffer
      const uploadResponse = await blockBlobClient.uploadData(fileBuffer, {
        blobHTTPHeaders: {
          blobContentType: contentType
        },
        metadata: {
          userId: userId,
          originalFileName: fileName,
          uploadedAt: new Date().toISOString()
        }
      });

      console.log('📤 Upload response:', {
        requestId: uploadResponse.requestId,
        version: uploadResponse.version,
        date: uploadResponse.date
      });

      // Get the public URL
      const publicUrl = blockBlobClient.url;

      // Verify the file exists by checking its properties
      try {
        const properties = await blockBlobClient.getProperties();
        console.log('✅ File verification successful:', {
          contentLength: properties.contentLength,
          lastModified: properties.lastModified,
          contentType: properties.contentType
        });
      } catch (verifyError) {
        console.log('❌ File verification failed:', verifyError.message);
        throw new Error(`File upload verification failed: ${verifyError.message}`);
      }

      logger.info('File uploaded to Azure Storage successfully', {
        blobName,
        publicUrl,
        userId,
        originalFileName: fileName
      });

      return {
        success: true,
        url: publicUrl,
        blobName: blobName
      };

    } catch (error) {
      logger.error('Failed to upload file to Azure Storage', {
        error: error.message,
        filePath: filePath.replace(/\/[^\/]*$/, '/[filename]'),
        userId
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a file from Azure Blob Storage
   * @param {string} blobName - Blob name to delete
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async deleteFile(blobName) {
    if (!this.isEnabled) {
      return {
        success: false,
        error: 'Azure Storage is not configured'
      };
    }

    try {
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.deleteIfExists();

      logger.info('File deleted from Azure Storage successfully', { blobName });

      return { success: true };
    } catch (error) {
      logger.error('Failed to delete file from Azure Storage', {
        error: error.message,
        blobName
      });

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get content type based on file extension
   * @param {string} extension - File extension
   * @returns {string} Content type
   */
  getContentType(extension) {
    const contentTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.dcm': 'application/dicom',
      '.dicom': 'application/dicom'
    };

    return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
  }

  /**
   * Check if Azure Storage is enabled and configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.isEnabled;
  }

  /**
   * Get storage info for health checks
   * @returns {object}
   */
  getStorageInfo() {
    return {
      enabled: this.isEnabled,
      containerName: this.containerName,
      configured: !!this.connectionString
    };
  }
}

// Export singleton instance
module.exports = new AzureStorageService(); 