const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * A chunk of a SourceDocument plus its embedding for retrieval.
 *
 * NOTE: the `embedding vector(1536)` column is intentionally NOT declared as a
 * Sequelize attribute — pgvector has no native Sequelize type. Embeddings are
 * read/written via raw parameterised SQL in the embedding/retrieval service.
 * This model covers the textual + provenance fields used for chunking and
 * citation display.
 */
const DocumentChunk = sequelize.define('DocumentChunk', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  documentId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'document_id'
  },
  chunkIndex: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'chunk_index'
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  tokenCount: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'token_count'
  },
  pageFrom: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'page_from'
  },
  pageTo: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'page_to'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true
  }
}, {
  tableName: 'document_chunks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  paranoid: false,
  underscored: true,
  indexes: [
    { unique: true, fields: ['document_id', 'chunk_index'] }
  ]
});

module.exports = DocumentChunk;
