const axios = require('axios');
const { retrieve } = require('./retrievalService');
const ContentItem = require('../models/ContentItem');
const ContentSource = require('../models/ContentSource');
const logger = require('../utils/logger');

/**
 * RAG generation: turn a content "slot" (topic + optional week/type targeting)
 * into a grounded, structured draft ContentItem, sourced from the local reviewed
 * knowledge base — never a live model's parametric memory.
 *
 * Pipeline: retrieve (hybrid) -> generate structured JSON (GPT-4o, grounded in
 * retrieved excerpts) -> groundedness self-reflection gate -> draft ContentItem.
 * The draft still enters the mandatory medical-review workflow before publish;
 * this only produces stage-0 drafts.
 */

const ENDPOINT = (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, '');
const KEY = process.env.AZURE_OPENAI_KEY1;
const CHAT_DEPLOYMENT = process.env.AZURE_OPENAI_CHAT_DEPLOYMENT || 'gpt-4o';
const API_VERSION = process.env.AZURE_OPENAI_API_VERSION || '2024-10-21';

const CONTENT_TYPES = ['tip', 'nutrition', 'baby_dev', 'warning_sign', 'scan_info', 'mental_health', 'antenatal_prep', 'exercise'];
const CULTURAL_CONTEXTS = ['universal', 'nigerian', 'west_african'];
const GROUNDEDNESS_THRESHOLD = parseFloat(process.env.RAG_GROUNDEDNESS_THRESHOLD) || 0.7;

/** Number the retrieved chunks into a citable context block. */
function buildContextBlock(chunks) {
  return chunks
    .map((c, i) => {
      const pages = c.pageTo && c.pageTo !== c.pageFrom ? `pp.${c.pageFrom}-${c.pageTo}` : `p.${c.pageFrom}`;
      const section = c.section ? ` — ${c.section}` : '';
      return `[${i + 1}] (${c.documentTitle}, ${pages}${section})\n${c.content}`;
    })
    .join('\n\n');
}

