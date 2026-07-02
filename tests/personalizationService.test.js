const {
  selectTopicsForSegment,
  ruleMatches,
  computeGestationalWeek,
  segmentDimsFromUser,
  segmentKey,
  BOOST_DELTA
} = require('../src/services/personalizationService');

// --- helpers -------------------------------------------------------------
let n = 0;
const topic = (over = {}) => ({
  id: over.id || `t${++n}`,
  title: over.title || `Topic ${n}`,
  category: over.category || 'nutrition',
  gestationalWeek: over.gestationalWeek ?? 24,
  priority: over.priority ?? 0,
  ...over
});
const rule = (over) => ({
  id: over.id || `r${Math.random()}`,
  triggerType: over.triggerType,
  triggerValue: over.triggerValue,
  contentTopicId: over.contentTopicId,
  action: over.action,
  priority: over.priority ?? 0,
  active: true
});
const baseSegment = (over = {}) => ({
  gestationalWeek: 24,
  riskFlags: [],
  languagePreference: 'en',
  parityStatus: 'primigravida',
  ageGroup: '26-30',
  locationState: 'Lagos',
  ...over
});

// --- ruleMatches ---------------------------------------------------------
describe('ruleMatches', () => {
  const seg = baseSegment({ riskFlags: ['gestational_diabetes', 'anemia'] });

  test('matches each trigger dimension', () => {
    expect(ruleMatches(rule({ triggerType: 'gestational_week', triggerValue: '24' }), seg)).toBe(true);
    expect(ruleMatches(rule({ triggerType: 'risk_flag', triggerValue: 'gestational_diabetes' }), seg)).toBe(true);
    expect(ruleMatches(rule({ triggerType: 'language', triggerValue: 'en' }), seg)).toBe(true);
    expect(ruleMatches(rule({ triggerType: 'parity', triggerValue: 'primigravida' }), seg)).toBe(true);
    expect(ruleMatches(rule({ triggerType: 'age_group', triggerValue: '26-30' }), seg)).toBe(true);
    expect(ruleMatches(rule({ triggerType: 'location', triggerValue: 'Lagos' }), seg)).toBe(true);
  });

  test('does not match wrong values / absent risk flag', () => {
    expect(ruleMatches(rule({ triggerType: 'gestational_week', triggerValue: '25' }), seg)).toBe(false);
    expect(ruleMatches(rule({ triggerType: 'risk_flag', triggerValue: 'hypertension' }), seg)).toBe(false);
    expect(ruleMatches(rule({ triggerType: 'language', triggerValue: 'yo' }), seg)).toBe(false);
  });
});

