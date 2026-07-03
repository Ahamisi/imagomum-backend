const { getModels } = require('../models/associations');
const logger = require('../utils/logger');

/**
 * Topic Builder (CMS spec §6 Stage "Topic Builder" / §9 / Appendix B).
 *
 * Bridges the gap between ingested ContentItems and what the delivery engine
 * actually consumes: PUBLISHED, week-tagged ContentTopics. It scaffolds the
 * 40-week journey from the Appendix B gestational-week content map — the
 * Nigerian-localised skeleton of baby development / nutrition / antenatal action
 * / warning signs for each stage of pregnancy.
 *
 * The delivery query (deliveryService) matches ContentTopic.gestationalWeek by
 * EXACT week, so we tile the Appendix B rows across every week 1..42: one
 * localised ContentItem per segment-cell (shared by the weeks it spans) and a
 * per-week ContentTopic linked to it via TopicContentItem.
 *
 * Everything is created as status=draft under the first-party "Original" source
 * and STILL passes through the mandatory medical-review gate before it can be
 * delivered — this builder only assembles structure, it does not publish.
 */

const { ContentItem, ContentTopic, ContentSource, TopicContentItem } = getModels();

// Appendix B — Gestational Week Content Map. Each row's `from`/`to` tiles the
// full 1..42 range (gap weeks fold into the nearest clinical stage) so no week
// is left without a topic set. Text is the Nigerian-localised guidance from the
// spec; a reviewer/editor refines it before publish.
const WEEK_MAP = [
  { from: 1, to: 7, stage: 'Weeks 4–6', trimester: 1,
    baby_dev: 'Neural tube is forming and the heart begins to beat.',
    nutrition: 'Focus on folate: beans, ugu (fluted pumpkin), and dark green vegetables.',
    antenatal_care: 'Register at your nearest antenatal (ANC) clinic.',
    warning_signs: 'heavy bleeding or severe cramping' },
  { from: 8, to: 11, stage: 'Weeks 8–10', trimester: 1,
    baby_dev: 'Organs are forming and all limbs are now visible.',
    nutrition: 'Focus on iron: ofada rice, ugu, and liver (in moderation).',
    antenatal_care: 'Attend your first ANC visit; blood tests will be ordered.',
    warning_signs: 'spotting or a persistent fever' },
  { from: 12, to: 15, stage: 'Week 12', trimester: 1,
    baby_dev: 'Your baby is fully formed at about 6cm; fingers are clearly visible.',
    nutrition: 'Focus on calcium: fish, crayfish, akara, and milk if available.',
    antenatal_care: 'Have your 12-week ultrasound scan.',
    warning_signs: 'severe nausea that prevents eating, or dizziness' },
  { from: 16, to: 19, stage: 'Week 16', trimester: 2,
    baby_dev: 'Your baby can hear sounds and active movement begins.',
    nutrition: 'Focus on protein: eggs, beans, fresh fish, and groundnuts.',
    antenatal_care: 'Attend your second ANC visit; discuss any concerns.',
    warning_signs: 'significantly reduced fetal movement' },
  { from: 20, to: 23, stage: 'Week 20', trimester: 2,
    baby_dev: 'Halfway point — this is anomaly scan week.',
    nutrition: 'Focus on omega-3: sardines, mackerel, and fresh tuna.',
    antenatal_care: 'Have your anomaly (20-week) ultrasound scan.',
    warning_signs: 'headaches, vision changes, or swelling' },
  { from: 24, to: 27, stage: 'Week 24', trimester: 2,
    baby_dev: 'Viability threshold; the lungs are beginning to develop.',
    nutrition: 'Pair iron and vitamin C (tomatoes help absorption).',
    antenatal_care: 'GDM screening — blood glucose test.',
    warning_signs: 'swelling of the face or hands, or rising blood pressure' },
  { from: 28, to: 31, stage: 'Week 28', trimester: 3,
    baby_dev: 'Third trimester begins with rapid brain development.',
    nutrition: 'Boost iron: ugu, spinach, ofada rice, fish and meat.',
    antenatal_care: 'Third trimester ANC visit; anaemia check.',
    warning_signs: 'reduced baby kicks, or signs of preterm contractions' },
  { from: 32, to: 35, stage: 'Week 32', trimester: 3,
    baby_dev: 'Your baby is gaining weight quickly and bones are hardening.',
    nutrition: 'Energy-dense foods; small, frequent meals are recommended.',
    antenatal_care: 'Discuss your birth plan and birth location with your midwife.',
    warning_signs: 'fluid leaking from the vagina, or persistent contractions' },
  { from: 36, to: 42, stage: 'Weeks 36–40', trimester: 3,
    baby_dev: 'Full-term is approaching; the head is engaging downward.',
    nutrition: 'Light meals; stay well hydrated and avoid heavy foods.',
    antenatal_care: 'Get your hospital bag ready and complete birth preparations.',
    warning_signs: 'labour signs — know when to go in' }
];

