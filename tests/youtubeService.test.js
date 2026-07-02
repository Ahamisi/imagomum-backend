const { buildYoutubeUrls, parseISO8601Duration, APPROVED_CHANNELS } = require('../src/services/youtubeService');

describe('buildYoutubeUrls', () => {
  it('constructs embed + thumbnail URLs from a video id (spec §5.4 patterns)', () => {
    const { embedUrl, thumbnailUrl } = buildYoutubeUrls('abc123');
    expect(embedUrl).toBe('https://www.youtube.com/embed/abc123?rel=0&modestbranding=1');
    expect(thumbnailUrl).toBe('https://img.youtube.com/vi/abc123/hqdefault.jpg');
  });
});

describe('parseISO8601Duration', () => {
  it.each([
    ['PT1M35S', 95],
    ['PT45S', 45],
    ['PT2M', 120],
    ['PT1H2M3S', 3723],
    ['PT0S', 0]
  ])('parses %s -> %i seconds', (iso, secs) => {
    expect(parseISO8601Duration(iso)).toBe(secs);
  });

  it('returns null for malformed input', () => {
    expect(parseISO8601Duration('nonsense')).toBeNull();
    expect(parseISO8601Duration('')).toBeNull();
  });
});

describe('APPROVED_CHANNELS', () => {
  it('is the spec §5.1 medical-channel allowlist', () => {
    const handles = APPROVED_CHANNELS.map((c) => c.handle);
    expect(handles).toEqual(expect.arrayContaining(['WHO', 'nhsengland', 'TommysCharity', 'marchofdimes', 'ACOG']));
  });
});
