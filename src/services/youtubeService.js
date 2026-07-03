const axios = require('axios');
const MediaAsset = require('../models/MediaAsset');
const logger = require('../utils/logger');

/**
 * YouTube curation (CMS spec §5.1 / §5.4) — Phase 1 video strategy.
 *
 * Editorial workflow: search trusted channels -> pick a video -> fetch its
 * details -> attach as a video_embed MediaAsset on a ContentItem. Per spec we
 * store ONLY the youtubeVideoId + attribution metadata; embed/thumbnail URLs are
 * constructed from the id (see buildYoutubeUrls / MediaAsset.getYoutubeUrls).
 *
 * Curation is gated to an approved allowlist of medical channels — a video from
 * any other channel is rejected before it can become an asset.
 */

const BASE_URL = 'https://www.googleapis.com/youtube/v3';
const API_KEY = process.env.YOUTUBE_API_KEY;

// Approved medical channels (spec §5.1). channelId is pinned (verified via the
// API) — more robust than @handle resolution, which YouTube fails for some
// channels, and it avoids spending quota resolving handles on every run.
const APPROVED_CHANNELS = [
  { handle: 'WHO', name: 'World Health Organization (WHO)', channelId: 'UC07-dOwgza1IguKA86jqxNA' },
  { handle: 'nhsengland', name: 'NHS England', channelId: 'UCI-kWXLNEK7rsBW9ZVCvPfg' },
  { handle: 'TommysCharity', name: "Tommy's", channelId: 'UCfmWomlMgIT1GDuy36yM-Zg' },
  { handle: 'marchofdimes', name: 'March of Dimes', channelId: 'UC4c0YWRDCLoWxxWORH_zIkQ' },
  { handle: 'ACOG', name: 'ACOG', channelId: 'UC-uUyzB9o4CgrpRjG2Ooi3g' }
];

const channelIdCache = new Map(); // handle -> channelId

function assertKey() {
  if (!API_KEY) throw new Error('YouTube: YOUTUBE_API_KEY not set');
}

// Transient YouTube Data API failures worth retrying. `accountDelegationForbidden`
// ("cannot act on behalf of the specified Google account") is a long-standing,
// intermittent quirk that hits some org-managed channels on search.list — it
// clears on retry.
const RETRYABLE_REASONS = new Set([
  'accountDelegationForbidden', 'backendError', 'internalError', 'rateLimitExceeded'
]);

async function ytGet(path, params, { retries = 3 } = {}) {
  assertKey();
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const { data } = await axios.get(`${BASE_URL}${path}`, { params: { ...params, key: API_KEY } });
      return data;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      const reason = err.response?.data?.error?.errors?.[0]?.reason;
      const retryable = RETRYABLE_REASONS.has(reason) || status === 500 || status === 503;
      if (!retryable || attempt === retries) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }
  }
  const status = lastErr.response?.status;
  const reason = lastErr.response?.data?.error?.message || lastErr.message;
  throw new Error(`YouTube ${path} failed (HTTP ${status || '?'}): ${reason}`);
}

/** Build renderable embed + thumbnail URLs from a video id (spec §5.4). Pure. */
function buildYoutubeUrls(videoId) {
  return {
    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  };
}

/** ISO-8601 duration (e.g. "PT1M35S") -> seconds. Pure. */
function parseISO8601Duration(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return null;
  const [, h, min, s] = m;
  return (parseInt(h || 0, 10) * 3600) + (parseInt(min || 0, 10) * 60) + parseInt(s || 0, 10);
}

/** Resolve an @handle to a channelId (cached). */
async function resolveChannelId(handle) {
  const key = handle.replace(/^@/, '');
  if (channelIdCache.has(key)) return channelIdCache.get(key);
  const data = await ytGet('/channels', { part: 'id', forHandle: key });
  const id = data.items?.[0]?.id || null;
  if (id) channelIdCache.set(key, id);
  return id;
}

/**
 * The set of approved channelIds. Uses the pinned channelId from config; only
 * falls back to live handle resolution for any entry missing a pinned id.
 */
async function approvedChannelIds() {
  const ids = await Promise.all(
    APPROVED_CHANNELS.map((c) => (c.channelId ? c.channelId : resolveChannelId(c.handle).catch(() => null)))
  );
  return new Set(ids.filter(Boolean));
}

/**
 * Search for embeddable videos. If channelId given, restrict to that channel;
 * otherwise searches across all approved channels (spec §5.4 step 1).
 * @returns {Promise<Array<{videoId,title,channelId,channelTitle,publishedAt,description,thumbnail}>>}
 */
async function searchVideos(query, opts = {}) {
  const channelIds = opts.channelId ? [opts.channelId] : [...(await approvedChannelIds())];
  const perChannel = opts.maxResults || 5;

  const results = [];
  for (const channelId of channelIds) {
    let data;
    try {
      data = await ytGet('/search', {
        part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: perChannel, q: query, channelId
      });
    } catch (err) {
      // A single channel's transient failure must not abort curation across the
      // other approved channels — log and move on.
      logger.warn(`YouTube: search failed for channel ${channelId}, skipping — ${err.message}`);
      continue;
    }
    for (const item of data.items || []) {
      results.push({
        videoId: item.id.videoId,
        title: item.snippet.title,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.high?.url
      });
    }
  }
  return results;
}

/** Fetch full details for a video id (spec §5.4 step 4). */
async function getVideoDetails(videoId) {
  const data = await ytGet('/videos', { part: 'snippet,contentDetails,status', id: videoId });
  const item = data.items?.[0];
  if (!item) throw new Error(`YouTube: video not found: ${videoId}`);
  return {
    videoId,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    durationSeconds: parseISO8601Duration(item.contentDetails.duration),
    captionAvailable: item.contentDetails.caption === 'true',
    embeddable: item.status.embeddable !== false,
    thumbnail: item.snippet.thumbnails?.high?.url
  };
}

/**
 * Curate a video into a video_embed MediaAsset on a ContentItem.
 * Rejects videos from non-approved channels and non-embeddable videos.
 * @param {object} args { videoId, contentItemId, altText?, licenseType? }
 */
async function createVideoEmbedAsset({ videoId, contentItemId, altText, licenseType }) {
  const details = await getVideoDetails(videoId);

  const approved = await approvedChannelIds();
  if (!approved.has(details.channelId)) {
    throw new Error(`YouTube: channel "${details.channelTitle}" is not on the approved medical-channel allowlist`);
  }
  if (!details.embeddable) {
    throw new Error(`YouTube: video ${videoId} is not embeddable`);
  }

  const urls = buildYoutubeUrls(videoId);
  return MediaAsset.create({
    contentItemId,
    type: 'video_embed',
    url: urls.embedUrl,
    thumbnailUrl: urls.thumbnailUrl,
    duration: details.durationSeconds,
    youtubeVideoId: videoId,
    videoChannel: details.channelTitle,
    licenseType: licenseType || 'YouTube Standard License',
    altText: altText || details.title.slice(0, 300),
    captionAvailable: details.captionAvailable
  });
}

module.exports = {
  searchVideos, getVideoDetails, createVideoEmbedAsset, resolveChannelId, approvedChannelIds,
  buildYoutubeUrls, parseISO8601Duration, APPROVED_CHANNELS
};