// category -> topic/item metadata. `itemType` maps to ContentItem.contentType.
const CATEGORIES = {
  baby_dev: { label: 'Baby development', itemType: 'baby_dev', priority: 10, heading: 'Your baby this week' },
  nutrition: { label: 'Nutrition', itemType: 'nutrition', priority: 5, heading: 'Eating well' },
  antenatal_care: { label: 'Antenatal action', itemType: 'antenatal_prep', priority: 20, heading: 'Your antenatal action' },
  warning_signs: { label: 'Warning signs', itemType: 'warning_sign', priority: 30, heading: 'When to seek help' }
};

// Placeholder cover art per category — replace with real Stories cover images in
// the CMS. Overridable via env so environments can point at real CDN assets.
const DEFAULT_COVERS = {
  baby_dev: process.env.COVER_BABY_DEV || 'https://cdn.imagomum.app/covers/baby-development.jpg',
  nutrition: process.env.COVER_NUTRITION || 'https://cdn.imagomum.app/covers/nutrition.jpg',
  antenatal_care: process.env.COVER_ANTENATAL || 'https://cdn.imagomum.app/covers/antenatal-care.jpg',
  warning_signs: process.env.COVER_WARNING || 'https://cdn.imagomum.app/covers/warning-signs.jpg'
};

/** The Appendix B segment covering a given gestational week. Pure. */
function segmentForWeek(week) {
  return WEEK_MAP.find((s) => week >= s.from && week <= s.to) || null;
}

/** Build the localised item body (markdown) for a segment-cell. Pure. */
function itemBody(category, segment) {
  const meta = CATEGORIES[category];
  const cell = segment[category];
  if (category === 'warning_signs') {
    return `## ${meta.heading}\n\nContact your clinic or midwife right away if you notice: ${cell}.`;
  }
  return `## ${meta.heading}\n\n${cell}`;
}

/**
 * Build the 40-week topic scaffold from Appendix B.
 * @param {object} [opts]
 * @param {boolean} [opts.persist=false] - write to the DB (else dry-run counts)
 * @param {number}  [opts.fromWeek=1]
 * @param {number}  [opts.toWeek=42]
 * @returns {Promise<object>} summary counts
 */
async function buildTopics({ persist = false, fromWeek = 1, toWeek = 42 } = {}) {
  const summary = {
    persist, weeksCovered: 0,
    itemsCreated: 0, itemsExisting: 0,
    topicsCreated: 0, topicsExisting: 0,
    linksCreated: 0, linksExisting: 0
  };

  if (!persist) {
    // Dry run: report what WOULD be built.
    for (let week = fromWeek; week <= toWeek; week += 1) {
      if (segmentForWeek(week)) summary.weeksCovered += 1;
    }
    summary.topicsCreated = summary.weeksCovered * Object.keys(CATEGORIES).length;
    summary.itemsCreated = WEEK_MAP.length * Object.keys(CATEGORIES).length;
    return summary;
  }

  const source = await ContentSource.findOne({ where: { name: 'Original' } });
  const sourceId = source ? source.id : null;

  // One shared ContentItem per (segment, category), created once and linked from
  // every per-week topic it covers.
  const itemCache = new Map(); // `${segIdx}:${cat}` -> ContentItem

  for (let week = fromWeek; week <= toWeek; week += 1) {
    const segment = segmentForWeek(week);
    if (!segment) continue;
    summary.weeksCovered += 1;
    const segIdx = WEEK_MAP.indexOf(segment);

    for (const [category, meta] of Object.entries(CATEGORIES)) {
      const cacheKey = `${segIdx}:${category}`;
      let item = itemCache.get(cacheKey);

      if (!item) {
        const itemTitle = `${meta.label} — ${segment.stage}`;
        const [created, wasCreated] = await ContentItem.findOrCreate({
          where: { title: itemTitle, sourceId },
          defaults: {
            title: itemTitle,
            body: itemBody(category, segment),
            contentType: meta.itemType,
            gestationalWeekMin: segment.from,
            gestationalWeekMax: Math.min(segment.to, 42),
            trimester: segment.trimester,
            sourceId,
            localizedForNigeria: true,
            culturalContext: 'nigerian',
            tags: ['appendix-b', category],
            status: 'draft'
          }
        });
        item = created;
        itemCache.set(cacheKey, item);
        if (wasCreated) summary.itemsCreated += 1; else summary.itemsExisting += 1;
      }

      const topicTitle = `Week ${week}: ${meta.label}`;
      const [topic, topicCreated] = await ContentTopic.findOrCreate({
        where: { title: topicTitle, gestationalWeek: week, category },
        defaults: {
          title: topicTitle,
          subtitle: segment[category].slice(0, 300),
          coverImageUrl: DEFAULT_COVERS[category],
          gestationalWeek: week,
          category,
          estimatedReadMins: 1,
          priority: meta.priority
        }
      });
      if (topicCreated) summary.topicsCreated += 1; else summary.topicsExisting += 1;

      const [, linkCreated] = await TopicContentItem.findOrCreate({
        where: { topicId: topic.id, contentItemId: item.id },
        defaults: { topicId: topic.id, contentItemId: item.id, displayOrder: 0 }
      });
      if (linkCreated) summary.linksCreated += 1; else summary.linksExisting += 1;
    }
  }

  logger.info('Topic Builder: scaffold complete', summary);
  return summary;
}

module.exports = {
  buildTopics,
  segmentForWeek,
  itemBody,
  WEEK_MAP,
  CATEGORIES,
  DEFAULT_COVERS
};
