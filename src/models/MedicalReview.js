const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MedicalReview = sequelize.define('MedicalReview', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  contentItemId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'content_item_id'
  },
  reviewerId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'reviewer_id',
    comment: "Reviewer's internal ID or professional email address"
  },
  reviewerCredentials: {
    type: DataTypes.STRING(200),
    allowNull: false,
    field: 'reviewer_credentials'
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'needs_revision', 'rejected'),
    allowNull: false,
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approved_at'
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  }
}, {
  tableName: 'medical_reviews',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    { fields: ['content_item_id'] },
    { fields: ['status'] }
  ]
});

module.exports = MedicalReview;
