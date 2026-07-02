const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Document parsing adapter — PDF (and other docs) -> clean Markdown + per-page
 * provenance, behind a single `parseDocument()` interface.
 *
 * The backend is chosen by DATA SENSITIVITY, not by preference, because the two
 * data classes are bound by different rules:
 *
 *   - 'public'  -> public, non-PHI editorial corpus (WHO / FMOH / NHS guidelines).
 *                  No compliance constraint, quality matters most (feeds RAG
 *                  grounding) -> LlamaParse Cloud (best-in-class Markdown).
 *
 *   - 'phi'     -> user-uploaded / patient documents (scans, lab reports, notes).
 *                  MUST stay in-tenant (HIPAA / GDPR / NDPA) -> Azure Document
 *                  Intelligence (BAA-covered). LlamaParse SaaS is NOT a legal
 *                  option here regardless of quality.
 *
 * INVARIANT: the LlamaParse path must only ever receive 'public' documents.
 * Anything PHI-bearing routes to the in-tenant backend.
 *
 * All backends return the same shape:
 *   { markdown, pages: [{ page, markdown }], backend, jobId, metadata }
 */

const LLAMA_BASE_URL = process.env.LLAMA_CLOUD_BASE_URL || 'https://api.cloud.llamaindex.ai';
const LLAMA_API_KEY = process.env.LLAMA_CLOUD_API_KEY;
// Parse quality tier: fast | cost_effective | agentic | agentic_plus. The public
// corpus feeds RAG grounding, so default to 'agentic' (best layout/table fidelity).
const LLAMA_TIER = process.env.LLAMA_CLOUD_TIER || 'agentic';
const LLAMA_VERSION = process.env.LLAMA_CLOUD_VERSION || 'latest';
const LLAMA_POLL_INTERVAL_MS = parseInt(process.env.LLAMA_CLOUD_POLL_INTERVAL_MS, 10) || 3000;
const LLAMA_POLL_TIMEOUT_MS = parseInt(process.env.LLAMA_CLOUD_POLL_TIMEOUT_MS, 10) || 5 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parse a document into Markdown.
 * @param {Buffer|string} input - file buffer or absolute path
 * @param {object} [opts]
 * @param {'public'|'phi'} [opts.sensitivity='public'] - routes to the backend
 * @param {string} [opts.fileName] - original name (for the upload + logging)
 * @param {string} [opts.instruction] - optional parsing instruction (LlamaParse)
 * @param {string} [opts.language] - document language hint
 * @returns {Promise<{markdown:string, pages:{page:number,markdown:string}[], backend:string, jobId:string|null, metadata:object}>}
 */
async function parseDocument(input, opts = {}) {
  const sensitivity = opts.sensitivity || 'public';
  const buffer = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
  const fileName = opts.fileName || (typeof input === 'string' ? input.split('/').pop() : 'document.pdf');

  switch (sensitivity) {
    case 'public':
      return parseWithLlamaParse(buffer, { ...opts, fileName });
    case 'phi':
      return parseWithAzureDocIntelligence(buffer, { ...opts, fileName });
    default:
      throw new Error(`parseDocument: unknown sensitivity "${sensitivity}" (expected 'public' or 'phi')`);
  }
}

/**
 * LlamaParse Cloud backend (public corpus only) — v2 API.
 * Three-step flow per https://developers.llamaindex.ai/llamaparse/parse/ :
 *   1) POST /api/v1/files/          (multipart) -> { id: file_id }
 *   2) POST /api/v2/parse           ({ file_id, tier, version }) -> { id: job_id, status }
 *   3) GET  /api/v2/parse/{job_id}  poll status, then ?expand=markdown for per-page md
 */
