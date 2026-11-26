import { describe, it, expect } from 'vitest';
import { runResumeChecks } from '../services/quality/checks';
import { runWritingChecks } from '../services/quality/writing';
import { runCoverLetterChecks } from '../services/quality/coverLetterChecks';
import { newResumeProject } from '../core/models/factory';
import type { ResumeData, CoverLetterData } from '../core/models/types';

function baseLetter(mut?: (d: CoverLetterData) => void): CoverLetterData {
  const d: CoverLetterData = {
    design: { accent: '#2563eb', fontFamily: 'georgia', fontScale: 1, lineHeight: 1.5, pageSize: 'a4' },
    sender: { name: 'Avery Lee', title: 'Engineer', email: 'avery@example.com', phone: '555', location: '', website: '' },
    recipient: { name: 'Pat Rao', title: 'Hiring Manager', company: 'Acme', address: '' },
    date: 'January 1, 2026',
    subject: '',
    salutation: 'Dear Ms. Rao,',
    body: [('I would love to join Acme and contribute to the team. '.repeat(20)).trim()],
    closing: 'Sincerely,',
    signature: 'Avery Lee',
  };
  mut?.(d);
  return d;
}

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

describe('runCoverLetterChecks', () => {
  it('passes a well-formed letter', () => {
    const f = runCoverLetterChecks(baseLetter());
    expect(f.some((x) => x.severity === 'error' || x.severity === 'warning')).toBe(false);
  });

  it('flags a missing sender name as an error', () => {
    const f = runCoverLetterChecks(baseLetter((d) => { d.sender.name = ''; }));
    expect(f.some((x) => x.id === 'sender-name' && x.severity === 'error')).toBe(true);
  });

  it('flags leftover template placeholders', () => {
    const f = runCoverLetterChecks(baseLetter((d) => { d.body = ['I want to join [company] as an engineer.']; }));
    expect(f.some((x) => x.id === 'placeholder' && x.severity === 'warning')).toBe(true);
  });

  it('flags when the company is not named in the body', () => {
    const f = runCoverLetterChecks(baseLetter((d) => { d.body = ['I am excited to apply for this role and bring strong skills.'.repeat(5)]; d.recipient.company = 'Globex'; }));
    expect(f.some((x) => x.id === 'body-company')).toBe(true);
  });

  it('flags a generic salutation', () => {
    const f = runCoverLetterChecks(baseLetter((d) => { d.salutation = 'To whom it may concern'; }));
    expect(f.some((x) => x.id === 'salutation-generic')).toBe(true);
  });
});
