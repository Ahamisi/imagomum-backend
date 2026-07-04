/**
 * Story slide template (CMS spec §2.3 / §10 — full-screen Stories UI).
 *
 * Turns a topic (cover image + title + item body) into a short, readable story:
 * a cover slide (image + title + subtitle) followed by a few self-contained
 * slides. The splitter is block-aware — whole sentences per slide (never
 * mid-word/mid-sentence), a list shown COMPLETE on one slide with its lead-in,
 * long lists guard-railed to concise items, references stripped, and no story
 * ends on a dangling "…could include:" lead-in.
 *
 * Pure (no IO): deterministic, safe on the read path.
 */

const COVER_PLACEHOLDER = 'cdn.imagomum.app';
const MAX_WORDS_PER_SLIDE = 45;
const MAX_LIST_ITEMS = 7;
const MAX_BULLET_WORDS = 10;
const MAX_TEXT_SLIDES = 6;

// A clean one-line cover subtitle when we can't take a short lead sentence.
const CATEGORY_SUBTITLE = {
  baby_dev: "Your baby's development",
  nutrition: 'Eating well in pregnancy',
  antenatal_care: 'Your antenatal care',
  warning_signs: 'Know the warning signs',
  mental_health: 'Your emotional wellbeing',
  exercise: 'Staying active safely',
  wellness: 'Rest and self-care',
  symptoms: 'What to expect',
  postpartum_prep: 'After the birth'
};

function realCover(url) {
  return url && !String(url).includes(COVER_PLACEHOLDER) ? url : null;
}

function wordCount(s) {
  return String(s).trim().split(/\s+/).filter(Boolean).length;
}

