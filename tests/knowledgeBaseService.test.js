const { chunkMarkdown } = require('../src/services/knowledgeBaseService');

describe('chunkMarkdown', () => {
  const pages = [
    {
      page: 1,
      markdown:
        '# Anaemia in Pregnancy\n\n' +
        'Iron deficiency is the most common cause of anaemia in pregnancy.\n\n' +
        '## Screening\n\n' +
        '| Test | Trimester | Cutoff |\n| --- | --- | --- |\n| Hb | 1st | 11 g/dL |\n| Hb | 3rd | 10.5 g/dL |'
    },
    {
      page: 2,
      markdown: 'Continue iron supplementation for women at risk through the second trimester.'
    }
  ];

  it('produces ordered chunks with correct chunkIndex', () => {
    const chunks = chunkMarkdown(pages, { targetTokens: 40, overlapTokens: 8 });
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('tags chunks with the nearest heading as section, persisting across pages', () => {
    const chunks = chunkMarkdown(pages, { targetTokens: 40, overlapTokens: 8 });
    // First chunk falls under the top-level heading.
    expect(chunks[0].metadata.section).toBe('Anaemia in Pregnancy');
    // A heading governs content until the next heading — the page-2 text has no
    // heading of its own, so it inherits 'Screening' from page 1.
    const lastChunk = chunks[chunks.length - 1];
    expect(lastChunk.metadata.section).toBe('Screening');
    expect(lastChunk.pageFrom).toBe(2);
  });

  it('keeps a Markdown table intact within a single chunk', () => {
    const chunks = chunkMarkdown(pages, { targetTokens: 200, overlapTokens: 0 });
    const tableChunk = chunks.find((c) => c.content.includes('| Hb |'));
    expect(tableChunk).toBeDefined();
    // Both table rows land in the same chunk (table never split mid-row).
    expect((tableChunk.content.match(/\| Hb \|/g) || []).length).toBe(2);
  });

  it('records page provenance (pageFrom/pageTo)', () => {
    const chunks = chunkMarkdown(pages, { targetTokens: 1000, overlapTokens: 0 });
    expect(chunks[0].pageFrom).toBe(1);
    expect(chunks[chunks.length - 1].pageTo).toBe(2);
  });

  it('returns an empty array for empty input', () => {
    expect(chunkMarkdown([])).toEqual([]);
    expect(chunkMarkdown([{ page: 1, markdown: '' }])).toEqual([]);
  });
});
