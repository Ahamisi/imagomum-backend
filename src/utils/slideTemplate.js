/**
 * Story slide template (CMS spec §2.3 / §10 — full-screen Stories UI).
 *
 * Turns a topic (cover image + title + item body) into a short, readable story:
 * a cover slide (image + title) followed by a handful of self-contained slides.
 * The splitter is block-aware — it respects paragraphs and bullet lists, packs
 * whole sentences (never mid-word/mid-sentence), keeps list items on their own
 * lines, strips source/attribution footers, and caps the story instead of
 * cramming leftovers onto the last slide.
 *
 * Pure (no IO): deterministic, safe on the read path.
 */

const COVER_PLACEHOLDER = 'cdn.imagomum.app';
const MAX_WORDS_PER_SLIDE = 45;
const MAX_BULLETS_PER_SLIDE = 6;
const MAX_TEXT_SLIDES = 6;

/** A real (non-placeholder) cover image URL, or null. Pure. */
function realCover(url) {
  return url && !String(url).includes(COVER_PLACEHOLDER) ? url : null;
}

function wordCount(s) {
  return String(s).trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Normalise a stored markdown body to clean, block-preserving plain text:
 * drops the source/attribution footer, turns headings into sentences, strips
 * emphasis/links, marks bullets, and keeps paragraph/list newlines. Pure.
 */
function cleanBody(md) {
  let s = String(md || '');
  // Drop the "--- / _Source: ..._" attribution footer (kept out of the story).
  s = s.replace(/\n*-{3,}[\s\S]*$/, '');
  s = s.replace(/\n+_?\s*Source:[\s\S]*$/i, '');
  // Heading line -> its own sentence (reads as a lead-in, not a run-on).
  s = s.replace(/^#+\s*(.+?)\s*$/gm, (_m, h) => (/[.!?:]$/.test(h) ? h : `${h}.`));
  // Emphasis + links -> plain text.
  s = s.replace(/\*\*(.*?)\*\*/g, '$1');
  s = s.replace(/(^|[^_])_([^_]+)_/g, '$1$2');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Bullets -> "• ".
  s = s.replace(/^\s*[-*]\s+/gm, '• ');
  // Tidy spacing (e.g. "include :" -> "include:") but keep newlines.
  s = s.replace(/[ \t]+/g, ' ').replace(/ +([:;,.!?])/g, '$1');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Split prose into sentence units (never mid-word). Pure. */
function splitSentences(text) {
  return (text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [text]).map((x) => x.trim()).filter(Boolean);
}

/** Parse clean text into ordered paragraph / list blocks. Pure. */
function parseBlocks(clean) {
  const blocks = [];
  let para = [];
  let list = [];
  const flushPara = () => { if (para.length) { blocks.push({ kind: 'para', text: para.join(' ').trim() }); para = []; } };
  const flushList = () => { if (list.length) { blocks.push({ kind: 'list', items: list.slice() }); list = []; } };

  for (const raw of clean.split('\n')) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (line.startsWith('•')) { flushPara(); list.push(line.replace(/^•\s*/, '').trim()); }
    else { flushList(); para.push(line); }
  }
  flushPara();
  flushList();
  return blocks;
}

/**
 * Split a cleaned body into readable text-slide strings (each a comprehensive
 * chunk; bullets kept as newline-separated lists). Caps at MAX_TEXT_SLIDES.
 * Pure.
 */
function splitBodyToSlides(body) {
  const blocks = parseBlocks(cleanBody(body));
  const slides = [];
  let buf = [];
  let bufWords = 0;

  const flush = () => {
    if (buf.length) { slides.push(buf.join(' ').trim()); buf = []; bufWords = 0; }
  };

  for (const block of blocks) {
    if (slides.length >= MAX_TEXT_SLIDES) break;

    if (block.kind === 'para') {
      for (const sentence of splitSentences(block.text)) {
        const w = wordCount(sentence);
        if (bufWords + w > MAX_WORDS_PER_SLIDE && buf.length) flush();
        buf.push(sentence);
        bufWords += w;
        if (slides.length >= MAX_TEXT_SLIDES) break;
      }
    } else {
      // Lists start a fresh slide and render one item per line.
      flush();
      let group = [];
      let groupWords = 0;
      for (const item of block.items) {
        const w = wordCount(item);
        if ((group.length >= MAX_BULLETS_PER_SLIDE || groupWords + w > MAX_WORDS_PER_SLIDE) && group.length) {
          if (slides.length >= MAX_TEXT_SLIDES) break;
          slides.push(group.map((x) => `• ${x}`).join('\n'));
          group = [];
          groupWords = 0;
        }
        group.push(item);
        groupWords += w;
      }
      if (group.length && slides.length < MAX_TEXT_SLIDES) {
        slides.push(group.map((x) => `• ${x}`).join('\n'));
      }
    }
  }
  flush();
  return slides.slice(0, MAX_TEXT_SLIDES);
}

/**
 * Build the ordered slide list for a topic's story.
 * @param {object} topic  { title, coverImageUrl }
 * @param {object[]} items shaped items with a `body`
 * @returns {Array<{type:'cover'|'text', image?:string|null, title?:string, text?:string}>}
 */
function buildStorySlides(topic, items = []) {
  const image = realCover(topic.coverImageUrl);

  // Cover is image + title only — no body slice (that caused mid-word cuts and
  // duplicated the first content slide).
  const cover = { type: 'cover', image, title: topic.title };

  const textSlides = [];
  for (const item of items) {
    for (const chunk of splitBodyToSlides(item.body)) {
      textSlides.push({ type: 'text', image, text: chunk });
      if (textSlides.length >= MAX_TEXT_SLIDES) break;
    }
    if (textSlides.length >= MAX_TEXT_SLIDES) break;
  }

  return [cover, ...textSlides];
}

module.exports = {
  buildStorySlides,
  splitBodyToSlides,
  cleanBody,
  splitSentences,
  parseBlocks,
  realCover
};
