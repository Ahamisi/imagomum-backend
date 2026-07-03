const { getCurrentDelivery, getLibraryTopics } = require('../services/deliveryService');
const { buildStorySlides } = require('../utils/slideTemplate');

/**
 * Mobile delivery read API (CMS spec §10).
 * Shapes the precomputed WeeklyDelivery into the nested payload the app renders
 * as the full-screen Stories experience, cacheable on-device for offline reading.
 */

/** displayOrder from the through row, whichever alias Sequelize attached it under. */
function throughOrder(instance, throughName) {
  const t = instance[throughName] || instance.get?.(throughName);
  return (t && (t.displayOrder ?? t.get?.('displayOrder'))) ?? 0;
}

function shapeMedia(asset) {
  const base = {
    id: asset.id,
    type: asset.type,
    url: asset.url,
    thumbnailUrl: asset.thumbnailUrl,
    duration: asset.duration,
    altText: asset.altText,
    captionAvailable: asset.captionAvailable,
    videoChannel: asset.videoChannel
  };
  const yt = asset.getYoutubeUrls?.();
  return yt ? { ...base, ...yt } : base;
}

function shapeItem(item) {
  return {
    id: item.id,
    title: item.title,
    body: item.body,
    contentType: item.contentType,
    tags: item.tags || [],
    sourceUrl: item.sourceUrl,
    media: (item.mediaAssets || []).map(shapeMedia)
  };
}

function shapeTopic(topic) {
  const items = [...(topic.contentItems || [])]
    .sort((a, b) => throughOrder(a, 'TopicContentItem') - throughOrder(b, 'TopicContentItem'))
    .map(shapeItem);
  // Story template: a cover slide + 3–4 readable text slides split from the
  // item bodies. The app renders `slides` directly; `items` is kept for media.
  const slides = buildStorySlides(
    { title: topic.title, subtitle: topic.subtitle, coverImageUrl: topic.coverImageUrl },
    items
  );
  return {
    id: topic.id,
    title: topic.title,
    subtitle: topic.subtitle,
    coverImageUrl: topic.coverImageUrl,
    category: topic.category,
    estimatedReadMins: topic.estimatedReadMins,
    items,
    slides
  };
}

/** GET /api/v1/content-library?category=... — evergreen browse library (category tabs) */
async function getLibrary(req, res) {
  const { category } = req.query;
  const topics = await getLibraryTopics({ category });
  return res.json({
    success: true,
    data: { topics: topics.map(shapeTopic) }
  });
}

/** GET /api/v1/deliveries/current */
async function getCurrent(req, res) {
  const delivery = await getCurrentDelivery(req.user.id);
  if (!delivery) {
    return res.json({ success: true, data: null, message: 'No delivery available yet' });
  }

  const topics = [...(delivery.topics || [])]
    .sort((a, b) => throughOrder(a, 'DeliveryTopic') - throughOrder(b, 'DeliveryTopic'))
    .map(shapeTopic);

  return res.json({
    success: true,
    data: {
      id: delivery.id,
      gestationalWeek: delivery.gestationalWeek,
      scheduledAt: delivery.scheduledAt,
      deliveredAt: delivery.deliveredAt,
      status: delivery.status,
      topics
    }
  });
}

module.exports = { getCurrent, getLibrary };
