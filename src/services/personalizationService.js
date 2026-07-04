/**
 * Personalisation selection engine (CMS spec §7).
 *
 * This module is intentionally PURE: no DB, no Redis/queue, no external calls.
 * It takes already-loaded, already-eligible content + rules + a segment's
 * dimensions and returns the ordered topic list for that segment. All stateful
 * work (DB queries, the published+approved gate, writing WeeklyDelivery /
 * DeliveryTopic rows, snapshots, notifications) lives in the caller (the weekly
 * scheduler job), so this logic stays deterministic and unit-testable.
 *
 * Contract: callers MUST pass only deliverable topics (status = published AND
 * linked MedicalReview approved) in `baseTopics` and `topicsById`.
 */

// A boosted topic jumps above normal ones; stacking lets multiple boosts order
// sensibly relative to each other. ContentTopic.priority is a small int, so a
// large delta guarantees boosted topics outrank un-boosted regardless of base.
const BOOST_DELTA = 1000;

// When backfilling a short delivery, prefer these categories first so no week
// is ever empty and the staples (baby development, nutrition) lead.
const BACKFILL_CATEGORY_ORDER = ['baby_dev', 'nutrition'];

/** Does a single rule fire for this segment? Maps triggerType 1:1 to a dimension. */
function ruleMatches(rule, segment) {
  switch (rule.triggerType) {
    case 'gestational_week': return String(segment.gestationalWeek) === String(rule.triggerValue);
    case 'risk_flag':        return Array.isArray(segment.riskFlags) && segment.riskFlags.includes(rule.triggerValue);
    case 'language':         return segment.languagePreference === rule.triggerValue;
    case 'parity':           return segment.parityStatus === rule.triggerValue;
    case 'age_group':        return segment.ageGroup === rule.triggerValue;
    case 'location':         return segment.locationState === rule.triggerValue;
    default:                 return false;
  }
}

function backfillRank(topic) {
  const idx = BACKFILL_CATEGORY_ORDER.indexOf(topic.category);
  return idx === -1 ? BACKFILL_CATEGORY_ORDER.length : idx;
}

/**
 * Select and order the topics for one segment.
 *
 * @param {object}   args
 * @param {object}   args.segment      - { gestationalWeek, riskFlags[], languagePreference, parityStatus, ageGroup, locationState }
 * @param {object[]} args.baseTopics      - deliverable ContentTopics for this gestational week
 * @param {object[]} args.rules           - active PersonalizationRules (any order; sorted here)
 * @param {Map}      [args.topicsById]    - id -> ContentTopic for topics referenced by include/boost rules
 * @param {object[]} [args.fallbackTopics]- evergreen staple topics used ONLY to backfill a short
 *                                          delivery so no week is ever empty (decision: prefer
 *                                          baby_dev/nutrition). Distinct from baseTopics, which all
 *                                          seed the working set already.
 * @param {number}   [args.limit=5]       - max topics in the delivery (3-5 per spec)
 * @returns {{ topicId, topic, displayOrder, effectivePriority }[]}
 */