/** Build the chat messages for the generation call. Pure — no IO. */
function buildGenerationMessages(slot, contextBlock) {
  const system = [
    'You are a clinical content editor for Imago Mum, a pregnancy education app for mothers (with a focus on Nigerian mothers).',
    'You write warm, plain-language content at roughly a 6th–8th grade reading level.',
    'STRICT GROUNDING RULE: every clinical claim MUST be supported by the provided SOURCE excerpts.',
    'Do NOT add facts, numbers, drug doses, or recommendations that are not in the sources. If the sources do not cover something, omit it.',
    'You reply ONLY with a single JSON object, no prose around it.'
  ].join(' ');

  const target = [
    `Topic: ${slot.topic}`,
    slot.contentType ? `Desired contentType: ${slot.contentType}` : null,
    slot.gestationalWeekMin ? `Gestational week range: ${slot.gestationalWeekMin}-${slot.gestationalWeekMax || slot.gestationalWeekMin}` : null,
    slot.localizeForNigeria === false ? 'Audience: general' : 'Localise for a Nigerian audience where appropriate (foods, context), without inventing local claims.'
  ].filter(Boolean).join('\n');

  const user = [
    'Write ONE piece of pregnancy education content, grounded strictly in the SOURCES below.',
    '',
    'TARGET:',
    target,
    '',
    'SOURCES:',
    contextBlock,
    '',
    'Return a JSON object with EXACTLY these keys:',
    '{',
    '  "title": string (<=200 chars),',
    '  "body": string (markdown, plain language, well under 400 words; end with a "Sources" list citing the [n] excerpts used),',
    `  "contentType": one of ${JSON.stringify(CONTENT_TYPES)},`,
    '  "gestationalWeekMin": integer 1-42 or null,',
    '  "gestationalWeekMax": integer 1-42 or null,',
    '  "trimester": integer 1-3 or null,',
    `  "culturalContext": one of ${JSON.stringify(CULTURAL_CONTEXTS)},`,
    '  "tags": array of short lowercase strings,',
    '  "citations": array of the source numbers (integers) you actually used',
    '}'
  ].join('\n');

  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/** Validate/normalise a generated draft against the ContentItem schema. Pure. */
function validateDraft(draft) {
  const errors = [];
  if (!draft || typeof draft !== 'object') return { ok: false, errors: ['not an object'], value: null };
  if (!draft.title || typeof draft.title !== 'string') errors.push('title missing');
  if (!draft.body || typeof draft.body !== 'string') errors.push('body missing');
  if (!CONTENT_TYPES.includes(draft.contentType)) errors.push(`contentType invalid: ${draft.contentType}`);

  const clampWeek = (w) => (Number.isInteger(w) && w >= 1 && w <= 42 ? w : null);
  const value = {
    title: (draft.title || '').slice(0, 200),
    body: draft.body,
    contentType: draft.contentType,
    gestationalWeekMin: clampWeek(draft.gestationalWeekMin),
    gestationalWeekMax: clampWeek(draft.gestationalWeekMax),
    trimester: Number.isInteger(draft.trimester) && draft.trimester >= 1 && draft.trimester <= 3 ? draft.trimester : null,
    culturalContext: CULTURAL_CONTEXTS.includes(draft.culturalContext) ? draft.culturalContext : 'universal',
    tags: Array.isArray(draft.tags) ? draft.tags.filter((t) => typeof t === 'string') : [],
    citations: Array.isArray(draft.citations) ? draft.citations.filter(Number.isInteger) : []
  };
  return { ok: errors.length === 0, errors, value };
}

/** Azure OpenAI chat completion that returns parsed JSON. */
async function chatJSON(messages, { temperature = 0.2 } = {}) {
  if (!ENDPOINT || !KEY) throw new Error('Generation: AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_KEY1 not set');
  const url = `${ENDPOINT}/openai/deployments/${CHAT_DEPLOYMENT}/chat/completions?api-version=${API_VERSION}`;
  const { data } = await axios.post(
    url,
    { messages, temperature, response_format: { type: 'json_object' } },
    { headers: { 'api-key': KEY, 'Content-Type': 'application/json' }, timeout: 90000 }
  );
  return JSON.parse(data.choices[0].message.content);
}

/**
 * Self-reflection groundedness gate: a second, independent LLM pass that checks
 * whether the draft body is fully supported by the source excerpts.
 */
async function assessGroundedness(body, contextBlock) {
  const messages = [
    {
      role: 'system',
      content: 'You are a strict clinical fact-checker. Given a DRAFT and the SOURCES it must be grounded in, decide whether every clinical claim in the draft is supported by the sources. Reply ONLY with JSON.'
    },
    {
      role: 'user',
      content: [
        'SOURCES:', contextBlock, '',
        'DRAFT:', body, '',
        'Return JSON: {"grounded": boolean, "groundedness_score": number 0-1, "unsupported_claims": string[], "notes": string}.',
        'A claim is unsupported if it is not stated or directly implied by the SOURCES.'
      ].join('\n')
    }
  ];
  return chatJSON(messages, { temperature: 0 });
}

/**
 * Generate a grounded draft for a slot.
 * @param {object} slot { topic, contentType?, gestationalWeekMin?, gestationalWeekMax?, query?, localizeForNigeria? }
 * @param {object} [opts] { topK?, persist?, sourceName? }
 * @returns {Promise<{draft, sources, groundedness, passed, contentItem?}>}
 */
async function generateDraft(slot, opts = {}) {
  const chunks = await retrieve(slot.query || slot.topic, { topK: opts.topK || 6 });
  if (chunks.length === 0) throw new Error(`Generation: no grounding chunks for "${slot.topic}"`);

  const contextBlock = buildContextBlock(chunks);
  const raw = await chatJSON(buildGenerationMessages(slot, contextBlock));
  const { ok, errors, value } = validateDraft(raw);
  if (!ok) throw new Error(`Generation: draft failed validation: ${errors.join('; ')}`);

  const groundedness = await assessGroundedness(value.body, contextBlock);
  const passed = groundedness.grounded === true && (groundedness.groundedness_score ?? 0) >= GROUNDEDNESS_THRESHOLD;

  const sources = chunks.map((c, i) => ({
    n: i + 1, documentTitle: c.documentTitle, pageFrom: c.pageFrom, pageTo: c.pageTo, section: c.section, docUrl: c.docUrl
  }));

  logger.info('Generation: draft produced', { topic: slot.topic, passed, score: groundedness.groundedness_score, chunks: chunks.length });

  let contentItem;
  if (opts.persist && passed) {
    let sourceId = null;
    if (opts.sourceName) {
      const src = await ContentSource.findOne({ where: { name: opts.sourceName } });
      sourceId = src ? src.id : null;
    }
    contentItem = await ContentItem.create({
      ...value,
      status: 'draft',
      localizedForNigeria: value.culturalContext !== 'universal',
      sourceId,
      sourceUrl: chunks[0].docUrl || null
    });
  }

  return { draft: value, sources, groundedness, passed, contentItem };
}

module.exports = {
  generateDraft, assessGroundedness, buildContextBlock, buildGenerationMessages, validateDraft,
  CONTENT_TYPES, CULTURAL_CONTEXTS
};
