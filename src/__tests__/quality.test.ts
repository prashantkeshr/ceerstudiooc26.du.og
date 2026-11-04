import { describe, it, expect } from 'vitest';
import { runResumeChecks } from '../services/quality/checks';
import { runWritingChecks } from '../services/quality/writing';
import { newResumeProject } from '../core/models/factory';
import type { ResumeData } from '../core/models/types';

function withContent(mut: (d: ResumeData) => void): ResumeData {
  const r = newResumeProject({ title: 'T', templateId: 'modern' });
  mut(r.data);
  return r.data;
}

describe('runResumeChecks', () => {
  it('flags a missing name as an error', () => {
    const d = withContent((d) => { d.content.fullName = ''; });
    expect(runResumeChecks(d).some((f) => f.id === 'name' && f.severity === 'error')).toBe(true);
  });

  it('flags a malformed email', () => {
    const d = withContent((d) => { d.content.fullName = 'A'; d.content.email = 'not-an-email'; });
    expect(runResumeChecks(d).some((f) => f.id === 'email-format')).toBe(true);
  });
});

describe('runWritingChecks', () => {
  it('flags a weak opener but not a strong action verb', () => {
    const d = withContent((d) => {
      d.content.experience = [{ id: 'e1', role: 'Dev', company: 'Acme', location: '', start: '', end: '', current: false,
        bullets: ['Responsible for managing the website', 'Reduced load time by 40%'] }];
    });
    const f = runWritingChecks(d);
    expect(f.some((x) => x.id.includes('weak'))).toBe(true);
    // "Reduced ... 40%" is strong + quantified → no weak/number flag on bullet index 1
    expect(f.some((x) => x.id === 'e1 · Acme-num-1' || x.id.endsWith('-num-1'))).toBe(false);
  });

  it('flags first-person pronouns in bullets', () => {
    const d = withContent((d) => {
      d.content.experience = [{ id: 'e1', role: 'Dev', company: 'Acme', location: '', start: '', end: '', current: false,
        bullets: ['I built the dashboard with 3 teammates'] }];
    });
    expect(runWritingChecks(d).some((x) => x.id.includes('-fp-'))).toBe(true);
  });
});
