'use strict';

/**
 * Full-text GIN index on document_chunks.content for the keyword arm of hybrid
 * retrieval (pgvector cosine + tsvector). Expression index — no extra column,
 * so it matches the on-the-fly to_tsvector('english', content) used at query time.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS "document_chunks_content_fts"
       ON "document_chunks" USING gin (to_tsvector('english', "content"));`
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "document_chunks_content_fts";');
  }
};
