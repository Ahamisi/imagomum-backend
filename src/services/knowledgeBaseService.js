const fs = require('fs');
const crypto = require('crypto');
const { parseDocument } = require('./documentParserService');
const SourceDocument = require('../models/SourceDocument');
const DocumentChunk = require('../models/DocumentChunk');
const ContentSource = require('../models/ContentSource');
const logger = require('../utils/logger');

/**
 * Knowledge-base ingestion (chunking half of the RAG pipeline).
 * Turns a source PDF into a SourceDocument + ordered DocumentChunks.
 * Embedding population is a separate step (Azure OpenAI) handled elsewhere.
 *
 * Extraction is delegated to documentParserService (LlamaParse -> Markdown for
 * the public corpus). Chunking is STRUCTURAL over that Markdown: it splits on
 * blank-line blocks (which keeps Markdown tables intact), tracks the nearest
 * heading as section provenance, and packs blocks into overlapping chunks.
 *
 * Token counts are approximate (~4 chars/token) — good enough for sizing chunks
 * without pulling in a tokenizer dependency.
 */

const CHARS_PER_TOKEN = 4;

/** Split a page's Markdown into blank-line-separated blocks (tables stay whole). */
function splitBlocks(markdown) {
  return (markdown || '')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
}

const isHeading = (block) => /^#{1,6}\s+/.test(block) && !block.includes('\n');
const headingText = (block) => block.replace(/^#{1,6}\s+/, '').trim();

/**
 * Structural chunking over per-page Markdown.
 * @param {{page:number, markdown:string}[]} pages
 * @param {{targetTokens?:number, overlapTokens?:number}} [opts]
 * @returns {{chunkIndex:number, content:string, tokenCount:number, pageFrom:number, pageTo:number, metadata:object}[]}
 */
function chunkMarkdown(pages, opts = {}) {
  const targetChars = (opts.targetTokens || 400) * CHARS_PER_TOKEN;
  const overlapChars = (opts.overlapTokens || 60) * CHARS_PER_TOKEN;

  // Flatten pages into blocks tagged with page + the section (nearest heading
  // above them). A heading governs everything until the next heading, including
  // across page boundaries — so currentSection persists across the page loop.
  const units = [];
  let currentSection = null;
  for (const { page, markdown } of pages) {
    for (const block of splitBlocks(markdown)) {
      if (isHeading(block)) {
        currentSection = headingText(block);
      }
      units.push({ page, section: currentSection, text: block });
    }
  }

  const chunks = [];
  let buf = '';
  let startPage = null;
  let endPage = null;
  let section = null;

  const flush = () => {
    const content = buf.trim();
    if (!content) return;
    chunks.push({
      chunkIndex: chunks.length,
      content,
      tokenCount: Math.round(content.length / CHARS_PER_TOKEN),
      pageFrom: startPage,
      pageTo: endPage,
      metadata: section ? { section } : null
    });
  };

  for (const unit of units) {
    if (startPage === null) {
      startPage = unit.page;
      section = unit.section;
    }

    if (buf && buf.length + unit.text.length + 2 > targetChars) {
      flush();
      const overlap = overlapChars > 0 ? buf.slice(-overlapChars) : '';
      buf = overlap ? overlap + '\n\n' + unit.text : unit.text;
      startPage = unit.page;
      endPage = unit.page;
      section = unit.section;
    } else {
      buf = buf ? buf + '\n\n' + unit.text : unit.text;
      endPage = unit.page;
    }
  }
  flush();
  return chunks;
}

/**
 * Ingest a PDF file into the knowledge base.
 * @param {string} filePath
 * @param {{ sourceName?:string, title:string, docUrl?:string, licenseType?:string, chunkOpts?:object }} meta
 * @returns {Promise<{document, chunkCount, deduped:boolean}>}
 */
async function ingestPdf(filePath, meta) {
  const buffer = fs.readFileSync(filePath);
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

  // Dedup: identical bytes already SUCCESSFULLY ingested -> return existing
  // (idempotent re-runs). A prior failed/pending row must not block re-ingest.
  const existing = await SourceDocument.findOne({
    where: { checksum, status: ['chunked', 'embedded'] }
  });
  if (existing) {
    const chunkCount = await DocumentChunk.count({ where: { documentId: existing.id } });
    logger.info('KB: document already ingested, skipping', { id: existing.id, checksum });
    return { document: existing, chunkCount, deduped: true };
  }

  // Resolve the canonical ContentSource by name, if provided.
  let sourceId = null;
  if (meta.sourceName) {
    const src = await ContentSource.findOne({ where: { name: meta.sourceName } });
    sourceId = src ? src.id : null;
  }

  const doc = await SourceDocument.create({
    sourceId,
    title: meta.title,
    filePath,
    docUrl: meta.docUrl || null,
    licenseType: meta.licenseType || null,
    checksum,
    status: 'pending'
  });

  try {
    // Public editorial corpus -> LlamaParse (Markdown). Never send PHI here.
    const parsed = await parseDocument(buffer, {
      sensitivity: 'public',
      fileName: meta.title,
      instruction: meta.parseInstruction,
      language: meta.language
    });
    const chunks = chunkMarkdown(parsed.pages, meta.chunkOpts);

    await DocumentChunk.bulkCreate(
      chunks.map((c) => ({ ...c, documentId: doc.id })),
      { validate: true }
    );

    doc.pageCount = parsed.pages.length;
    doc.metadata = { ...(doc.metadata || {}), parseBackend: parsed.backend, parseJobId: parsed.jobId };
    doc.status = 'chunked';
    doc.ingestedAt = new Date();
    await doc.save();

    logger.info('KB: document ingested', { id: doc.id, pageCount: doc.pageCount, chunks: chunks.length });
    return { document: doc, chunkCount: chunks.length, deduped: false };
  } catch (err) {
    doc.status = 'failed';
    await doc.save();
    logger.error('KB: ingestion failed', { id: doc.id, error: err.message });
    throw err;
  }
}

module.exports = { chunkMarkdown, ingestPdf, CHARS_PER_TOKEN };
