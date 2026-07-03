/**
 * Story slide template (CMS spec §2.3 / §10 — full-screen Stories UI).
 *
 * Turns a topic (cover image + title + one or more item bodies) into a short,
 * readable "story": a cover slide followed by 3–4 bite-size text slides. This is
 * a TEMPLATE — the structure is fixed and every delivery just fills it with new
 * image + text, so slides are generated automatically for any topic.
 *
 * Pure (no IO): deterministic string work, safe to run on the read path.
 */

const COVER_PLACEHOLDER = 'cdn.imagomum.app';
const MAX_WORDS_PER_SLIDE = 55;
const MAX_TEXT_SLIDES = 4;

/** Strip the light markdown stored in bodies to clean plain text. Pure. */
function stripMarkdown(md) {
  return String(md || '')
    // Heading line -> its own sentence (so it reads as a lead-in, not run-on).
    .replace(/^#+\s*(.+?)\s*$/gm, (_m, h) => (/[.!?:]$/.test(h) ? h : `${h}.`))
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/(^|[^_])_([^_]+)_/g, '$1$2')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // markdown links -> text
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** A real (non-placeholder) cover image URL, or null. Pure. */
function realCover(url) {
  return url && !String(url).includes(COVER_PLACEHOLDER) ? url : null;
}

/**
 * Split prose into readable slides of ~MAX_WORDS_PER_SLIDE words, keeping whole
 * sentences together and never exceeding maxSlides (overflow merges into last).
 * Pure.
 */
function splitIntoSlides(text, { maxWords = MAX_WORDS_PER_SLIDE, maxSlides = MAX_TEXT_SLIDES } = {}) {
  const clean = stripMarkdown(text);
  if (!clean) return [];

  // Sentence-ish units (keep bullets and trailing fragments).
  const units = clean.match(/[^.!?\n]+[.!?]*/g) || [clean];
  const slides = [];
  let cur = [];
  let words = 0;

  for (const raw of units) {
    const unit = raw.trim();
    if (!unit) continue;
    const w = unit.split(/\s+/).length;
    if (words + w > maxWords && cur.length) {
      slides.push(cur.join(' ').trim());
      cur = [];
      words = 0;
    }
    cur.push(unit);
    words += w;
  }
  if (cur.length) slides.push(cur.join(' ').trim());

  if (slides.length > maxSlides) {
    const head = slides.slice(0, maxSlides - 1);
    const tail = slides.slice(maxSlides - 1).join(' ');
    return [...head, tail];
  }
  return slides;
}

/**
 * Build the ordered slide list for a topic's story.
 * @param {object} topic  { title, subtitle, coverImageUrl }
 * @param {object[]} items shaped items with a `body` (markdown/plain)
 * @returns {Array<{type:'cover'|'text', image?:string|null, title?:string, subtitle?:string, text?:string}>}
 */
function buildStorySlides(topic, items = []) {
  const image = realCover(topic.coverImageUrl);

  const cover = {
    type: 'cover',
    image,
    title: topic.title,
    subtitle: (topic.subtitle || '').trim()
  };

  const textSlides = [];
  for (const item of items) {
    for (const chunk of splitIntoSlides(item.body)) {
      // Every slide carries the cover image (dimmed behind the text) for a
      // cohesive, polished look rather than flat colour cards.
      textSlides.push({ type: 'text', image, text: chunk });
    }
  }

  return [cover, ...textSlides.slice(0, MAX_TEXT_SLIDES)];
}

module.exports = { buildStorySlides, splitIntoSlides, stripMarkdown, realCover };