/** Normalise a stored markdown body to clean, block-preserving plain text. Pure. */
function cleanBody(md) {
  let s = String(md || '');
  // Drop the "--- / _Source: ..._" attribution footer.
  s = s.replace(/\n*-{3,}[\s\S]*$/, '');
  s = s.replace(/\n+_?\s*Source:[\s\S]*$/i, '');
  // Heading line -> its own sentence.
  s = s.replace(/^#+\s*(.+?)\s*$/gm, (_m, h) => (/[.!?:]$/.test(h) ? h : `${h}.`));
  s = s.replace(/\*\*(.*?)\*\*/g, '$1');
  s = s.replace(/(^|[^_])_([^_]+)_/g, '$1$2');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/^\s*[-*]\s+/gm, '• ');
  s = s.replace(/[ \t]+/g, ' ').replace(/ +([:;,.!?])/g, '$1');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

/** Split prose into sentence units (never mid-word). Pure. */
function splitSentences(text) {
  return (String(text).match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [String(text)])
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Trim a bullet to a concise, scannable phrase: drop "such as / including …"
 * tails, cut at a comma/dash if still long, hard-cap the word count. Pure.
 */
function conciseBullet(item) {
  let s = String(item).trim().replace(/[,;:.]+$/, '');
  s = s.replace(/[,–—-]\s*(such as|including|like|e\.g\.?|for example|especially)\b.*$/i, '');
  // Long bullet -> keep just the core phrase (cut at the first clause boundary).
  if (wordCount(s) > MAX_BULLET_WORDS) {
    const m = s.match(/^(.*?)(?:\s*[,.;:(]|\s+(?:which|that|where|so that)\b)/i);
    if (m && wordCount(m[1]) >= 2) s = m[1];
  }
  const words = s.trim().split(/\s+/);
  if (words.length > MAX_BULLET_WORDS) s = `${words.slice(0, MAX_BULLET_WORDS).join(' ')}…`;
  return s.trim().replace(/[,;:.(]+$/, '');
}

/** Parse clean text into ordered paragraph / list blocks. Pure. */
function parseBlocks(clean) {
  const blocks = [];
  let para = [];
  let list = [];
  const flushPara = () => { if (para.length) { blocks.push({ kind: 'para', text: para.join(' ').trim() }); para = []; } };
  const flushList = () => { if (list.length) { blocks.push({ kind: 'list', items: list.slice() }); list = []; } };

  for (const raw of String(clean).split('\n')) {
    const line = raw.trim();
    if (!line) { flushPara(); flushList(); continue; }
    if (line.startsWith('•')) { flushPara(); list.push(line.replace(/^•\s*/, '').trim()); }
    else { flushList(); para.push(line); }
  }
  flushPara();
  flushList();
  return blocks;
}

/** Split already-clean text into readable text-slide strings. Pure. */
function splitCleanToSlides(clean) {
  const blocks = parseBlocks(clean);
  const slides = [];
  let buf = [];
  let bufWords = 0;
  const flush = () => { if (buf.length) { slides.push(buf.join(' ').trim()); buf = []; bufWords = 0; } };

  for (const block of blocks) {
    if (slides.length >= MAX_TEXT_SLIDES) break;

    if (block.kind === 'para') {
      for (const sentence of splitSentences(block.text)) {
        const w = wordCount(sentence);
        if (bufWords + w > MAX_WORDS_PER_SLIDE && buf.length) {
          flush();
          if (slides.length >= MAX_TEXT_SLIDES) break;
        }
        buf.push(sentence);
        bufWords += w;
      }
    } else {
      // A list is shown COMPLETE on one slide, with its lead-in ("…include:")
      // pulled onto the same slide, and long lists reduced to concise items.
      let header = null;
      if (buf.length && /:$/.test(buf[buf.length - 1])) header = buf.pop();
      flush();
      if (slides.length >= MAX_TEXT_SLIDES) break;

      const items = block.items.map(conciseBullet).filter(Boolean).slice(0, MAX_LIST_ITEMS);
      if (items.length) {
        const bullets = items.map((x) => `• ${x}`).join('\n');
        slides.push(header ? `${header}\n${bullets}` : bullets);
      } else if (header) {
        buf.push(header); // no usable list — keep the lead-in as prose
      }
    }
  }
  flush();

  // Never end on a dangling lead-in colon (list dropped by the cap / absent).
  if (slides.length) {
    const last = slides[slides.length - 1];
    if (/:$/.test(last.trim()) && !last.includes('•')) {
      const sents = splitSentences(last);
      if (sents.length > 1) {
        sents.pop();
        slides[slides.length - 1] = sents.join(' ').trim();
      } else {
        slides.pop();
      }
    }
  }
  return slides.slice(0, MAX_TEXT_SLIDES);
}

/**
 * Build the ordered slide list for a topic's story.
 * @param {object} topic  { title, subtitle, coverImageUrl, category }
 * @param {object[]} items shaped items with a `body`
 */
function buildStorySlides(topic, items = []) {
  const image = realCover(topic.coverImageUrl);
  const clean = items.map((it) => cleanBody(it.body)).filter(Boolean).join('\n\n');
  const sentences = splitSentences(clean);

  // Cover subtitle: a short lead sentence when there's plenty of body after it
  // (removed from the slides to avoid duplication), else a category descriptor.
  let subtitle;
  let bodyText = clean;
  if (sentences.length >= 3 && sentences[0] && wordCount(sentences[0]) <= 20) {
    subtitle = sentences[0].replace(/[.:]+$/, '').trim();
    bodyText = clean.slice(clean.indexOf(sentences[0]) + sentences[0].length).trim();
  } else {
    subtitle = CATEGORY_SUBTITLE[topic.category] || (topic.subtitle || '').trim();
  }

  const cover = { type: 'cover', image, title: topic.title, subtitle };
  const textSlides = splitCleanToSlides(bodyText).map((t) => ({ type: 'text', image, text: t }));
  return [cover, ...textSlides];
}

module.exports = {
  buildStorySlides,
  splitCleanToSlides,
  cleanBody,
  splitSentences,
  conciseBullet,
  parseBlocks,
  realCover
};
