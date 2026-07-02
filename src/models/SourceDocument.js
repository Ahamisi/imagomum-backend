const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/** An ingested source document (e.g. a WHO/FMOH PDF) for the RAG knowledge base. */
const SourceDocument = sequelize.define('SourceDocument', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sourceId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'source_id'
  },
  title: {
    type: DataTypes.STRING(300),
    allowNull: false
  },
  filePath: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'file_path'
  },
  docUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'doc_url'
  },
  licenseType: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'license_type'
  },
  checksum: {
    type: DataTypes.STRING(64),
    allowNull: true,
    comment: 'sha256 of file bytes for dedup/versioning'
  },
  pageCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'page_count'
  },
  status: {
    type: DataTypes.ENUM('pending', 'chunked', 'embedded', 'failed'),
    allowNull: false,
    defaultValue: 'pending'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  ingestedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'ingested_at'
  }
}, {
  tableName: 'source_documents',
  timestamps: true,
  paranoid: true,
  underscored: true,
  indexes: [
    { fields: ['source_id'] },
    { fields: ['checksum'] },
    { fields: ['status'] }
  ]
});

module.exports = SourceDocument;