async function parseWithLlamaParse(buffer, opts = {}) {
  if (!LLAMA_API_KEY) {
    throw new Error('LlamaParse: LLAMA_CLOUD_API_KEY is not set — cannot parse public documents');
  }

  const authHeader = { Authorization: `Bearer ${LLAMA_API_KEY}`, Accept: 'application/json' };

  // 1) Upload the file -> file_id
  const fileId = await uploadFileToLlamaCloud(buffer, opts.fileName, authHeader);

  // 2) Start the parse job
  const body = { file_id: fileId, tier: opts.tier || LLAMA_TIER, version: LLAMA_VERSION };
  if (opts.instruction) body.agentic_options = { custom_prompt: opts.instruction };
  if (opts.maxPages) body.page_ranges = { max_pages: opts.maxPages };

  let jobId;
  try {
    const { data } = await axios.post(`${LLAMA_BASE_URL}/api/v2/parse`, body, {
      headers: { ...authHeader, 'Content-Type': 'application/json' }
    });
    jobId = data.id || data.job?.id;
  } catch (err) {
    throw wrapAxios('LlamaParse: starting parse job failed', err);
  }
  if (!jobId) throw new Error('LlamaParse: parse job response had no job id');
  logger.info('LlamaParse: parse job started', { jobId, fileName: opts.fileName, tier: body.tier });

  // 3) Poll until terminal status (status may be top-level or nested under `job`)
  const jobUrl = `${LLAMA_BASE_URL}/api/v2/parse/${jobId}`;
  const deadline = Date.now() + LLAMA_POLL_TIMEOUT_MS;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (Date.now() > deadline) {
      throw new Error(`LlamaParse: job ${jobId} timed out after ${LLAMA_POLL_TIMEOUT_MS}ms`);
    }
    await sleep(LLAMA_POLL_INTERVAL_MS);

    let status;
    try {
      const { data } = await axios.get(jobUrl, { headers: authHeader });
      status = data.status || data.job?.status;
    } catch (err) {
      throw wrapAxios(`LlamaParse: status check failed for job ${jobId}`, err);
    }

    if (status === 'COMPLETED') break;
    if (status === 'FAILED' || status === 'CANCELLED' || status === 'CANCELED') {
      throw new Error(`LlamaParse: job ${jobId} ended with status ${status}`);
    }
    // PENDING / RUNNING -> keep polling
  }

  // Retrieve per-page markdown
  let result;
  try {
    const { data } = await axios.get(jobUrl, { headers: authHeader, params: { expand: 'markdown' } });
    result = data;
  } catch (err) {
    throw wrapAxios(`LlamaParse: result fetch failed for job ${jobId}`, err);
  }

  const pages = normalizeLlamaPages(result);
  const markdown = pages.map((p) => p.markdown).join('\n\n');

  logger.info('LlamaParse: job complete', { jobId, pageCount: pages.length });
  return {
    markdown,
    pages,
    backend: 'llamaparse',
    jobId,
    metadata: result.metadata || result.job_metadata || {}
  };
}

/** Upload a buffer to LlamaCloud's files endpoint and return its file_id. */
async function uploadFileToLlamaCloud(buffer, fileName, authHeader) {
  const form = new FormData();
  form.append('upload_file', buffer, { filename: fileName || 'document.pdf' });
  try {
    const { data } = await axios.post(`${LLAMA_BASE_URL}/api/v1/files/`, form, {
      headers: { ...authHeader, ...form.getHeaders() },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    const fileId = data.id;
    if (!fileId) throw new Error('upload response had no file id');
    logger.info('LlamaParse: file uploaded', { fileId, fileName });
    return fileId;
  } catch (err) {
    throw wrapAxios('LlamaParse: file upload failed', err);
  }
}

/**
 * Normalise the expand=markdown result into [{ page, markdown }].
 * Confirmed v2 shape: result.markdown = { pages: [{ page_number, markdown }] }.
 * Tolerant of a flat array fallback in case the shape shifts.
 */
function normalizeLlamaPages(result) {
  const md = result.markdown;
  const pages = md && Array.isArray(md.pages)
    ? md.pages
    : Array.isArray(md)
      ? md
      : Array.isArray(result.pages)
        ? result.pages
        : [];
  return pages
    .map((p, i) => {
      if (typeof p === 'string') return { page: i + 1, markdown: p.trim() };
      return {
        page: p.page_number ?? p.page ?? i + 1,
        markdown: (p.markdown ?? p.md ?? p.text ?? '').trim()
      };
    })
    .filter((p) => p.markdown);
}

/**
 * Azure Document Intelligence backend (PHI / in-tenant path).
 * STUB — wired when the user-upload features land. Kept here so callers route by
 * sensitivity today and the compliant lane drops in without touching callers.
 */
async function parseWithAzureDocIntelligence(/* buffer, opts */) {
  throw new Error(
    'Azure Document Intelligence backend not yet implemented. ' +
    'PHI documents must not be sent to the LlamaParse SaaS path. ' +
    'Wire AZURE_DOC_INTELLIGENCE_ENDPOINT / key here before parsing user-uploaded documents.'
  );
}

/** Normalise axios errors into something with the upstream status + body. */
function wrapAxios(message, err) {
  const status = err.response?.status;
  const body = err.response?.data;
  const detail = status ? ` (HTTP ${status}: ${JSON.stringify(body)})` : ` (${err.message})`;
  return new Error(message + detail);
}

module.exports = { parseDocument, parseWithLlamaParse, parseWithAzureDocIntelligence };
