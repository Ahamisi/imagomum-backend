'use strict';

/**
 * RAG knowledge-base tables (CMS spec §10 pgvector; curation strategy: WHO/FMOH
 * documents -> chunks -> embeddings -> grounded draft generation).
 *
 * Embedding dimension is 1536 — we use Azure OpenAI text-embedding-3-large with
 * dimensions=1536 (or text-embedding-3-small natively). 1536 stays within
 * pgvector's 2000-dim limit for hnsw/ivfflat indexes; the full 3072-dim large
 * model would not be indexable.
 *
 * @type {import('sequelize-cli').Migration}
 */
const EMBEDDING_DIM = 1536;

module.exports = {
  async up(queryInterface, Sequelize) {
    // One row per ingested source document (a WHO/FMOH PDF, etc.)
    await queryInterface.createTable('source_documents', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      source_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'content_sources', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Which canonical ContentSource this document belongs to (WHO, FMOH, ...)'
      },
      title: { type: Sequelize.STRING(300), allowNull: false },
      file_path: { type: Sequelize.TEXT, allowNull: true, comment: 'Local/CDN path to the stored file' },
      doc_url: { type: Sequelize.TEXT, allowNull: true, comment: 'Canonical public URL (e.g. IRIS link)' },
      license_type: { type: Sequelize.STRING(100), allowNull: true },
      checksum: { type: Sequelize.STRING(64), allowNull: true, comment: 'sha256 of file bytes for dedup/versioning' },
      page_count: { type: Sequelize.INTEGER, allowNull: true },
      status: {
        type: Sequelize.ENUM('pending', 'chunked', 'embedded', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      ingested_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      deleted_at: { type: Sequelize.DATE, allowNull: true }
    });
    await queryInterface.addIndex('source_documents', ['source_id']);
    await queryInterface.addIndex('source_documents', ['checksum']);
    await queryInterface.addIndex('source_documents', ['status']);

    // Chunks of a document, each with a (later-populated) embedding vector.
    await queryInterface.createTable('document_chunks', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      document_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'source_documents', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      chunk_index: { type: Sequelize.INTEGER, allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      token_count: { type: Sequelize.INTEGER, allowNull: true, comment: 'Approximate token count' },
      page_from: { type: Sequelize.INTEGER, allowNull: true },
      page_to: { type: Sequelize.INTEGER, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') }
      // `embedding vector(1536)` is added below via raw SQL — Sequelize has no native vector type.
    });
    await queryInterface.addIndex('document_chunks', ['document_id', 'chunk_index'], { unique: true });

    // pgvector column + ANN index (cosine). Index works on an empty table.
    await queryInterface.sequelize.query(
      `ALTER TABLE "document_chunks" ADD COLUMN "embedding" vector(${EMBEDDING_DIM});`
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX "document_chunks_embedding_hnsw" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);`
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('document_chunks');
    await queryInterface.dropTable('source_documents');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_source_documents_status";');
  }
};
