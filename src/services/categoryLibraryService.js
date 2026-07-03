const { getModels } = require('../models/associations');
const youtube = require('./youtubeService');
const medlinePlus = require('./medlinePlusService');
const logger = require('../utils/logger');

/**
 * Category browse-library builder (Apple health-content sourcing).
 *
 * Powers the mobile category tabs (Nutrition / Exercise / Mental Health /
 * Wellness / Baby development / Antenatal care / Warning signs) with EVERGREEN,
 * real-source-backed ContentTopics — distinct from the week-tailored weekly
 * delivery (these are flagged isLibrary=true and never delivered).
 *
 * Sources, all citable:
 *   - MedlinePlus items (already ingested) -> wrapped into topics by category.
 *     Each cites medlineplus.gov (U.S. National Library of Medicine, public domain).
 *   - Curated YouTube videos from the approved medical-channel allowlist
 *     (WHO / NHS / Tommy's / March of Dimes), each attributed to its channel —
 *     used for categories MedlinePlus doesn't cover (exercise, wellness) and to
 *     enrich thin ones.
 */

const { ContentItem, ContentSource, ContentTopic, TopicContentItem, MediaAsset } = getModels();

// MedlinePlus item contentType -> browse category. 'tip' items are intentionally
// skipped (too generic to categorise reliably); those categories come from video.
const TYPE_TO_CATEGORY = {
  baby_dev: 'baby_dev',
  nutrition: 'nutrition',
  antenatal_prep: 'antenatal_care',
  scan_info: 'antenatal_care',
  warning_sign: 'warning_signs',
  mental_health: 'mental_health',
  exercise: 'exercise'
};

// Browse category -> a ContentItem.contentType for video-sourced items.
const CATEGORY_TO_TYPE = {
  exercise: 'exercise',
  wellness: 'tip',
  mental_health: 'mental_health',
  nutrition: 'nutrition',
  baby_dev: 'baby_dev',
  antenatal_care: 'antenatal_prep',
  warning_signs: 'warning_sign'
};

const COVERS = {
  baby_dev: process.env.COVER_BABY_DEV || 'https://cdn.imagomum.app/covers/baby-development.jpg',
  nutrition: process.env.COVER_NUTRITION || 'https://cdn.imagomum.app/covers/nutrition.jpg',
  antenatal_care: process.env.COVER_ANTENATAL || 'https://cdn.imagomum.app/covers/antenatal-care.jpg',
  warning_signs: process.env.COVER_WARNING || 'https://cdn.imagomum.app/covers/warning-signs.jpg',
  mental_health: process.env.COVER_MENTAL || 'https://cdn.imagomum.app/covers/mental-health.jpg',
  exercise: process.env.COVER_EXERCISE || 'https://cdn.imagomum.app/covers/exercise.jpg',
  wellness: process.env.COVER_WELLNESS || 'https://cdn.imagomum.app/covers/wellness.jpg'
};

// Targeted MedlinePlus health topics (outside the pregnancy group) that give
// on-topic, cited, public-domain coverage for exercise & wellness. contentType
// is forced to fit the browse category.
const TARGETED_MEDLINEPLUS = [
  { term: 'Exercise and Physical Fitness', category: 'exercise', contentType: 'exercise' },
  { term: 'Benefits of Exercise', category: 'exercise', contentType: 'exercise' },
  { term: 'Healthy Sleep', category: 'wellness', contentType: 'tip' },
  { term: 'Stress', category: 'wellness', contentType: 'tip' }
];

// YouTube curation for categories MedlinePlus doesn't cover well. Searches the
// approved-channel allowlist only. OFF by default: results need editorial
// targeting/review (the WHO channel returns off-topic matches for "exercise").
const VIDEO_SPECS = [
  { category: 'exercise', query: 'pregnancy exercise', count: 2 },
  { category: 'exercise', query: 'safe prenatal workout', count: 1 },
  { category: 'wellness', query: 'pregnancy sleep and rest', count: 1 },
  { category: 'wellness', query: 'pregnancy self care wellbeing', count: 1 },
  { category: 'mental_health', query: 'pregnancy mental health anxiety', count: 1 },
  { category: 'nutrition', query: 'healthy eating in pregnancy', count: 1 }
];

/** findOrCreate an evergreen library ContentTopic and link an item to it. */
async function makeLibraryTopic({ item, category, title, subtitle }) {
  const [topic] = await ContentTopic.findOrCreate({
    where: { title, category, isLibrary: true },
    defaults: {
      title,
      subtitle: (subtitle || '').slice(0, 300),
      coverImageUrl: COVERS[category] || COVERS.wellness,
      gestationalWeek: 20, // formality (NOT NULL); library topics ignore week
      category,
      isLibrary: true,
      estimatedReadMins: 2,
      priority: 0
    }
  });
  await TopicContentItem.findOrCreate({
    where: { topicId: topic.id, contentItemId: item.id },
    defaults: { topicId: topic.id, contentItemId: item.id, displayOrder: 0 }
  });
  return topic;
}

