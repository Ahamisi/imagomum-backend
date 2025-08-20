const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UltrasoundScan = sequelize.define('UltrasoundScan', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // User relationship
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  },
  
  // File information
  originalFileName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Original filename uploaded by user'
  },
  
  fileName: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Stored filename (usually UUID-based)'
  },
  
  filePath: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Full path or URL where file is stored'
  },
  
  fileSize: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'File size in bytes'
  },
  
  mimeType: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'MIME type of uploaded file'
  },
  
  fileHash: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Hash of file content for duplicate detection'
  },
  
  // Cloud storage information
  cloudUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Public URL of file in cloud storage (Azure Blob Storage)'
  },
  
  cloudBlobName: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Blob name/path in cloud storage for management operations'
  },
  
  // Scan metadata
  scanType: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isIn: [['2D', '3D', '4D', 'Doppler', 'Other']]
    },
    comment: 'Type of ultrasound scan'
  },
  
  gestationalAge: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Gestational age at time of scan (from user input)'
  },
  
  scanDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    comment: 'Date when scan was performed'
  },
  
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'User notes about the scan'
  },
  
  // AI Analysis
  aiAnalysisStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'processing', 'completed', 'failed', 'error']]
    },
    comment: 'Status of AI analysis'
  },
  
  aiAnalysisResult: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Complete AI analysis response'
  },
  
  aiConfidenceScore: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: true,
    comment: 'AI confidence score (0-1)'
  },
  
  aiFindings: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Structured AI findings and measurements'
  },
  
  aiRecommendations: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'AI-generated recommendations'
  },
  
  aiProcessingTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Time taken for AI analysis in milliseconds'
  },
  
  aiModelVersion: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Version of AI model used for analysis'
  },
  
  aiErrorMessage: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error message if AI analysis failed'
  },
  
  // Analysis timestamps
  aiProcessingStartedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  aiProcessingCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  // Medical review (for future doctor review feature)
  medicalReviewStatus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'reviewed', 'requires_attention', 'normal']]
    }
  },
  
  reviewedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Doctor/medical professional who reviewed'
  },
  
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  reviewNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Medical professional review notes'
  },
  
  // Privacy and compliance
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  
  retentionPolicy: {
    type: DataTypes.STRING,
    defaultValue: 'standard',
    validate: {
      isIn: [['standard', 'extended', 'permanent']]
    }
  },
  
  // Analytics and usage
  viewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Number of times scan was viewed'
  },
  
  lastViewedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
  
}, {
  tableName: 'ultrasound_scans',
  timestamps: true,
  paranoid: true, // Soft deletes
  underscored: true,
  
  // Indexes for performance
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['ai_analysis_status']
    },
    {
      fields: ['medical_review_status']
    },
    {
      fields: ['scan_date']
    },
    {
      fields: ['created_at']
    },
    {
      fields: ['file_hash'],
      name: 'ultrasound_scans_file_hash_index'
    }
  ]
});

// Instance methods for Sequelize v6
UltrasoundScan.prototype.getScanSummary = function() {
  return {
    id: this.id,
    originalFileName: this.originalFileName,
    scanType: this.scanType,
    scanDate: this.scanDate,
    gestationalAge: this.gestationalAge,
    aiAnalysisStatus: this.aiAnalysisStatus,
    aiConfidenceScore: this.aiConfidenceScore,
    medicalReviewStatus: this.medicalReviewStatus,
    createdAt: this.createdAt,
    viewCount: this.viewCount
  };
};

UltrasoundScan.prototype.getAIAnalysis = function() {
  if (this.aiAnalysisStatus !== 'completed') {
    return {
      status: this.aiAnalysisStatus,
      error: this.aiErrorMessage || null
    };
  }
  
  return {
    status: this.aiAnalysisStatus,
    confidenceScore: this.aiConfidenceScore,
    findings: this.aiFindings,
    recommendations: this.aiRecommendations,
    modelVersion: this.aiModelVersion,
    processingTime: this.aiProcessingTime,
    completedAt: this.aiProcessingCompletedAt
  };
};

UltrasoundScan.prototype.getFileInfo = function() {
  return {
    originalFileName: this.originalFileName,
    fileName: this.fileName,
    filePath: this.filePath,
    fileSize: this.fileSize,
    mimeType: this.mimeType
  };
};

UltrasoundScan.prototype.incrementViewCount = async function() {
  await this.update({
    viewCount: this.viewCount + 1,
    lastViewedAt: new Date()
  });
};

module.exports = UltrasoundScan; 