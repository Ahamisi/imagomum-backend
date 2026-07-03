const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const ContentItem = require('../models/ContentItem');
const ContentSource = require('../models/ContentSource');
const logger = require('../utils/logger');

/**
 * MedlinePlus ingestion (CMS spec §4.1/§4.2) — structured, key-free source.
 *
 * MedlinePlus is U.S. National Library of Medicine consumer-health content in
 * the public domain (no API key, no per-request cost). Unlike WHO/FMOH — which
 * go through the RAG generation pipeline — MedlinePlus health-topic pages are
 * already clean, editorial prose, so we ingest them directly into `draft`
 * ContentItems. Every draft still passes through the mandatory medical-review
 * workflow before it can be published/delivered (same hard gate as all sources).
 *
 * The service is deliberately split:
 *   - fetch + parse + map  -> PURE-ish (network only), no DB. Used by preview.
 *   - ingest({persist})    -> writes draft ContentItems, deduped by sourceUrl.
 */

const BASE_URL = process.env.MEDLINEPLUS_ENDPOINT || 'https://wsearch.nlm.nih.gov/ws/query';

// MedlinePlus organises health topics into groups. "Pregnancy and Reproduction"
// is the authoritative, complete set for our domain (~37 topics), so rather than
// guessing search terms we sweep broad seed terms at a high retmax and keep only
// the documents that belong to this group. This is deterministic and captures
// the whole group as MedlinePlus curates it.
const TARGET_GROUP = 'Pregnancy and Reproduction';

// Broad seeds used purely to surface members of TARGET_GROUP (the group filter
// does the real selection; retmax is high so we see the long tail).
const GROUP_SEED_TERMS = [
  'pregnancy', 'prenatal', 'fetal', 'birth', 'childbirth',
  'postpartum', 'maternal', 'labor', 'miscarriage', 'twins'
];

// Topics in the group that aren't relevant to expectant mothers (family
// planning / non-pregnancy). Excluded from ingestion; a reviewer can still add
// any of these deliberately later. Matched case-insensitively on title.
const EXCLUDE_TITLES = new Set(
  [
    'Birth Control',
    'Vasectomy',
    'Abortion',
    'Teenage Pregnancy',
    'Primary Ovarian Insufficiency',
    'Reproductive Hazards',
    'Anatomy',
    'Infertility',
    'Female Infertility',
    'Assisted Reproductive Technology'
  ].map((t) => t.toLowerCase())
);

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ---------------------------------------------------------------------------
// Pure helpers (no IO)
// ---------------------------------------------------------------------------

/** Decode the handful of HTML entities MedlinePlus summaries use. Pure. */
function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&lsquo;/g, '‘')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&amp;/g, '&'); // last, so we don't re-expand decoded ampersands
}

/** Strip all HTML tags to plain text (used for titles / group names). Pure. */
function stripTags(html) {
  return decodeHtmlEntities(String(html).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/**
 * Convert a MedlinePlus FullSummary (simple HTML: p/ul/ol/li/b/i/a/br, plus
 * <span class="qt0"> search-term highlights) into markdown. Pure.
 */
function htmlToMarkdown(html) {
  if (!html) return '';
  let s = String(html);

  // Drop search-term highlight spans but keep their inner text.
  s = s.replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '');
  // Links -> markdown.
  s = s.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  // Emphasis.
  s = s.replace(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi, '**$1**');
  s = s.replace(/<(?:i|em)>([\s\S]*?)<\/(?:i|em)>/gi, '_$1_');
  // List items -> bullets.
  s = s.replace(/<li>\s*/gi, '\n- ').replace(/<\/li>/gi, '');
  // Block breaks.
  s = s.replace(/<\/p>/gi, '\n\n').replace(/<p[^>]*>/gi, '');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/?(?:ul|ol)[^>]*>/gi, '\n');
  // Anything left over.
  s = s.replace(/<[^>]+>/g, '');

  s = decodeHtmlEntities(s);

  // Tidy whitespace.
  s = s
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return s;
}

/** Map a topic to one of the ContentItem.contentType enum values. Pure. */
function inferContentType(title, groupNames = []) {
  const t = `${title} ${groupNames.join(' ')}`.toLowerCase();
  if (/(nutrition|diet|eating|food|vitamin|folic|iron|weight gain)/.test(t)) return 'nutrition';
  if (/(depression|anxiety|mental|mood|stress|emotional)/.test(t)) return 'mental_health';
  if (/(exercise|physical activity|fitness)/.test(t)) return 'exercise';
  if (/(ultrasound|scan|prenatal test|screening|amniocentesis)/.test(t)) return 'scan_info';
  if (/(bleeding|preeclampsia|blood pressure|warning|danger|complicat|infection|preterm|miscarriage|loss|emergency|diabetes)/.test(t)) return 'warning_sign';
  if (/(fetal|baby develop|growth|development)/.test(t)) return 'baby_dev';
  if (/(childbirth|labor|labour|delivery|birth plan|antenatal|prenatal care|breastfeed|postpartum|preparing)/.test(t)) return 'antenatal_prep';
  return 'tip';
}

