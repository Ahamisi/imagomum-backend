const {
  buildContextBlock, buildGenerationMessages, validateDraft, CONTENT_TYPES
} = require('../src/services/contentGenerationService');

const chunks = [
  { content: 'Iron supplementation reduces anaemia.', pageFrom: 13, pageTo: 13, section: 'Recommended', documentTitle: 'WHO Maternal Health' },
  { content: 'A healthy diet contains adequate protein.', pageFrom: 10, pageTo: 11, section: 'Diet', documentTitle: 'WHO Maternal Health' }
];

describe('buildContextBlock', () => {
  it('numbers sources with page + section provenance', () => {
    const block = buildContextBlock(chunks);
    expect(block).toContain('[1] (WHO Maternal Health, p.13 — Recommended)');
    expect(block).toContain('[2] (WHO Maternal Health, pp.10-11 — Diet)');
    expect(block).toContain('Iron supplementation reduces anaemia.');
  });
});

describe('buildGenerationMessages', () => {
  it('produces system+user messages embedding the context and JSON contract', () => {
    const msgs = buildGenerationMessages({ topic: 'anaemia', contentType: 'nutrition' }, 'CTX');
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].content).toContain('CTX');
    expect(msgs[1].content).toContain('"contentType"');
    expect(msgs[1].content).toContain('anaemia');
  });
});

describe('validateDraft', () => {
  const good = {
    title: 'Eating well to prevent anaemia',
    body: 'Eat iron-rich foods. \n\nSources: [1]',
    contentType: 'nutrition',
    gestationalWeekMin: 12, gestationalWeekMax: 16, trimester: 2,
    culturalContext: 'nigerian', tags: ['anaemia', 'iron'], citations: [1, 2]
  };

  it('accepts a well-formed draft', () => {
    const { ok, value } = validateDraft(good);
    expect(ok).toBe(true);
    expect(value.contentType).toBe('nutrition');
    expect(value.citations).toEqual([1, 2]);
  });

  it('rejects an invalid contentType', () => {
    const { ok, errors } = validateDraft({ ...good, contentType: 'made_up' });
    expect(ok).toBe(false);
    expect(errors.join()).toMatch(/contentType invalid/);
  });

  it('clamps out-of-range weeks to null and defaults bad culturalContext', () => {
    const { value } = validateDraft({ ...good, gestationalWeekMin: 99, culturalContext: 'martian' });
    expect(value.gestationalWeekMin).toBeNull();
    expect(value.culturalContext).toBe('universal');
  });

  it('flags missing title/body', () => {
    const { ok, errors } = validateDraft({ contentType: 'tip' });
    expect(ok).toBe(false);
    expect(errors.join()).toMatch(/title missing/);
    expect(errors.join()).toMatch(/body missing/);
  });

  it('exposes the ContentItem contentType enum', () => {
    expect(CONTENT_TYPES).toContain('warning_sign');
    expect(CONTENT_TYPES).toHaveLength(8);
  });
});
