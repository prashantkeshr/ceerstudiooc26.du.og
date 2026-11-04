import { describe, it, expect } from 'vitest';
import { buildDocFromBlocks, buildContentFromExtraction, type ImportBlock } from '../services/imports/docxImport';

describe('import pipeline', () => {
  const blocks: ImportBlock[] = [
    { kind: 'heading', text: 'Jane Doe' },
    { kind: 'para', text: 'jane@example.com | linkedin.com/in/janedoe' },
    { kind: 'heading', text: 'Experience' },
    { kind: 'para', text: 'Senior Developer — Acme 2020 – 2023' },
    { kind: 'bullet', text: 'Shipped the platform' },
    { kind: 'bullet', text: 'Reduced errors by 40%' },
    { kind: 'heading', text: 'Skills' },
    { kind: 'para', text: 'Languages: TypeScript, Go' },
  ];

  it('buildDocFromBlocks finds the name, contact line and sections', () => {
    const doc = buildDocFromBlocks(blocks);
    expect(doc.name).toBe('Jane Doe');
    expect(doc.contactLine).toContain('jane@example.com');
    expect(doc.sections.map((s) => s.key)).toEqual(expect.arrayContaining(['experience', 'skills']));
  });

  it('buildContentFromExtraction parses entries, dates and skills', () => {
    const c = buildContentFromExtraction(buildDocFromBlocks(blocks));
    expect(c.fullName).toBe('Jane Doe');
    expect(c.email).toBe('jane@example.com');
    expect(c.experience.length).toBe(1);
    const e = c.experience[0];
    expect(e.role).toBe('Senior Developer');
    expect(e.company).toBe('Acme');
    expect([e.start, e.end]).toEqual(['2020', '2023']);
    expect(e.bullets.length).toBe(2);
    expect(c.skills[0].skills).toEqual(['TypeScript', 'Go']);
  });
});
