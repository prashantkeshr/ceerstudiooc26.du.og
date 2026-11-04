import { describe, it, expect } from 'vitest';
import {
  uid, emptyProfile, emptyContent, newResumeProject, newCoverLetterProject, newWebsiteProject,
} from '../core/models/factory';
import { sampleProfile } from '../core/sampleData';

describe('factory', () => {
  it('uid produces unique, prefixed ids', () => {
    const a = uid('x'); const b = uid('x');
    expect(a).not.toBe(b);
    expect(a.startsWith('x_')).toBe(true);
  });

  it('emptyProfile includes v3 portfolioProjects array', () => {
    const p = emptyProfile();
    expect(Array.isArray(p.portfolioProjects)).toBe(true);
    expect(p.id).toBe('primary');
  });

  it('newResumeProject seeds snapshots and default sections', () => {
    const r = newResumeProject({ title: 'R', templateId: 'modern' });
    expect(r.type).toBe('resume');
    expect(r.data.snapshots).toEqual([]);
    expect(r.data.sectionOrder).toContain('experience');
    expect(r.data.content).toEqual(emptyContent());
  });

  it('newCoverLetterProject prefills sender from profile', () => {
    const r = newCoverLetterProject({ title: 'CL', profile: sampleProfile() });
    expect(r.type).toBe('cover-letter');
    expect(r.data.sender.name).toBe('Avery Sample');
    expect(r.data.signature).toBe('Avery Sample');
    expect(r.data.body.length).toBeGreaterThan(0);
  });

  it('newWebsiteProject snapshots content and projects from profile', () => {
    const profile = sampleProfile();
    const w = newWebsiteProject({ title: 'W', templateId: 'standard', profile });
    expect(w.type).toBe('website');
    expect(w.data.hero.headline).toContain('Avery');
    expect(w.data.projects.length).toBe(profile.portfolioProjects.length);
    expect(w.data.snapshot.experience.length).toBe(profile.experience.length);
    // snapshot is a deep copy — mutating it must not touch the profile
    w.data.snapshot.fullName = 'Changed';
    expect(profile.fullName).toBe('Avery Sample');
  });
});
