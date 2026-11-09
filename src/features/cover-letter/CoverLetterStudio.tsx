import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { CoverLetterData, CoverLetterProject, FontKey, ProjectEnvelope } from '../../core/models/types';
import { useStore } from '../../state/store';
import * as dbApi from '../../core/storage/db';
import { migrateProject } from '../../core/migrations/migrate';
import { buildBackup, download, safeFilename } from '../../services/exports/backup';
import { coverLetterToText, coverLetterToDocxBlob } from '../../services/exports/coverLetter';
import { downloadBlob } from '../../services/exports/docx';
import { Icon } from '../../components/ui/Icon';

const FONT_STACK: Record<FontKey, string> = {
  inter: "'Inter', system-ui, sans-serif", georgia: "Georgia, 'Times New Roman', serif",
  times: "'Times New Roman', Times, serif", arial: 'Arial, Helvetica, sans-serif', jetbrains: "ui-monospace, monospace",
};
const PAGE = { a4: { w: 794, h: 1123 }, letter: { w: 816, h: 1056 } };
const FONTS: { key: FontKey; label: string }[] = [
  { key: 'georgia', label: 'Georgia' }, { key: 'times', label: 'Times' }, { key: 'inter', label: 'Inter' }, { key: 'arial', label: 'Arial' },
];
const ACCENTS = ['#2563eb', '#0d9488', '#7c3aed', '#1f2937', '#dc2626'];
type Pane = 'content' | 'preview';

function LetterPreview({ d }: { d: CoverLetterData }) {
  const dims = PAGE[d.design.pageSize];
  const style = {
    '--r-accent': d.design.accent, '--doc-font': FONT_STACK[d.design.fontFamily],
    '--doc-scale': d.design.fontScale, '--doc-lh': d.design.lineHeight,
    '--page-w': `${dims.w}px`, '--page-h': `${dims.h}px`,
  } as CSSProperties;
  const s = d.sender; const r = d.recipient;
  const senderMeta = [s.title, [s.email, s.phone].filter(Boolean).join(' · '), [s.location, s.website].filter(Boolean).join(' · ')].filter(Boolean);
  return (
    <div className="paper letter" style={style}>
      <div className="l-sender">
        <div className="l-name">{s.name || 'Your Name'}</div>
        {senderMeta.map((m, i) => <div key={i} className="l-sender-meta">{m}</div>)}
      </div>
      {d.date && <div className="l-date">{d.date}</div>}
      {(r.name || r.title || r.company || r.address) && (
        <div className="l-recipient">
          {r.name && <div className="l-accent">{r.name}</div>}
          {r.title && <div>{r.title}</div>}
          {r.company && <div>{r.company}</div>}
          {r.address && <div>{r.address}</div>}
        </div>
      )}
      {d.subject && <div className="l-subject">{d.subject}</div>}
      {d.salutation && <div className="l-salutation">{d.salutation}</div>}
      <div className="l-body">{d.body.map((p, i) => <p key={i}>{p || ' '}</p>)}</div>
      <div className="l-closing">{d.closing}</div>
      <div className="l-signature">{d.signature}</div>
    </div>
  );
}

