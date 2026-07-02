const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ContentSource = sequelize.define('ContentSource', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.ENUM('WHO', 'NHS', 'MedlinePlus', 'ACOG', 'FMOH', 'YouTube', 'Original'),
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('api', 'manual_curation', 'original'),
    allowNull: false
  },
  apiEndpoint: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'api_endpoint'
  },
  apiKeyRef: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'api_key_ref',
    comment: 'Reference to secret manager entry - never stored in plaintext'
  },
  syncFrequency: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'manual'),
    allowNull: false,
    defaultValue: 'manual',
    field: 'sync_frequency'
  },
  lastSyncedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_synced_at'
  },
  licenseType: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'license_type'
  },
  attributionRequired: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'attribution_required'
  },
  active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'content_sources',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    { fields: ['name'] },
    { fields: ['active'] }
  ]
});

module.exports = ContentSource;
