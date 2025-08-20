'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ultrasound_scans', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      
      // User relationship
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      
      // File information
      original_file_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Original filename uploaded by user'
      },
      
      file_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Stored filename (usually UUID-based)'
      },
      
      file_path: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Full path or URL where file is stored'
      },
      
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'File size in bytes'
      },
      
      mime_type: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'MIME type of uploaded file'
      },
      
      file_hash: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Hash of file content for duplicate detection'
      },
      
      // Scan metadata
      scan_type: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Type of ultrasound scan'
      },
      
      gestational_age: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Gestational age at time of scan (from user input)'
      },
      
      scan_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'Date when scan was performed'
      },
      
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'User notes about the scan'
      },
      
      // AI Analysis
      ai_analysis_status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Status of AI analysis'
      },
      
      ai_analysis_result: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Complete AI analysis response'
      },
      
      ai_confidence_score: {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        comment: 'AI confidence score (0-1)'
      },
      
      ai_findings: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'Structured AI findings and measurements'
      },
      
      ai_recommendations: {
        type: Sequelize.JSONB,
        allowNull: true,
        comment: 'AI-generated recommendations'
      },
      
      ai_processing_time: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Time taken for AI analysis in milliseconds'
      },
      
      ai_model_version: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Version of AI model used for analysis'
      },
      
      ai_error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message if AI analysis failed'
      },
      
      // Analysis timestamps
      ai_processing_started_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      ai_processing_completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      // Medical review (for future doctor review feature)
      medical_review_status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending'
      },
      
      reviewed_by: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'Doctor/medical professional who reviewed'
      },
      
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      review_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Medical professional review notes'
      },
      
      // Privacy and compliance
      is_archived: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      
      retention_policy: {
        type: Sequelize.STRING,
        defaultValue: 'standard'
      },
      
      // Analytics and usage
      view_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Number of times scan was viewed'
      },
      
      last_viewed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      // Standard timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('ultrasound_scans', ['user_id'], {
      name: 'ultrasound_scans_user_id_index'
    });
    
    await queryInterface.addIndex('ultrasound_scans', ['ai_analysis_status'], {
      name: 'ultrasound_scans_ai_analysis_status_index'
    });
    
    await queryInterface.addIndex('ultrasound_scans', ['medical_review_status'], {
      name: 'ultrasound_scans_medical_review_status_index'
    });
    
    await queryInterface.addIndex('ultrasound_scans', ['scan_date'], {
      name: 'ultrasound_scans_scan_date_index'
    });
    
    await queryInterface.addIndex('ultrasound_scans', ['created_at'], {
      name: 'ultrasound_scans_created_at_index'
    });
    
    await queryInterface.addIndex('ultrasound_scans', ['file_hash'], {
      name: 'ultrasound_scans_file_hash_index'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('ultrasound_scans');
  }
};
