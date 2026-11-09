import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { FontKey, ProjectEnvelope, WebsiteData, WebsiteProject, WebsiteSectionKey } from '../../core/models/types';
import { useStore } from '../../state/store';
import * as dbApi from '../../core/storage/db';
import { migrateProject } from '../../core/migrations/migrate';
import { contentFromProfile } from '../../core/models/factory';
import { renderPreviewHtml, zipSite } from '../../services/website/generate';
import { safeFilename } from '../../services/exports/backup';
import { Icon } from '../../components/ui/Icon';

const FONTS: { key: FontKey; label: string }[] = [
  { key: 'inter', label: 'Inter' }, { key: 'arial', label: 'Arial' },
  { key: 'georgia', label: 'Georgia' }, { key: 'times', label: 'Times' }, { key: 'jetbrains', label: 'JetBrains Mono' },
];
const TEMPLATES = [
  { id: 'standard', name: 'Standard', desc: 'Top nav, centered content.' },
  { id: 'sidebar', name: 'Sidebar', desc: 'Fixed left sidebar with nav.' },
  { id: 'minimal', name: 'Minimal', desc: 'Lots of whitespace, quiet headings.' },
];
const ACCENTS = ['#2563eb', '#0d9488', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#111827'];
const SECTION_LABEL: Record<WebsiteSectionKey, string> = { about: 'About', skills: 'Skills', experience: 'Experience', education: 'Education', projects: 'Projects', contact: 'Contact' };

const DEVICES = { desktop: 0, tablet: 834, mobile: 390 } as const;
type Device = keyof typeof DEVICES;
type Pane = 'content' | 'preview' | 'design';

export function WebsiteStudio() {
  const { id = '' } = useParams();
  const { profile, refreshProjects } = useStore();
  const [project, setProject] = useState<WebsiteProject | null>(null);
  const [missing, setMissing] = useState(false);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [pane, setPane] = useState<Pane>('content');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = (await dbApi.getProject(id)) as ProjectEnvelope | null;
      if (cancelled) return;
      if (!rec || rec.type !== 'website') { setMissing(true); return; }
      setProject(migrateProject(rec).project as WebsiteProject);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const saveTimer = useRef<number | undefined>(undefined);
  const patch = useCallback((fn: (d: WebsiteData) => WebsiteData) => {
    setProject((prev) => {
      if (!prev) return prev;
      const next: WebsiteProject = { ...prev, data: fn(prev.data), updatedAt: Date.now() };
      setSave('saving');
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        try { await dbApi.saveProject(next); setSave('saved'); refreshProjects(); } catch { setSave('error'); }
      }, 500);
      return next;
    });
  }, [refreshProjects]);

  const setTitle = (title: string) => setProject((p) => { if (!p) return p; const n = { ...p, title, updatedAt: Date.now() }; dbApi.saveProject(n).then(refreshProjects); return n; });

  const previewHtml = useMemo(() => (project ? renderPreviewHtml(project.data) : ''), [project]);

  const downloadZip = async () => {
    if (!project) return;
    setBusy('Building ZIP…');
    try {
      const blob = await zipSite(project.data, project.title);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = safeFilename(project.title, 'zip');
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { alert('Could not build the website ZIP.'); } finally { setBusy(null); }
  };

  const openPreviewTab = () => {
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  if (missing) return (
    <div className="content" style={{ textAlign: 'center', paddingTop: 50 }}>
      <h2>Website not found</h2><Link className="btn btn-primary" to="/">Back to dashboard</Link>
    </div>
  );
  if (!project) return <div className="content" style={{ paddingTop: 50, textAlign: 'center' }}><p className="muted">Loading…</p></div>;

  const d = project.data;
  const saveText = save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved locally' : save === 'error' ? 'Save failed' : '';
  const setD = (patchObj: Partial<WebsiteData>) => patch((prev) => ({ ...prev, ...patchObj }));
  const deviceW = DEVICES[device];

  return (
    <div>
      <div className="panel-head no-print" style={{ position: 'sticky', top: 53, gap: 10 }}>
        <Link className="btn btn-sm btn-ghost btn-icon" to="/" aria-label="Back"><Icon name="home" /></Link>
        <input className="input" style={{ maxWidth: 300, fontWeight: 600 }} value={project.title} onChange={(e) => setTitle(e.target.value)} aria-label="Website title" />
        <span className="save-pill" role="status" aria-live="polite"><span className={`save-dot ${save}`} />{busy ?? saveText}</span>
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Preview device">
          {(Object.keys(DEVICES) as Device[]).map((dv) => <button key={dv} className={device === dv ? 'active' : ''} onClick={() => setDevice(dv)} style={{ textTransform: 'capitalize' }}>{dv}</button>)}
        </div>
        <button className="btn btn-sm btn-ghost" onClick={openPreviewTab}><Icon name="eye" size={15} /> Open</button>
        <button className="btn btn-sm btn-primary" onClick={downloadZip}><Icon name="download" size={15} /> Download ZIP</button>
      </div>

      <div className="studio-tabs no-print">
        {(['content', 'preview', 'design'] as Pane[]).map((p) => <button key={p} className={pane === p ? 'active' : ''} onClick={() => setPane(p)} style={{ textTransform: 'capitalize' }}>{p}</button>)}
      </div>

      <div className="studio">
        {/* Content */}
        <div className={`studio-panel studio-pane ${pane === 'content' ? 'active' : ''}`}>
          <div className="panel-head no-print">Content</div>
          <div className="panel-pad">
            <h4 style={{ margin: '0 0 8px' }}>Hero</h4>
            <div className="field"><label>Headline</label><input className="input" value={d.hero.headline} onChange={(e) => setD({ hero: { ...d.hero, headline: e.target.value } })} /></div>
            <div className="field"><label>Tagline</label><input className="input" value={d.hero.tagline} onChange={(e) => setD({ hero: { ...d.hero, tagline: e.target.value } })} /></div>
            <div className="field"><label>About</label><textarea className="textarea" rows={4} value={d.about} onChange={(e) => setD({ about: e.target.value })} /></div>

            <h4 style={{ margin: '16px 0 8px' }}>Sections</h4>
            <div className="stack" style={{ gap: 6 }}>
              {d.sections.map((s, i) => (
                <div className="row" key={s.key} style={{ gap: 4, opacity: s.visible ? 1 : 0.55 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{SECTION_LABEL[s.key]}</span>
                  <button className="btn btn-sm btn-ghost btn-icon" aria-label="Up" disabled={i === 0} onClick={() => setD({ sections: (() => { const a = d.sections.slice(); [a[i], a[i - 1]] = [a[i - 1], a[i]]; return a; })() })}><Icon name="chevron-up" size={15} /></button>
                  <button className="btn btn-sm btn-ghost btn-icon" aria-label="Down" disabled={i === d.sections.length - 1} onClick={() => setD({ sections: (() => { const a = d.sections.slice(); [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; })() })}><Icon name="chevron-down" size={15} /></button>
                  <button className="btn btn-sm btn-ghost btn-icon" aria-label={s.visible ? 'Hide' : 'Show'} onClick={() => setD({ sections: d.sections.map((x) => x.key === s.key ? { ...x, visible: !x.visible } : x) })}><Icon name={s.visible ? 'eye' : 'eye-off'} size={15} /></button>
                </div>
              ))}
            </div>

            <h4 style={{ margin: '16px 0 8px' }}>Featured projects <span className="faint" style={{ fontWeight: 400, fontSize: 12 }}>({d.projects.length})</span></h4>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Edit project details in <Link to="/portfolio">Portfolio Studio</Link>, then sync here.</p>
            <button className="btn btn-sm" onClick={() => setD({ projects: structuredClone(profile.portfolioProjects ?? []) })}><Icon name="copy" size={14} /> Sync from Portfolio</button>
            <div className="stack" style={{ gap: 6, marginTop: 8 }}>
              {d.projects.map((p, i) => (
                <div className="row" key={p.id} style={{ gap: 4 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || 'Untitled'}</span>
                  <button className="btn btn-sm btn-ghost btn-icon" aria-label="Up" disabled={i === 0} onClick={() => setD({ projects: (() => { const a = d.projects.slice(); [a[i], a[i - 1]] = [a[i - 1], a[i]]; return a; })() })}><Icon name="chevron-up" size={15} /></button>
                  <button className="btn btn-sm btn-ghost btn-icon" aria-label="Down" disabled={i === d.projects.length - 1} onClick={() => setD({ projects: (() => { const a = d.projects.slice(); [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; })() })}><Icon name="chevron-down" size={15} /></button>
                  <button className="btn btn-sm btn-ghost btn-icon btn-danger" aria-label="Remove" onClick={() => setD({ projects: d.projects.filter((x) => x.id !== p.id) })}><Icon name="x" size={15} /></button>
                </div>
              ))}
            </div>

            <h4 style={{ margin: '16px 0 8px' }}>Content source</h4>
            <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Name, contact, skills, experience and education come from a snapshot of your Career Profile.</p>
            <button className="btn btn-sm" onClick={() => setD({ snapshot: contentFromProfile(profile) })}><Icon name="user" size={14} /> Sync content from Profile</button>

            <h4 style={{ margin: '16px 0 8px' }}>SEO</h4>
            <div className="field"><label>Page title</label><input className="input" value={d.seo.title} onChange={(e) => setD({ seo: { ...d.seo, title: e.target.value } })} /></div>
            <div className="field"><label>Meta description</label><textarea className="textarea" rows={2} value={d.seo.description} onChange={(e) => setD({ seo: { ...d.seo, description: e.target.value } })} /><span className="faint" style={{ fontSize: 11 }}>{d.seo.description.length}/160</span></div>
            <div className="entry-grid">
              <div className="field"><label>Favicon letter</label><input className="input" maxLength={2} value={d.seo.favicon} onChange={(e) => setD({ seo: { ...d.seo, favicon: e.target.value } })} /></div>
              <div className="field"><label>Social image URL</label><input className="input" value={d.seo.ogImage} onChange={(e) => setD({ seo: { ...d.seo, ogImage: e.target.value } })} /></div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className={`studio-center studio-pane ${pane === 'preview' ? 'active' : ''}`} style={{ display: 'flex', justifyContent: 'center', padding: 16, overflow: 'auto' }}>
          <iframe
            title="Website preview"
            srcDoc={previewHtml}
            style={{ width: deviceW ? `${deviceW}px` : '100%', maxWidth: '100%', height: 'calc(100vh - 110px)', border: '1px solid var(--border)', borderRadius: deviceW ? 14 : 6, background: '#fff', boxShadow: deviceW ? 'var(--shadow-lg)' : 'none' }}
          />
        </div>

        {/* Design */}
        <div className={`studio-panel studio-pane ${pane === 'design' ? 'active' : ''}`}>
          <div className="panel-head no-print">Design</div>
          <div className="panel-pad">
            <h4 style={{ marginBottom: 8 }}>Template</h4>
            <div className="stack" style={{ gap: 6 }}>
              {TEMPLATES.map((t) => (
                <button key={t.id} className={`tpl-opt ${d.templateId === t.id ? 'active' : ''}`} onClick={() => setD({ templateId: t.id })}>
                  <strong>{t.name}</strong><span>{t.desc}</span>
                </button>
              ))}
            </div>
            <h4 style={{ margin: '18px 0 8px' }}>Accent</h4>
            <div className="swatches">
              {ACCENTS.map((a) => <button key={a} className={`swatch ${d.theme.accent === a ? 'active' : ''}`} style={{ background: a }} aria-label={a} onClick={() => setD({ theme: { ...d.theme, accent: a } })} />)}
              <input type="color" aria-label="Custom accent" value={d.theme.accent} onChange={(e) => setD({ theme: { ...d.theme, accent: e.target.value } })} style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
            </div>
            <div className="field" style={{ marginTop: 16 }}>
              <label>Font</label>
              <select className="select" value={d.theme.font} onChange={(e) => setD({ theme: { ...d.theme, font: e.target.value as FontKey } })}>
                {FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
            <label className="row" style={{ gap: 8, fontSize: 14, marginTop: 6 }}>
              <input type="checkbox" checked={d.theme.dark} onChange={(e) => setD({ theme: { ...d.theme, dark: e.target.checked } })} /> Dark theme
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
