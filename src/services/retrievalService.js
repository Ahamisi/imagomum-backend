const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { embedTexts, toVectorLiteral } = require('./embeddingService');

/**
 * Hybrid retrieval over the knowledge base: pgvector cosine (semantic) + tsvector
 * full-text (keyword), fused with Reciprocal Rank Fusion. RRF needs no score
 * normalisation across the two very different scales — it just blends ranks.
 *
 * Returns chunks with provenance (page range, section heading, source document)
 * ready to hand to grounded generation as numbered citations.
 */

const RRF_K = 60; // standard RRF damping constant

/**
 * @param {string} query
 * @param {object} [opts]
 * @param {number} [opts.topK=6]        - fused results to return
 * @param {number} [opts.candidates=20] - depth pulled from each arm before fusion
 * @param {string} [opts.documentId]    - restrict to one source document
 * @returns {Promise<Array<{rank:number,score:number,id:string,content:string,pageFrom:number,pageTo:number,section:string,documentTitle:string,docUrl:string,licenseType:string}>>}
 */
async function retrieve(query, opts = {}) {
  const topK = opts.topK || 6;
  const candidates = opts.candidates || 20;
  const docFilter = opts.documentId ? 'AND document_id = :docId' : '';
  const repl = { q: query, cand: candidates, ...(opts.documentId ? { docId: opts.documentId } : {}) };

  // Semantic arm — nearest neighbours by cosine distance (HNSW index).
  const [vec] = await embedTexts([query]);
  const vecRows = await sequelize.query(
    `SELECT id, ROW_NUMBER() OVER (ORDER BY embedding <=> :vec::vector) AS rank
       FROM document_chunks
      WHERE embedding IS NOT NULL ${docFilter}
      ORDER BY embedding <=> :vec::vector
      LIMIT :cand`,
    { type: QueryTypes.SELECT, replacements: { ...repl, vec: toVectorLiteral(vec) }, logging: false }
  );

  // Keyword arm — full-text rank (GIN index on to_tsvector('english', content)).
  const ftRows = await sequelize.query(
    `SELECT id, ROW_NUMBER() OVER (
              ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', :q)) DESC
            ) AS rank
       FROM document_chunks
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', :q) ${docFilter}
      ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', :q)) DESC
      LIMIT :cand`,
    { type: QueryTypes.SELECT, replacements: repl, logging: false }
  );

  // Reciprocal Rank Fusion: score = Σ 1 / (k + rank_in_arm).
  const scores = new Map();
  for (const r of [...vecRows, ...ftRows]) {
    scores.set(r.id, (scores.get(r.id) || 0) + 1 / (RRF_K + Number(r.rank)));
  }
  const topIds = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, topK).map(([id]) => id);
  if (topIds.length === 0) return [];

  // Hydrate content + provenance for the winners.
  const rows = await sequelize.query(
    `SELECT c.id, c.content, c.page_from AS "pageFrom", c.page_to AS "pageTo",
            c.metadata->>'section' AS section,
            d.title AS "documentTitle", d.doc_url AS "docUrl", d.license_type AS "licenseType"
       FROM document_chunks c
       JOIN source_documents d ON d.id = c.document_id
      WHERE c.id IN (:ids)`,
    { type: QueryTypes.SELECT, replacements: { ids: topIds }, logging: false }
  );

  const byId = new Map(rows.map((r) => [r.id, r]));
  return topIds.map((id, i) => ({ rank: i + 1, score: scores.get(id), ...byId.get(id) }));
}

module.exports = { retrieve, RRF_K };