/** Wrap each published MedlinePlus item into a category browse topic. */
async function wrapMedlinePlusIntoLibrary(summary) {
  const src = await ContentSource.findOne({ where: { name: 'MedlinePlus' } });
  if (!src) return;
  // Wrap all MedlinePlus items regardless of status — publishing is separate;
  // the browse endpoint only surfaces published+approved anyway.
  const items = await ContentItem.findAll({ where: { sourceId: src.id } });

  for (const item of items) {
    const category = TYPE_TO_CATEGORY[item.contentType];
    if (!category) { summary.mpSkipped += 1; continue; }
    const before = await ContentTopic.findOne({ where: { title: item.title, category, isLibrary: true } });
    await makeLibraryTopic({ item, category, title: item.title, subtitle: item.body });
    if (before) summary.mpExisting += 1; else summary.mpCreated += 1;
  }
}

/** Ingest specific MedlinePlus health topics and wrap them into category topics. */
async function ingestTargetedMedlinePlus(summary) {
  const src = await ContentSource.findOne({ where: { name: 'MedlinePlus' } });
  const sourceId = src ? src.id : null;

  for (const spec of TARGETED_MEDLINEPLUS) {
    let topics = [];
    try {
      topics = await medlinePlus.fetchTopics(spec.term, { retmax: 1 });
    } catch (err) {
      logger.warn(`categoryLibrary: MedlinePlus fetch failed for "${spec.term}" — ${err.message}`);
      continue;
    }
    const top = topics[0];
    if (!top) continue;

    const existing = await ContentItem.findOne({ where: { sourceUrl: top.url, sourceId } });
    let item = existing;
    if (!item) {
      const draft = medlinePlus.toDraft(top);
      item = await ContentItem.create({
        ...draft,
        contentType: spec.contentType, // force to fit the browse category
        sourceId,
        tags: Array.from(new Set([...(draft.tags || []), 'library', spec.category]))
      });
      summary.targetedCreated += 1;
    } else {
      summary.targetedExisting += 1;
    }
    await makeLibraryTopic({ item, category: spec.category, title: item.title, subtitle: item.body });
  }
}

/** Curate approved-channel videos into library topics for thin/uncovered categories. */
async function curateVideosIntoLibrary(summary) {
  const src = await ContentSource.findOne({ where: { name: 'YouTube' } });
  const sourceId = src ? src.id : null;

  for (const spec of VIDEO_SPECS) {
    let results = [];
    try {
      results = await youtube.searchVideos(spec.query, { maxResults: 3 });
    } catch (err) {
      logger.warn(`categoryLibrary: video search failed for "${spec.query}" — ${err.message}`);
      continue;
    }

    let added = 0;
    for (const v of results) {
      if (added >= spec.count) break;
      const exists = await MediaAsset.findOne({ where: { youtubeVideoId: v.videoId } });
      if (exists) { summary.videoExisting += 1; continue; }

      try {
        const item = await ContentItem.create({
          title: v.title.slice(0, 200),
          body: `Watch this short video from ${v.channelTitle}.\n\n_Source: [${v.channelTitle} on YouTube](https://www.youtube.com/watch?v=${v.videoId})._`,
          contentType: CATEGORY_TO_TYPE[spec.category] || 'tip',
          sourceId,
          sourceUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
          localizedForNigeria: false,
          culturalContext: 'universal',
          status: 'draft',
          tags: ['library', spec.category, 'youtube']
        });
        // Attaches a video_embed MediaAsset (rejects off-allowlist channels).
        await youtube.createVideoEmbedAsset({ videoId: v.videoId, contentItemId: item.id });
        await makeLibraryTopic({ item, category: spec.category, title: item.title, subtitle: v.title });
        summary.videoCreated += 1;
        added += 1;
      } catch (err) {
        logger.warn(`categoryLibrary: skipping video ${v.videoId} — ${err.message}`);
      }
    }
  }
}

/**
 * Build the category browse library from real sources.
 * @param {object} [opts] { persist?: boolean, includeVideos?: boolean }
 */
async function buildCategoryLibrary({ persist = false, includeVideos = false } = {}) {
  const summary = {
    mpCreated: 0, mpExisting: 0, mpSkipped: 0,
    targetedCreated: 0, targetedExisting: 0,
    videoCreated: 0, videoExisting: 0
  };
  if (!persist) return summary;

  await wrapMedlinePlusIntoLibrary(summary);
  await ingestTargetedMedlinePlus(summary);
  if (includeVideos) await curateVideosIntoLibrary(summary);

  logger.info('categoryLibrary: build complete', summary);
  return summary;
}

module.exports = { buildCategoryLibrary, TYPE_TO_CATEGORY, VIDEO_SPECS };