// --- selectTopicsForSegment ---------------------------------------------
describe('selectTopicsForSegment', () => {
  test('returns base topics ordered by priority DESC, capped at limit', () => {
    const baseTopics = [
      topic({ id: 'a', priority: 1 }),
      topic({ id: 'b', priority: 5 }),
      topic({ id: 'c', priority: 3 })
    ];
    const out = selectTopicsForSegment({ segment: baseSegment(), baseTopics, rules: [], limit: 5 });
    expect(out.map(o => o.topicId)).toEqual(['b', 'c', 'a']);
    expect(out.map(o => o.displayOrder)).toEqual([0, 1, 2]);
  });

  test('include pulls in a topic not in the base week set', () => {
    const base = [topic({ id: 'base', priority: 1 })];
    const gdm = topic({ id: 'gdm', priority: 2, category: 'warning_signs' });
    const rules = [rule({ triggerType: 'risk_flag', triggerValue: 'gestational_diabetes', contentTopicId: 'gdm', action: 'include', priority: 10 })];
    const out = selectTopicsForSegment({
      segment: baseSegment({ riskFlags: ['gestational_diabetes'] }),
      baseTopics: base, rules, topicsById: new Map([['gdm', gdm]])
    });
    expect(out.map(o => o.topicId).sort()).toEqual(['base', 'gdm']);
  });

  test('include does nothing when the rule does not match the segment', () => {
    const base = [topic({ id: 'base' })];
    const gdm = topic({ id: 'gdm' });
    const rules = [rule({ triggerType: 'risk_flag', triggerValue: 'gestational_diabetes', contentTopicId: 'gdm', action: 'include' })];
    const out = selectTopicsForSegment({
      segment: baseSegment({ riskFlags: [] }), // no GDM
      baseTopics: base, rules, topicsById: new Map([['gdm', gdm]])
    });
    expect(out.map(o => o.topicId)).toEqual(['base']);
  });

  test('exclude removes a topic', () => {
    const base = [topic({ id: 'keep', priority: 1 }), topic({ id: 'drop', priority: 9 })];
    const rules = [rule({ triggerType: 'language', triggerValue: 'en', contentTopicId: 'drop', action: 'exclude' })];
    const out = selectTopicsForSegment({ segment: baseSegment(), baseTopics: base, rules });
    expect(out.map(o => o.topicId)).toEqual(['keep']);
  });

  test('boost_priority lifts a matched topic above higher-priority ones', () => {
    const base = [topic({ id: 'normal', priority: 8 }), topic({ id: 'boostme', priority: 1 })];
    const rules = [rule({ triggerType: 'gestational_week', triggerValue: '24', contentTopicId: 'boostme', action: 'boost_priority' })];
    const out = selectTopicsForSegment({ segment: baseSegment(), baseTopics: base, rules });
    expect(out[0].topicId).toBe('boostme');
    expect(out[0].effectivePriority).toBe(1 + BOOST_DELTA);
  });

  test('later (higher-priority) rule overrides earlier one (exclude wins after include)', () => {
    const base = [];
    const x = topic({ id: 'x' });
    const rules = [
      rule({ triggerType: 'language', triggerValue: 'en', contentTopicId: 'x', action: 'include', priority: 1 }),
      rule({ triggerType: 'language', triggerValue: 'en', contentTopicId: 'x', action: 'exclude', priority: 2 })
    ];
    const out = selectTopicsForSegment({ segment: baseSegment(), baseTopics: base, rules, topicsById: new Map([['x', x]]) });
    expect(out).toHaveLength(0);
  });

  test('backfill draws from the fallback pool when base is short, staples first, skipping excluded', () => {
    const base = [topic({ id: 'main', priority: 5 })]; // only 1 base topic, limit 3
    const fallbackTopics = [
      topic({ id: 'nutri', category: 'nutrition', priority: 2 }),
      topic({ id: 'baby', category: 'baby_dev', priority: 1 }),
      topic({ id: 'mh', category: 'mental_health', priority: 9 }),
      topic({ id: 'banned', category: 'baby_dev', priority: 100 })
    ];
    // exclude a fallback topic to prove excluded items are never backfilled
    const rules = [rule({ triggerType: 'language', triggerValue: 'en', contentTopicId: 'banned', action: 'exclude' })];
    const out = selectTopicsForSegment({ segment: baseSegment(), baseTopics: base, rules, fallbackTopics, limit: 3 });
    expect(out.map(o => o.topicId)).not.toContain('banned');
    expect(out).toHaveLength(3);
    // base topic leads; backfill then adds baby_dev before nutrition (category preference)
    expect(out.map(o => o.topicId)).toEqual(['main', 'baby', 'nutri']);
  });

  test('short base with no fallback pool just returns what exists', () => {
    const base = [topic({ id: 'only', priority: 1 })];
    const out = selectTopicsForSegment({ segment: baseSegment(), baseTopics: base, rules: [], limit: 5 });
    expect(out.map(o => o.topicId)).toEqual(['only']);
  });

  test('is deterministic across runs', () => {
    const mk = () => selectTopicsForSegment({
      segment: baseSegment(),
      baseTopics: [topic({ id: 'p', priority: 3 }), topic({ id: 'q', priority: 3 })],
      rules: []
    });
    expect(mk().map(o => o.topicId)).toEqual(mk().map(o => o.topicId));
  });
});

// --- gestational week + segment key -------------------------------------
describe('computeGestationalWeek', () => {
  test('due in ~16 weeks => around week 24', () => {
    const today = new Date('2026-06-01');
    const due = new Date('2026-09-21'); // ~16 weeks (112 days) out
    expect(computeGestationalWeek(due, today)).toBe(24);
  });
  test('clamps to 1..42', () => {
    const today = new Date('2026-06-01');
    expect(computeGestationalWeek(new Date('2027-06-01'), today)).toBe(1); // far future
    expect(computeGestationalWeek(new Date('2026-05-25'), today)).toBe(41); // already past-ish
  });
});

describe('segmentDimsFromUser / segmentKey', () => {
  test('sorts risk flags so key is order-independent', () => {
    const today = new Date('2026-06-01');
    const u1 = { edd: '2026-09-21', riskFlags: ['anemia', 'gestational_diabetes'], languagePreference: 'yo', parityStatus: 'multigravida', ageGroup: '31-35', locationState: 'Kano' };
    const u2 = { ...u1, riskFlags: ['gestational_diabetes', 'anemia'] };
    expect(segmentKey(segmentDimsFromUser(u1, today))).toBe(segmentKey(segmentDimsFromUser(u2, today)));
  });

  test('different week => different segment key', () => {
    const today = new Date('2026-06-01');
    const a = segmentDimsFromUser({ edd: '2026-09-21', languagePreference: 'en' }, today);
    const b = segmentDimsFromUser({ edd: '2026-10-21', languagePreference: 'en' }, today);
    expect(segmentKey(a)).not.toBe(segmentKey(b));
  });
});
