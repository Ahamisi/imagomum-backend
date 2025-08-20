const { validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const UltrasoundScan = require('../models/UltrasoundScan');
const User = require('../models/User');
const aiService = require('../services/aiService');
const azureStorageService = require('../services/azureStorageService');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'ultrasounds');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with UUID
    const uniqueId = crypto.randomUUID();
    const extension = path.extname(file.originalname);
    const filename = `${uniqueId}${extension}`;
    cb(null, filename);
  }
});

// File filter for ultrasound images
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/bmp',
    'image/tiff',
    'image/dicom',
    'application/dicom'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError(`Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`));
  }
};

// Configure multer
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 1 // Only one file at a time
  }
});

const ultrasoundController = {
  // Multer middleware for single file upload
  uploadMiddleware: upload.single('ultrasoundImage'),

  async uploadScan(req, res) {
    console.log('🔍 ===== FRONTEND REQUEST DEBUG =====');
    console.log('📤 Method:', req.method);
    console.log('📤 URL:', req.url);
    console.log('📤 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('📤 Content-Type:', req.headers['content-type']);
    console.log('📤 Authorization:', req.headers['authorization'] ? 'Present' : 'MISSING');
    console.log('📤 Body Keys:', Object.keys(req.body));
    console.log('📤 Body:', JSON.stringify(req.body, null, 2));
    console.log('📤 File:', req.file ? 'File present' : 'No file');
    console.log('📤 Files:', req.files ? 'Files present' : 'No files');
    console.log('📤 Raw body type:', typeof req.body);
    console.log('📤 Raw body length:', JSON.stringify(req.body).length);
    console.log('📤 User from auth middleware:', req.user ? req.user.id : 'No user (not authenticated)');
    console.log('🔍 ===== END DEBUG =====');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('❌ Validation errors:', errors.array());
      throw new ValidationError('Invalid input data');
    }

    const userId = req.user.id;
    
    try {
      // Check if file was uploaded
      if (!req.file) {
        console.log('❌ No file in request');
        throw new ValidationError('No ultrasound image file provided');
      }

      const {
        scanType,
        gestationalAge,
        scanDate,
        notes
      } = req.body;

      // Verify user exists
      const user = await User.findByPk(userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Calculate file hash for record keeping (but don't restrict duplicates)
      const fileBuffer = await fs.readFile(req.file.path);
      const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');

      // Create scan record in database
      const scanData = {
        userId,
        originalFileName: req.file.originalname,
        fileName: req.file.filename,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        fileHash,
        scanType: scanType || null,
        gestationalAge: gestationalAge || null,
        scanDate: scanDate || null,
        notes: notes || null,
        aiAnalysisStatus: 'pending'
      };

      const ultrasoundScan = await UltrasoundScan.create(scanData);

      // Upload to Azure Storage if configured
      let cloudUrl = null;
      let blobName = null;
      
      if (azureStorageService.isConfigured()) {
        console.log('☁️ Uploading to Azure Storage...');
        const uploadResult = await azureStorageService.uploadFile(
          req.file.path,
          req.file.originalname,
          userId
        );
        
        if (uploadResult.success) {
          cloudUrl = uploadResult.url;
          blobName = uploadResult.blobName;
          console.log('☁️ Azure upload successful!');
          console.log('🔗 PUBLIC URL:', cloudUrl);
          console.log('📁 Blob Name:', blobName);
          
          // Update scan record with cloud URL
          await ultrasoundScan.update({
            cloudUrl: cloudUrl,
            cloudBlobName: blobName
          });
        } else {
          console.log('❌ Azure upload failed:', uploadResult.error);
          logger.warn('Azure Storage upload failed, using local file', {
            error: uploadResult.error,
            scanId: ultrasoundScan.id
          });
        }
      }

      // Log successful upload
      logger.logSystemEvent('ULTRASOUND_SCAN_UPLOADED', {
        userId,
        scanId: ultrasoundScan.id,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        scanType,
        cloudUrl: cloudUrl
      });

      // Start AI analysis asynchronously
      setImmediate(() => {
        const imageUrl = cloudUrl || req.file.path; // Use cloud URL if available
        console.log('🚀 SENDING TO AI SERVICE:');
        console.log('📤 Image URL:', imageUrl);
        console.log('👤 User ID:', userId);
        console.log('🔄 Is Cloud URL?', !!cloudUrl);
        
        ultrasoundController.processAIAnalysis(ultrasoundScan.id, imageUrl, {
          userId,
          gestationalAge,
          scanType,
          scanDate
        });
      });

      res.status(201).json({
        status: 'success',
        message: 'Ultrasound scan uploaded successfully. AI analysis is processing.',
        data: {
          scan: {
            id: ultrasoundScan.id,
            originalFileName: ultrasoundScan.originalFileName,
            scanType: ultrasoundScan.scanType,
            gestationalAge: ultrasoundScan.gestationalAge,
            scanDate: ultrasoundScan.scanDate,
            notes: ultrasoundScan.notes,
            aiAnalysisStatus: ultrasoundScan.aiAnalysisStatus,
            createdAt: ultrasoundScan.createdAt
          }
        }
      });

    } catch (error) {
      // Clean up uploaded file if there was an error
      if (req.file?.path) {
        try {
          await fs.unlink(req.file.path);
        } catch (unlinkError) {
          logger.error('Failed to clean up uploaded file:', unlinkError);
        }
      }
      
      logger.error('Upload scan error:', error);
      throw error;
    }
  },

  async processAIAnalysis(scanId, filePath, metadata) {
    try {
      logger.info('Starting AI analysis for scan', { scanId });

      // Update scan status to processing
      await UltrasoundScan.update(
        {
          aiAnalysisStatus: 'processing',
          aiProcessingStartedAt: new Date()
        },
        { where: { id: scanId } }
      );

      // Call AI service
      const aiResult = await aiService.analyzeUltrasound(filePath, metadata);

      // Update scan with AI results
      const updateData = {
        aiAnalysisStatus: 'completed',
        aiAnalysisResult: aiResult.rawResponse,
        aiConfidenceScore: aiResult.confidenceScore,
        aiFindings: aiResult.findings,
        aiRecommendations: aiResult.recommendations,
        aiProcessingTime: aiResult.processingTime,
        aiModelVersion: aiResult.analysisId || 'unknown', // Use analysis_id as model version
        aiProcessingCompletedAt: new Date()
      };

      await UltrasoundScan.update(updateData, { where: { id: scanId } });

      logger.logSystemEvent('AI_ANALYSIS_COMPLETED', {
        scanId,
        processingTime: aiResult.processingTime,
        confidenceScore: aiResult.confidenceScore,
        riskLevel: aiResult.riskLevel
      });

    } catch (error) {
      logger.error('AI analysis failed for scan', { scanId, error: error.message });

      // Update scan with error status
      await UltrasoundScan.update(
        {
          aiAnalysisStatus: 'failed',
          aiErrorMessage: error.message,
          aiProcessingCompletedAt: new Date()
        },
        { where: { id: scanId } }
      );

      logger.logSystemEvent('AI_ANALYSIS_FAILED', {
        scanId,
        error: error.message,
        isRetryable: error.isRetryable || false
      });
    }
  },

  async getUserScans(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 10, status, scanType } = req.query;

      const offset = (page - 1) * limit;
      
      // Build query conditions
      const whereConditions = { userId };
      
      if (status) {
        whereConditions.aiAnalysisStatus = status;
      }
      
      if (scanType) {
        whereConditions.scanType = scanType;
      }

      // Get scans with pagination
      const { rows: scans, count: totalCount } = await UltrasoundScan.findAndCountAll({
        where: whereConditions,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const scanSummaries = scans.map(scan => scan.getScanSummary());

      res.status(200).json({
        status: 'success',
        data: {
          scans: scanSummaries,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(totalCount / limit),
            totalCount,
            hasNextPage: page * limit < totalCount,
            hasPrevPage: page > 1
          }
        }
      });

    } catch (error) {
      logger.error('Get user scans error:', error);
      throw error;
    }
  },

  async getScanDetails(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { scanId } = req.params;
      const userId = req.user.id;

      const scan = await UltrasoundScan.findOne({
        where: {
          id: scanId,
          userId
        }
      });

      if (!scan) {
        throw new NotFoundError('Ultrasound scan not found');
      }

      // Increment view count
      await scan.incrementViewCount();

      // Get detailed scan information
      const scanDetails = {
        id: scan.id,
        originalFileName: scan.originalFileName,
        scanType: scan.scanType,
        gestationalAge: scan.gestationalAge,
        scanDate: scan.scanDate,
        notes: scan.notes,
        fileSize: scan.fileSize,
        mimeType: scan.mimeType,
        createdAt: scan.createdAt,
        updatedAt: scan.updatedAt,
        viewCount: scan.viewCount,
        
        // File URLs for debugging
        fileUrls: {
          localPath: scan.filePath,
          cloudUrl: scan.cloudUrl,
          sentToAI: scan.cloudUrl || scan.filePath // What was actually sent to AI
        },
        
        // AI Analysis results
        aiAnalysis: scan.getAIAnalysis(),
        
        // Medical review status
        medicalReview: {
          status: scan.medicalReviewStatus,
          reviewedBy: scan.reviewedBy,
          reviewedAt: scan.reviewedAt,
          notes: scan.reviewNotes
        }
      };

      res.status(200).json({
        status: 'success',
        data: {
          scan: scanDetails
        }
      });

    } catch (error) {
      logger.error('Get scan details error:', error);
      throw error;
    }
  },

  async downloadScan(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { scanId } = req.params;
      const userId = req.user.id;

      const scan = await UltrasoundScan.findOne({
        where: {
          id: scanId,
          userId
        }
      });

      if (!scan) {
        throw new NotFoundError('Ultrasound scan not found');
      }

      // Check if file exists
      try {
        await fs.access(scan.filePath);
      } catch {
        throw new NotFoundError('Scan file not found on server');
      }

      // Set appropriate headers
      res.setHeader('Content-Type', scan.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${scan.originalFileName}"`);
      res.setHeader('Content-Length', scan.fileSize);

      // Stream the file
      const fileStream = require('fs').createReadStream(scan.filePath);
      fileStream.pipe(res);

      // Log download
      logger.logSystemEvent('ULTRASOUND_SCAN_DOWNLOADED', {
        userId,
        scanId: scan.id,
        fileName: scan.originalFileName
      });

    } catch (error) {
      logger.error('Download scan error:', error);
      throw error;
    }
  },

  async deleteScan(req, res) {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { scanId } = req.params;
      const userId = req.user.id;

      const scan = await UltrasoundScan.findOne({
        where: {
          id: scanId,
          userId
        }
      });

      if (!scan) {
        throw new NotFoundError('Ultrasound scan not found');
      }

      // Archive the scan (soft delete)
      await scan.update({ isArchived: true });

      // Optional: Delete physical file after archiving
      // Uncomment if you want to immediately delete files
      // try {
      //   await fs.unlink(scan.filePath);
      // } catch (unlinkError) {
      //   logger.warn('Failed to delete physical file:', unlinkError);
      // }

      logger.logSystemEvent('ULTRASOUND_SCAN_DELETED', {
        userId,
        scanId: scan.id,
        fileName: scan.originalFileName
      });

      res.status(200).json({
        status: 'success',
        message: 'Ultrasound scan archived successfully'
      });

    } catch (error) {
      logger.error('Delete scan error:', error);
      throw error;
    }
  },

  async getAIServiceHealth(req, res) {
    try {
      const healthStatus = await aiService.healthCheck();
      
      res.status(200).json({
        status: 'success',
        data: {
          aiService: healthStatus
        }
      });

    } catch (error) {
      logger.error('AI service health check error:', error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to check AI service health',
        error: error.message
      });
    }
  }
};

module.exports = ultrasoundController; 