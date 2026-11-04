import { describe, it, expect } from 'vitest';
import { resumeToText } from '../services/exports/text';
import { renderPreviewHtml, generateSiteFiles } from '../services/website/generate';
import { parseBackup, buildBackup, safeFilename } from '../services/exports/backup';
import { newResumeProject, newWebsiteProject } from '../core/models/factory';
import { sampleProfile } from '../core/sampleData';

describe('resumeToText', () => {
  it('includes the name and section content in reading order', () => {
    const r = newResumeProject({ title: 'T', templateId: 'modern' });
    r.data.content.fullName = 'Jane Doe';
    r.data.content.summary = 'Builder of things.';
    r.data.content.experience = [{ id: 'e1', role: 'Dev', company: 'Acme', location: '', start: '2020', end: '2022', current: false, bullets: ['Shipped a feature'] }];
    const txt = resumeToText(r.data);
    expect(txt).toContain('JANE DOE');
    expect(txt).toContain('Builder of things.');
    expect(txt).toContain('Shipped a feature');
    expect(txt.indexOf('SUMMARY')).toBeLessThan(txt.indexOf('EXPERIENCE'));
  });
});

describe('website generator', () => {
  it('renders valid, crawlable HTML with SEO and content', () => {
    const w = newWebsiteProject({ title: 'Site', templateId: 'standard', profile: sampleProfile() });
    const html = renderPreviewHtml(w.data);
    expect(html.trim().startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta name="description"');
    expect(html).toContain('Northwind Labs');
    expect(html).toContain('OpenMetrics Dashboard');
    expect(html).toContain('id="projects"');
  });

  it('escapes HTML-special characters in user content', () => {
    const w = newWebsiteProject({ title: 'Site', templateId: 'standard', profile: sampleProfile() });
    w.data.about = 'A & B <script>x</script>';
    const html = renderPreviewHtml(w.data);
    expect(html).toContain('A &amp; B &lt;script&gt;');
    expect(html).not.toContain('<script>x</script>');
  });

  it('produces the full static file set', () => {
    const w = newWebsiteProject({ title: 'Site', templateId: 'standard', profile: sampleProfile() });
    const paths = generateSiteFiles(w.data, 'Site').map((f) => f.path);
    expect(paths).toEqual(expect.arrayContaining(['index.html', 'styles.css', 'script.js', 'sitemap.xml', 'robots.txt', 'README.md']));
  });
});

describe('backup', () => {
  it('round-trips a valid backup', () => {
    const pkg = buildBackup(sampleProfile(), []);
    const res = parseBackup(JSON.stringify(pkg));
    expect(res.ok).toBe(true);
    expect(res.backup?.profile?.fullName).toBe('Avery Sample');
  });

  it('rejects non-JSON and foreign files', () => {
    expect(parseBackup('{not json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ kind: 'something-else' })).ok).toBe(false);
  });

  it('safeFilename strips unsafe characters', () => {
    expect(safeFilename('My Resume / v2!', 'pdf')).toBe('My_Resume_v2.pdf');
  });
});