function selectTopicsForSegment({ segment, baseTopics = [], rules = [], topicsById = new Map(), fallbackTopics = [], limit = 5 }) {
  // 1. Seed the working set from the week's base topics.
  const working = new Map(); // id -> { topic, effectivePriority }
  for (const topic of baseTopics) {
    working.set(topic.id, { topic, effectivePriority: topic.priority || 0 });
  }

  const excluded = new Set();

  // 2. Apply rules in ascending priority (lower = evaluated first; later overrides).
  const ordered = [...rules].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  for (const rule of ordered) {
    if (!ruleMatches(rule, segment)) continue;
    const targetId = rule.contentTopicId;

    switch (rule.action) {
      case 'include': {
        const target = working.has(targetId)
          ? working.get(targetId).topic
          : topicsById.get(targetId);
        if (target) {
          if (!working.has(targetId)) {
            working.set(targetId, { topic: target, effectivePriority: target.priority || 0 });
          }
          excluded.delete(targetId); // an include after an exclude re-adds
        }
        break;
      }
      case 'exclude':
        working.delete(targetId);
        excluded.add(targetId);
        break;
      case 'boost_priority':
        // Boost only affects topics already in the set (orthogonal to include).
        if (working.has(targetId)) {
          working.get(targetId).effectivePriority += BOOST_DELTA;
        }
        break;
      default:
        break;
    }
  }

  // 3. Sort by effective priority DESC, deterministic tie-breaks.
  const selected = [...working.values()].sort(compareSelected);

  // 4. Backfill from the evergreen staple pool if short (never re-adding excluded
  //    topics), preferring baby_dev/nutrition so no week is ever empty.
  if (selected.length < limit && fallbackTopics.length) {
    const present = new Set(selected.map(s => s.topic.id));
    // Prefer fillers CLOSEST to the mother's week — otherwise a week-42 mother
    // could be backfilled with a week-1 topic (alphabetical order).
    const weekDist = (t) =>
      t.gestationalWeek == null ? 0 : Math.abs(t.gestationalWeek - (segment.gestationalWeek || 0));
    const fillers = fallbackTopics
      .filter(t => !present.has(t.id) && !excluded.has(t.id))
      .map(t => ({ topic: t, effectivePriority: t.priority || 0 }))
      .sort((a, b) =>
        weekDist(a.topic) - weekDist(b.topic) ||
        backfillRank(a.topic) - backfillRank(b.topic) ||
        (b.topic.priority || 0) - (a.topic.priority || 0) ||
        titleCmp(a.topic, b.topic)
      );
    for (const f of fillers) {
      if (selected.length >= limit) break;
      selected.push(f);
    }
  }

  // 5. Truncate to limit and assign displayOrder.
  return selected.slice(0, limit).map((s, i) => ({
    topicId: s.topic.id,
    topic: s.topic,
    displayOrder: i,
    effectivePriority: s.effectivePriority
  }));
}

function compareSelected(a, b) {
  return (
    b.effectivePriority - a.effectivePriority ||
    (b.topic.priority || 0) - (a.topic.priority || 0) ||
    titleCmp(a.topic, b.topic)
  );
}

function titleCmp(a, b) {
  return String(a.title || '').localeCompare(String(b.title || ''));
}

/**
 * Current gestational week from due date (CMS spec §7 step 13):
 *   week = 40 - ceil((dueDate - today) / 7 days)
 * Clamped to 1..42.
 */
function computeGestationalWeek(dueDate, today = new Date()) {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const days = Math.round((new Date(dueDate).getTime() - new Date(today).getTime()) / MS_PER_DAY);
  const week = 40 - Math.ceil(days / 7);
  return Math.max(1, Math.min(42, week));
}

/** The selection-relevant dimensions of a user's profile (matches rule triggers). */
function segmentDimsFromUser(user, today = new Date()) {
  return {
    gestationalWeek: computeGestationalWeek(user.edd, today),
    riskFlags: [...(user.riskFlags || [])].sort(),
    languagePreference: user.languagePreference || 'en',
    parityStatus: user.parityStatus || null,
    ageGroup: user.ageGroup || null,
    locationState: user.locationState || null
  };
}

/** Deterministic key grouping users who must receive identical selections. */
function segmentKey(dims) {
  return [
    `w:${dims.gestationalWeek}`,
    `r:${(dims.riskFlags || []).join('|')}`,
    `lang:${dims.languagePreference || ''}`,
    `par:${dims.parityStatus || ''}`,
    `age:${dims.ageGroup || ''}`,
    `loc:${dims.locationState || ''}`
  ].join(';');
}

module.exports = {
  selectTopicsForSegment,
  ruleMatches,
  computeGestationalWeek,
  segmentDimsFromUser,
  segmentKey,
  BOOST_DELTA
};