export function CoverLetterStudio() {
  const { id = '' } = useParams();
  const { profile, refreshProjects } = useStore();
  const [project, setProject] = useState<CoverLetterProject | null>(null);
  const [missing, setMissing] = useState(false);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [pane, setPane] = useState<Pane>('content');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = (await dbApi.getProject(id)) as ProjectEnvelope | null;
      if (cancelled) return;
      if (!rec || rec.type !== 'cover-letter') { setMissing(true); return; }
      setProject(migrateProject(rec).project as CoverLetterProject);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const timer = useRef<number | undefined>(undefined);
  const patch = useCallback((fn: (d: CoverLetterData) => CoverLetterData) => {
    setProject((prev) => {
      if (!prev) return prev;
      const next: CoverLetterProject = { ...prev, data: fn(prev.data), updatedAt: Date.now() };
      setSave('saving'); window.clearTimeout(timer.current);
      timer.current = window.setTimeout(async () => { try { await dbApi.saveProject(next); setSave('saved'); refreshProjects(); } catch { setSave('error'); } }, 500);
      return next;
    });
  }, [refreshProjects]);

  const setTitle = (title: string) => setProject((p) => { if (!p) return p; const n = { ...p, title, updatedAt: Date.now() }; dbApi.saveProject(n).then(refreshProjects); return n; });

  const previewData = useMemo(() => project?.data, [project]);

  if (missing) return <div className="content" style={{ textAlign: 'center', paddingTop: 50 }}><h2>Cover letter not found</h2><Link className="btn btn-primary" to="/">Back to dashboard</Link></div>;
  if (!project || !previewData) return <div className="content" style={{ paddingTop: 50, textAlign: 'center' }}><p className="muted">Loading…</p></div>;

  const d = project.data;
  const setD = (p: Partial<CoverLetterData>) => patch((prev) => ({ ...prev, ...p }));
  const saveText = save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved locally' : save === 'error' ? 'Save failed' : '';

  const doPrint = () => { setShowExport(false); setTimeout(() => window.print(), 50); };
  const exportTxt = () => { download(safeFilename(project.title, 'txt'), coverLetterToText(d), 'text/plain'); setShowExport(false); };
  const exportJson = () => { download(safeFilename(project.title, 'json'), JSON.stringify(buildBackup(profile, [project as ProjectEnvelope]), null, 2)); setShowExport(false); };
  const exportDocx = async () => {
    setShowExport(false); setBusy('Generating DOCX…');
    try { downloadBlob(safeFilename(project.title, 'docx'), await coverLetterToDocxBlob(d)); }
    catch { alert('DOCX export failed.'); } finally { setBusy(null); }
  };

  const syncSender = () => setD({ sender: { name: profile.fullName, title: profile.title, email: profile.email, phone: profile.phone, location: profile.location, website: profile.website } });
  const moveBody = (i: number, dir: -1 | 1) => { const j = i + dir; if (j < 0 || j >= d.body.length) return; const b = d.body.slice(); [b[i], b[j]] = [b[j], b[i]]; setD({ body: b }); };

  return (
    <div>
      <div className="panel-head no-print" style={{ position: 'sticky', top: 53, gap: 10 }}>
        <Link className="btn btn-sm btn-ghost btn-icon" to="/" aria-label="Back"><Icon name="home" /></Link>
        <input className="input" style={{ maxWidth: 300, fontWeight: 600 }} value={project.title} onChange={(e) => setTitle(e.target.value)} aria-label="Cover letter title" />
        <span className="save-pill" role="status" aria-live="polite"><span className={`save-dot ${save}`} />{busy ?? saveText}</span>
        <span className="spacer" />
        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm btn-primary" onClick={() => setShowExport((s) => !s)}><Icon name="download" size={15} /> Export</button>
          {showExport && (
            <div className="card" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 40, padding: 6, minWidth: 220 }} onMouseLeave={() => setShowExport(false)}>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={doPrint}><Icon name="print" size={15} /> Print / Save as PDF</button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={exportDocx}><Icon name="file" size={15} /> Word (.docx)</button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={exportTxt}><Icon name="file" size={15} /> Plain text (.txt)</button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={exportJson}><Icon name="download" size={15} /> Backup (.json)</button>
            </div>
          )}
        </div>
      </div>

      <div className="studio-tabs no-print">
        {(['content', 'preview'] as Pane[]).map((p) => <button key={p} className={pane === p ? 'active' : ''} onClick={() => setPane(p)} style={{ textTransform: 'capitalize' }}>{p}</button>)}
      </div>

      <div className="studio" style={{ gridTemplateColumns: '380px 1fr' }}>
        <div className={`studio-panel studio-pane ${pane === 'content' ? 'active' : ''}`}>
          <div className="panel-head no-print">Content<span className="spacer" /><button className="btn btn-sm btn-ghost" onClick={syncSender}>Sync sender</button></div>
          <div className="panel-pad">
            <h4 style={{ margin: '0 0 8px' }}>Recipient</h4>
            <div className="entry-grid">
              <div className="field"><label>Name</label><input className="input" value={d.recipient.name} onChange={(e) => setD({ recipient: { ...d.recipient, name: e.target.value } })} /></div>
              <div className="field"><label>Title</label><input className="input" value={d.recipient.title} onChange={(e) => setD({ recipient: { ...d.recipient, title: e.target.value } })} /></div>
            </div>
            <div className="field"><label>Company</label><input className="input" value={d.recipient.company} onChange={(e) => setD({ recipient: { ...d.recipient, company: e.target.value } })} /></div>
            <div className="field"><label>Address</label><input className="input" value={d.recipient.address} onChange={(e) => setD({ recipient: { ...d.recipient, address: e.target.value } })} /></div>

            <div className="entry-grid">
              <div className="field"><label>Date</label><input className="input" value={d.date} onChange={(e) => setD({ date: e.target.value })} /></div>
              <div className="field"><label>Subject (optional)</label><input className="input" value={d.subject} placeholder="Re: Application for…" onChange={(e) => setD({ subject: e.target.value })} /></div>
            </div>
            <div className="field"><label>Salutation</label><input className="input" value={d.salutation} onChange={(e) => setD({ salutation: e.target.value })} /></div>

            <h4 style={{ margin: '14px 0 8px' }}>Body</h4>
            {d.body.map((para, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div className="row" style={{ justifyContent: 'flex-end', gap: 2, marginBottom: 2 }}>
                  <span className="faint" style={{ fontSize: 11, marginRight: 'auto' }}>Paragraph {i + 1}</span>
                  <button className="btn btn-sm btn-ghost btn-icon" aria-label="Up" disabled={i === 0} onClick={() => moveBody(i, -1)}><Icon name="chevron-up" size={14} /></button>
                  <button className="btn btn-sm btn-ghost btn-icon" aria-label="Down" disabled={i === d.body.length - 1} onClick={() => moveBody(i, 1)}><Icon name="chevron-down" size={14} /></button>
                  <button className="btn btn-sm btn-ghost btn-icon btn-danger" aria-label="Remove" onClick={() => setD({ body: d.body.filter((_, j) => j !== i) })}><Icon name="x" size={14} /></button>
                </div>
                <textarea className="textarea" rows={3} value={para} onChange={(e) => { const b = d.body.slice(); b[i] = e.target.value; setD({ body: b }); }} />
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => setD({ body: [...d.body, ''] })}><Icon name="plus" size={14} /> Add paragraph</button>

            <div className="entry-grid" style={{ marginTop: 14 }}>
              <div className="field"><label>Closing</label><input className="input" value={d.closing} onChange={(e) => setD({ closing: e.target.value })} /></div>
              <div className="field"><label>Signature</label><input className="input" value={d.signature} onChange={(e) => setD({ signature: e.target.value })} /></div>
            </div>

            <h4 style={{ margin: '14px 0 8px' }}>Design</h4>
            <div className="swatches" style={{ marginBottom: 10 }}>
              {ACCENTS.map((a) => <button key={a} className={`swatch ${d.design.accent === a ? 'active' : ''}`} style={{ background: a }} aria-label={a} onClick={() => setD({ design: { ...d.design, accent: a } })} />)}
            </div>
            <div className="entry-grid">
              <div className="field"><label>Font</label><select className="select" value={d.design.fontFamily} onChange={(e) => setD({ design: { ...d.design, fontFamily: e.target.value as FontKey } })}>{FONTS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}</select></div>
              <div className="field"><label>Page</label><select className="select" value={d.design.pageSize} onChange={(e) => setD({ design: { ...d.design, pageSize: e.target.value as 'a4' | 'letter' } })}><option value="a4">A4</option><option value="letter">Letter</option></select></div>
            </div>
          </div>
        </div>

        <div className={`studio-center studio-pane ${pane === 'preview' ? 'active' : ''}`}>
          <div className="preview-wrap"><LetterPreview d={previewData} /></div>
        </div>
      </div>
    </div>
  );
}
