const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Append-only audit history of ContentItem.body versions (CMS spec §8).
 * No updatedAt / deletedAt: records are written once and never modified.
 */
const ContentItemVersion = sequelize.define('ContentItemVersion', {
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
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  reviewerId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'reviewer_id'
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'approved_at'
  }
}, {
  tableName: 'content_item_versions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  paranoid: false,
  underscored: true,
  indexes: [
    { fields: ['content_item_id', 'version'] }
  ]
});

module.exports = ContentItemVersion;
