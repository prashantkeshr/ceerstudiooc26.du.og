import { describe, it, expect } from 'vitest';
import { diffContent } from '../services/compare/diff';
import { emptyContent } from '../core/models/factory';
import type { ResumeContent } from '../core/models/types';

function base(): ResumeContent {
  return {
    ...emptyContent(),
    fullName: 'Jane Doe',
    summary: 'A summary.',
    experience: [
      { id: 'e1', role: 'Dev', company: 'Acme', location: '', start: '2020', end: '2022', current: false, bullets: ['Did a thing'] },
      { id: 'e2', role: 'Lead', company: 'Globex', location: '', start: '2022', end: '', current: true, bullets: [] },
    ],
  };
}

describe('diffContent', () => {
  it('reports no change for identical content', () => {
    expect(diffContent(base(), base()).changed).toBe(false);
  });

  it('detects changed scalar fields', () => {
    const b = base(); b.fullName = 'Jane Smith'; b.summary = 'New summary.';
    const d = diffContent(base(), b);
    expect(d.changed).toBe(true);
    expect(d.fields.map((f) => f.label)).toEqual(expect.arrayContaining(['Name', 'Summary']));
  });

  it('matches entries by id (reorder is not an add/remove)', () => {
    const b = base(); b.experience = [b.experience[1], b.experience[0]];
    expect(diffContent(base(), b).changed).toBe(false);
  });

  it('detects added, removed and modified entries', () => {
    const b = base();
    b.experience = [
      { ...b.experience[0], bullets: ['Did a different thing'] }, // modified
      { id: 'e3', role: 'New', company: 'N', location: '', start: '', end: '', current: false, bullets: [] }, // added (e2 removed)
    ];
    const list = diffContent(base(), b).lists.find((l) => l.section === 'Experience')!;
    expect(list.added.length).toBe(1);
    expect(list.removed.length).toBe(1);
    expect(list.modified.length).toBe(1);
  });
});
