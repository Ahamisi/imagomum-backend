const axios = require('axios');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Embedding step of the RAG pipeline: turn unembedded document_chunks into
 * pgvector embeddings via Azure OpenAI text-embedding-3-large @ 1536 dims.
 *
 * The `embedding vector(1536)` column is not a Sequelize attribute (pgvector has
 * no native type), so reads/writes go through raw parameterised SQL. A vector is
 * written as its JSON array text cast to ::vector, e.g. '[0.1,0.2,...]'::vector.
 */

const ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '');
const KEY = process.env.AZURE_OPENAI_KEY1;
const DEPLOYMENT = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding-3-large';
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';

const EMBEDDING_DIM = 1536;
const BATCH_SIZE = parseInt(process.env.AZURE_OPENAI_EMBEDDING_BATCH, 10) || 16;
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Embed an array of texts -> array of 1536-dim vectors (order preserved).
 * Retries on 429 / 5xx with exponential backoff, honouring Retry-After.
 */
async function embedTexts(texts) {
  if (!ENDPOINT || !KEY) {
    throw new Error('Embeddings: AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_KEY1 not set');
  }
  const url = `${ENDPOINT}/openai/deployments/${DEPLOYMENT}/embeddings?api-version=${API_VERSION}`;

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const { data } = await axios.post(
        url,
        { input: texts, dimensions: EMBEDDING_DIM },
        { headers: { 'api-key': KEY, 'Content-Type': 'application/json' }, timeout: 60000 }
      );
      // Azure returns objects with an `index` — sort to guarantee input order.
      return data.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    } catch (err) {
      const status = err.response?.status;
      const retriable = status === 429 || (status >= 500 && status < 600);
      if (!retriable || attempt >= MAX_RETRIES) {
        const body = err.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : err.message;
        throw new Error(`Embeddings: request failed (HTTP ${status || '?'}): ${body}`);
      }
      const retryAfter = parseInt(err.response?.headers?.['retry-after'], 10);
      const waitMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : Math.min(2 ** attempt * 1000, 30000);
      attempt += 1;
      logger.warn('Embeddings: retrying after backoff', { attempt, status, waitMs });
      await sleep(waitMs);
    }
  }
}

/** pgvector text literal for a numeric vector: [1,2,3] -> '[1,2,3]'. */
function toVectorLiteral(vec) {
  return `[${vec.join(',')}]`;
}

/**
 * Embed all chunks that still have a NULL embedding.
 * @param {object} [opts]
 * @param {string} [opts.documentId] - restrict to one source document
 * @param {number} [opts.batchSize]
 * @returns {Promise<{embedded:number, batches:number, documentsCompleted:string[]}>}
 */
async function embedPendingChunks(opts = {}) {
  const batchSize = opts.batchSize || BATCH_SIZE;

  const where = opts.documentId ? 'WHERE embedding IS NULL AND document_id = :docId' : 'WHERE embedding IS NULL';
  const pending = await sequelize.query(
    `SELECT id, document_id, content FROM document_chunks ${where} ORDER BY document_id, chunk_index`,
    { type: QueryTypes.SELECT, replacements: opts.documentId ? { docId: opts.documentId } : {} }
  );

  if (pending.length === 0) {
    logger.info('Embeddings: nothing pending');
    return { embedded: 0, batches: 0, documentsCompleted: [] };
  }
  logger.info('Embeddings: starting', { pending: pending.length, batchSize });

  let embedded = 0;
  let batches = 0;
  const touchedDocs = new Set();

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const vectors = await embedTexts(batch.map((c) => c.content));

    if (vectors.length !== batch.length) {
      throw new Error(`Embeddings: expected ${batch.length} vectors, got ${vectors.length}`);
    }

    // Write the batch in a single transaction.
    await sequelize.transaction(async (tx) => {
      for (let j = 0; j < batch.length; j++) {
        await sequelize.query(
          'UPDATE document_chunks SET embedding = :vec::vector WHERE id = :id',
          { replacements: { vec: toVectorLiteral(vectors[j]), id: batch[j].id }, type: QueryTypes.UPDATE, transaction: tx, logging: false }
        );
      }
    });

    batch.forEach((c) => touchedDocs.add(c.document_id));
    embedded += batch.length;
    batches += 1;
    logger.info('Embeddings: batch done', { batch: batches, embedded, remaining: pending.length - embedded });
  }

  // Flip any fully-embedded documents to status='embedded'.
  const documentsCompleted = [];
  for (const docId of touchedDocs) {
    const [{ remaining }] = await sequelize.query(
      'SELECT count(*)::int AS remaining FROM document_chunks WHERE document_id = :docId AND embedding IS NULL',
      { type: QueryTypes.SELECT, replacements: { docId } }
    );
    if (remaining === 0) {
      await sequelize.query(
        "UPDATE source_documents SET status = 'embedded' WHERE id = :docId AND status = 'chunked'",
        { replacements: { docId }, type: QueryTypes.UPDATE }
      );
      documentsCompleted.push(docId);
    }
  }

  logger.info('Embeddings: complete', { embedded, batches, documentsCompleted: documentsCompleted.length });
  return { embedded, batches, documentsCompleted };
}

module.exports = { embedTexts, embedPendingChunks, toVectorLiteral, EMBEDDING_DIM };