/** Normalise a parsed <document> node into a flat topic object. Pure. */
function normalizeDoc(doc) {
  const url = doc['@_url'];
  const contents = Array.isArray(doc.content) ? doc.content : doc.content ? [doc.content] : [];

  const single = {};
  const multi = { groupName: [], mesh: [] };
  for (const c of contents) {
    const name = c && c['@_name'];
    if (!name) continue;
    const text = typeof c === 'object' ? c['#text'] ?? '' : c;
    if (name === 'groupName' || name === 'mesh') {
      multi[name].push(stripTags(text));
    } else {
      single[name] = String(text ?? '');
    }
  }

  if (!url || !single.FullSummary) return null;
  return {
    url,
    title: stripTags(single.title || ''),
    organizationName: single.organizationName || '',
    fullSummaryHtml: single.FullSummary || '',
    groupNames: multi.groupName,
    mesh: multi.mesh
  };
}

/** Build a draft ContentItem payload from a normalised topic. Pure. */
function toDraft(topic) {
  const body = htmlToMarkdown(topic.fullSummaryHtml);
  const attribution =
    `\n\n---\n_Source: [${topic.title}](${topic.url}) — MedlinePlus, ` +
    'U.S. National Library of Medicine (public domain)._';

  const tags = Array.from(
    new Set(['medlineplus', ...topic.groupNames.map((g) => g.toLowerCase())])
  ).slice(0, 8);

  return {
    title: topic.title.slice(0, 200),
    body: `${body}${attribution}`,
    contentType: inferContentType(topic.title, topic.groupNames),
    gestationalWeekMin: null,
    gestationalWeekMax: null,
    trimester: null,
    culturalContext: 'universal',
    localizedForNigeria: false,
    tags,
    sourceUrl: topic.url,
    status: 'draft'
  };
}

// ---------------------------------------------------------------------------
// Network + persistence
// ---------------------------------------------------------------------------

/** GET the MedlinePlus web service and return normalised topics for a term. */
async function fetchTopics(term, { retmax = 3, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const { data } = await axios.get(BASE_URL, {
        params: { db: 'healthTopics', term, retmax },
        responseType: 'text',
        timeout: 30000
      });
      const list = parser.parse(data)?.nlmSearchResult?.list;
      if (!list || !list.document) return [];
      const docs = Array.isArray(list.document) ? list.document : [list.document];
      return docs.map(normalizeDoc).filter(Boolean);
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`MedlinePlus fetch failed for "${term}": ${lastErr?.message || 'unknown error'}`);
}

/**
 * Sweep the seed terms and return every unique topic in TARGET_GROUP, minus the
 * excluded titles. Deduped by URL. This is the authoritative topic set.
 * @returns {Promise<Array<object>>} normalised topics
 */
async function fetchTargetTopics({ seeds = GROUP_SEED_TERMS, retmax = 60 } = {}) {
  const byUrl = new Map();
  for (const seed of seeds) {
    let topics = [];
    try {
      topics = await fetchTopics(seed, { retmax });
    } catch (err) {
      logger.warn(`MedlinePlus: skipping seed "${seed}" — ${err.message}`);
      continue;
    }
    for (const topic of topics) {
      const inGroup = topic.groupNames.some((g) => g.toLowerCase() === TARGET_GROUP.toLowerCase());
      const excluded = EXCLUDE_TITLES.has(topic.title.toLowerCase());
      if (inGroup && !excluded && !byUrl.has(topic.url)) {
        byUrl.set(topic.url, topic);
      }
    }
  }
  return [...byUrl.values()];
}

/**
 * Read-only: fetch the full pregnancy topic set and map to draft payloads.
 * No DB writes.
 * @returns {Promise<Array<object>>} draft ContentItem payloads
 */
async function previewDrafts({ seeds = GROUP_SEED_TERMS, retmax = 60 } = {}) {
  const topics = await fetchTargetTopics({ seeds, retmax });
  return topics.map(toDraft);
}

/**
 * Ingest MedlinePlus topics as draft ContentItems, deduped by sourceUrl so
 * re-runs are idempotent. Pass { persist: true } to actually write.
 * @returns {Promise<{fetched:number, created:number, skipped:number, items:object[], drafts?:object[]}>}
 */
async function ingest({ seeds = GROUP_SEED_TERMS, retmax = 60, persist = false, limit } = {}) {
  let drafts = await previewDrafts({ seeds, retmax });
  if (limit) drafts = drafts.slice(0, limit);

  if (!persist) {
    return { fetched: drafts.length, created: 0, skipped: 0, items: [], drafts };
  }

  const source = await ContentSource.findOne({ where: { name: 'MedlinePlus' } });
  const sourceId = source ? source.id : null;

  const result = { fetched: drafts.length, created: 0, skipped: 0, items: [] };
  for (const d of drafts) {
    const existing = await ContentItem.findOne({ where: { sourceUrl: d.sourceUrl, sourceId } });
    if (existing) {
      result.skipped += 1;
      continue;
    }
    const item = await ContentItem.create({ ...d, sourceId });
    result.created += 1;
    result.items.push({ id: item.id, title: item.title, contentType: item.contentType });
  }

  if (source) await source.update({ lastSyncedAt: new Date() });
  logger.info('MedlinePlus ingest complete', {
    fetched: result.fetched,
    created: result.created,
    skipped: result.skipped
  });
  return result;
}

module.exports = {
  ingest,
  previewDrafts,
  fetchTargetTopics,
  fetchTopics,
  // exported for tests / preview tooling
  htmlToMarkdown,
  stripTags,
  inferContentType,
  normalizeDoc,
  toDraft,
  TARGET_GROUP,
  GROUP_SEED_TERMS,
  EXCLUDE_TITLES
};
