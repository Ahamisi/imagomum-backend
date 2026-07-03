const axios = require('axios');
const { Op } = require('sequelize');
const { getModels } = require('../models/associations');
const logger = require('../utils/logger');

/**
 * Unsplash cover images for the Stories cover slide.
 *
 * Images are fetched at content-build time and STORED on ContentTopic.coverImageUrl
 * (never per request) — this respects the precompute rule and Unsplash rate
 * limits. To stay well under the limit we pull ONE pool of images per category
 * (photos/random?count=N) and assign them round-robin to that category's topics.
 *
 * Gated on UNSPLASH_ACCESS_KEY; a no-op (leaves placeholders) when unset.
 */

const KEY = process.env.UNSPLASH_ACCESS_KEY;
const BASE = 'https://api.unsplash.com';
const PLACEHOLDER = 'cdn.imagomum.app';

// Context search query per browse category (portrait, pregnancy-appropriate).
const CATEGORY_QUERIES = {
  baby_dev: 'pregnancy ultrasound baby',
  nutrition: 'healthy food fruit vegetables',
  antenatal_care: 'pregnant woman doctor clinic',
  warning_signs: 'pregnant woman health checkup',
  mental_health: 'calm woman peaceful wellbeing',
  exercise: 'prenatal yoga fitness',
  wellness: 'relaxation sleep self care',
  symptoms: 'pregnant woman resting',
  postpartum_prep: 'mother newborn baby'
};

function isConfigured() {
  return !!KEY;
}

/** Fetch a pool of image URLs for a query (one API call). */
async function fetchImagePool(query, count = 20) {
  if (!KEY) return [];
  try {
    const { data } = await axios.get(`${BASE}/photos/random`, {
      params: { query, count: Math.min(count, 30), orientation: 'portrait', content_filter: 'high' },
      headers: { Authorization: `Client-ID ${KEY}` },
      timeout: 20000
    });
    const list = Array.isArray(data) ? data : [data];
    return list.map((p) => p?.urls?.regular).filter(Boolean);
  } catch (err) {
    const status = err.response?.status;
    logger.warn(`unsplash: fetch failed for "${query}" (HTTP ${status || '?'}): ${err.message}`);
    return [];
  }
}

/**
 * Backfill coverImageUrl on topics that still use the placeholder. One image
 * pool per category, assigned round-robin. Idempotent (only replaces placeholders).
 * @returns {Promise<{updated:number, categories:number, skipped?:string}>}
 */
async function backfillCovers({ persist = false } = {}) {
  if (!isConfigured()) return { updated: 0, categories: 0, skipped: 'UNSPLASH_ACCESS_KEY not set' };

  const { ContentTopic } = getModels();
  const categories = await ContentTopic.findAll({
    attributes: ['category'],
    where: { coverImageUrl: { [Op.like]: `%${PLACEHOLDER}%` } },
    group: ['category']
  });

  let updated = 0;
  for (const row of categories) {
    const category = row.category;
    const pool = await fetchImagePool(CATEGORY_QUERIES[category] || 'pregnancy', 20);
    if (pool.length === 0) continue;

    const topics = await ContentTopic.findAll({
      where: { category, coverImageUrl: { [Op.like]: `%${PLACEHOLDER}%` } }
    });
    for (let i = 0; i < topics.length; i += 1) {
      if (persist) await topics[i].update({ coverImageUrl: pool[i % pool.length] });
      updated += 1;
    }
  }

  logger.info('unsplash: cover backfill complete', { updated, categories: categories.length, persist });
  return { updated, categories: categories.length };
}

module.exports = { backfillCovers, fetchImagePool, isConfigured, CATEGORY_QUERIES };
