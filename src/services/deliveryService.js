const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { getModels } = require('../models/associations');
const { selectTopicsForSegment, segmentDimsFromUser, segmentKey } = require('./personalizationService');
const { dispatchNotification } = require('./notificationService');
const logger = require('../utils/logger');

/**
 * Weekly delivery engine (CMS spec §2.3 / §7).
 *
 * Precomputes each active mother's personalised WeeklyDelivery from the local
 * PUBLISHED + medically-APPROVED library — no external call on any per-user path.
 *
 * Uses PER-SEGMENT compute + fan-out: mothers who share the selection-relevant
 * profile dimensions (gestational week + rule triggers) get an identical
 * selection, so we run the (heavy) rule evaluation once per distinct segmentKey
 * and fan out cheap WeeklyDelivery/DeliveryTopic rows per user. The immutable
 * personalizationSnapshot records the profile used, for audit.
 */

const { User, ContentTopic, ContentItem, MedicalReview, PersonalizationRule, WeeklyDelivery, DeliveryTopic } = getModels();

const FALLBACK_CATEGORIES = ['baby_dev', 'nutrition']; // evergreen staples for backfill

// A ContentTopic is deliverable when it has >=1 ContentItem that is published
// AND whose linked MedicalReview is approved. This is the spec §8 hard gate,
// enforced in the query itself (not by convention).
const deliverableItemInclude = {
  model: ContentItem,
  as: 'contentItems',
  required: true,
  where: { status: 'published' },
  include: [{ model: MedicalReview, as: 'review', required: true, where: { status: 'approved' } }]
};

async function loadDeliverableTopics(where) {
  return ContentTopic.findAll({ where, include: [deliverableItemInclude] });
}

/**
 * Run the weekly delivery batch.
 * @param {object} [opts]
 * @param {Date}    [opts.now]        - "now" for gestational-week math + scheduledAt
 * @param {number}  [opts.limit=5]    - max topics per delivery
 * @param {boolean} [opts.dryRun]     - compute + report without writing
 * @returns {Promise<{users:number, created:number, skipped:number, segments:number}>}
 */
async function runWeeklyDeliveries({ now = new Date(), limit = 5, dryRun = false } = {}) {
  const users = await User.findAll({ where: { edd: { [Op.ne]: null }, onboardingCompleted: true } });
  const rules = await PersonalizationRule.findAll({ where: { active: true } });

  // Topics referenced by include/boost rules may live outside the week's base set.
  const ruleTopicIds = [...new Set(rules.map((r) => r.contentTopicId).filter(Boolean))];
  const [ruleTopics, fallbackTopics] = await Promise.all([
    ruleTopicIds.length ? loadDeliverableTopics({ id: { [Op.in]: ruleTopicIds } }) : [],
    loadDeliverableTopics({ category: { [Op.in]: FALLBACK_CATEGORIES } })
  ]);
  const topicsById = new Map(ruleTopics.map((t) => [t.id, t]));

  const segmentCache = new Map(); // segmentKey -> selected[]
  let created = 0;
  let skipped = 0;

  for (const user of users) {
    const dims = segmentDimsFromUser(user, now);
    const key = segmentKey(dims);

    if (!segmentCache.has(key)) {
      const baseTopics = await loadDeliverableTopics({ gestationalWeek: dims.gestationalWeek });
      segmentCache.set(key, selectTopicsForSegment({ segment: dims, baseTopics, rules, topicsById, fallbackTopics, limit }));
    }
    const selected = segmentCache.get(key);

    if (selected.length === 0) { skipped += 1; continue; } // nothing deliverable this week

    // Idempotent: one delivery per user per gestational week.
    const existing = await WeeklyDelivery.findOne({ where: { userId: user.id, gestationalWeek: dims.gestationalWeek } });
    if (existing) { skipped += 1; continue; }
    if (dryRun) { created += 1; continue; }

    const delivery = await sequelize.transaction(async (tx) => {
      const d = await WeeklyDelivery.create({
        userId: user.id,
        gestationalWeek: dims.gestationalWeek,
        scheduledAt: now,
        status: 'scheduled',
        personalizationSnapshot: dims
      }, { transaction: tx });
      await DeliveryTopic.bulkCreate(
        selected.map((s) => ({ deliveryId: d.id, topicId: s.topicId, displayOrder: s.displayOrder })),
        { transaction: tx }
      );
      return d;
    });

    // Notify + mark delivered (outside the tx; a failed send won't undo the delivery).
    const res = await dispatchNotification(user, delivery);
    if (res.sent) {
      delivery.status = 'delivered';
      delivery.deliveredAt = new Date();
      await delivery.save();
    }
    created += 1;
  }

  logger.info('delivery: weekly run complete', { users: users.length, created, skipped, segments: segmentCache.size, dryRun });
  return { users: users.length, created, skipped, segments: segmentCache.size };
}

/**
 * Fetch a user's current delivery, fully nested for the mobile Stories UI
 * (spec §10). Only published + approved items and their media are included.
 * Optionally transitions delivered -> opened.
 */
async function getCurrentDelivery(userId, { markOpened = true } = {}) {
  const delivery = await WeeklyDelivery.findOne({
    where: { userId },
    order: [['scheduledAt', 'DESC']],
    subQuery: false, // deep nested includes + implicit LIMIT otherwise break the join aliases
    include: [{
      model: ContentTopic,
      as: 'topics',
      through: { attributes: ['displayOrder'] },
      include: [{
        model: ContentItem,
        as: 'contentItems',
        required: false,
        where: { status: 'published' },
        through: { attributes: ['displayOrder'] },
        include: [
          { model: MedicalReview, as: 'review', required: true, where: { status: 'approved' } },
          { model: getModels().MediaAsset, as: 'mediaAssets', required: false }
        ]
      }]
    }]
  });

  if (!delivery) return null;

  if (markOpened && delivery.status === 'delivered') {
    delivery.status = 'opened';
    await delivery.save();
  }
  return delivery;
}

module.exports = { runWeeklyDeliveries, getCurrentDelivery, loadDeliverableTopics };
