import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { ProjectEnvelope, ResumeContent, ResumeData, ResumeProject, ResumeSnapshot } from '../../core/models/types';
import { BUILTIN_SECTIONS } from './sections';
import { useStore } from '../../state/store';
import * as dbApi from '../../core/storage/db';
import { ResumeEditor } from './ResumeEditor';
import { DesignPanel } from './DesignPanel';
import { ResumePreview } from './ResumePreview';
import { Icon } from '../../components/ui/Icon';
import { runResumeChecks, type Finding } from '../../services/quality/checks';
import { runWritingChecks, type WritingFinding } from '../../services/quality/writing';
import { resumeToText } from '../../services/exports/text';
import { buildBackup, download, safeFilename } from '../../services/exports/backup';
import { resumeToDocxBlob, downloadBlob } from '../../services/exports/docx';
import { newResumeProject, uid } from '../../core/models/factory';
import { migrateProject } from '../../core/migrations/migrate';
import { diffContent } from '../../services/compare/diff';

/** Keep sectionOrder/hiddenSections consistent and ensure v2 fields exist. */
function normalize(data: ResumeData): ResumeData {
  const customIds = data.content.customSections.map((s) => s.id);
  const valid = new Set<string>([...BUILTIN_SECTIONS, ...customIds]);
  const order = data.sectionOrder.filter((k) => valid.has(k));
  for (const id of customIds) if (!order.includes(id)) order.push(id);
  for (const b of BUILTIN_SECTIONS) if (!order.includes(b)) order.push(b);
  const hidden = data.hiddenSections.filter((k) => valid.has(k));
  return { ...data, sectionOrder: order, hiddenSections: hidden, snapshots: data.snapshots ?? [] };
}

function normalizeProject(p: ResumeProject): ResumeProject {
  return { ...p, data: normalize(p.data) };
}

function relTime(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

type Pane = 'content' | 'preview' | 'design';

export function ResumeStudio() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { profile, refreshProjects } = useStore();

  const [project, setProject] = useState<ResumeProject | null>(null);
  const [missing, setMissing] = useState(false);
  const [save, setSave] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pane, setPane] = useState<Pane>('content');
  const [showChecks, setShowChecks] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showWriting, setShowWriting] = useState(false);
  const [compareSnap, setCompareSnap] = useState<ResumeSnapshot | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Undo / redo history (resume data snapshots).
  const past = useRef<ResumeData[]>([]);
  const future = useRef<ResumeData[]>([]);
  const [, forceRerender] = useState(0);

  // Load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rec = (await dbApi.getProject(id)) as ProjectEnvelope | null;
      if (cancelled) return;
      if (!rec || rec.type !== 'resume') { setMissing(true); return; }
      const { project: migrated } = migrateProject(rec);
      setProject(normalizeProject(migrated as ResumeProject));
      past.current = [];
      future.current = [];
    })();
    return () => { cancelled = true; };
  }, [id]);

  const saveTimer = useRef<number | undefined>(undefined);
  const persist = useCallback((next: ResumeProject) => {
    setSave('saving');
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        await dbApi.saveProject(next);
        setSave('saved');
        refreshProjects();
      } catch {
        setSave('error');
      }
    }, 600);
  }, [refreshProjects]);

  const commit = useCallback((mutate: (d: ResumeData) => ResumeData, recordHistory = true) => {
    setProject((prev) => {
      if (!prev) return prev;
      if (recordHistory) {
        past.current.push(prev.data);
        if (past.current.length > 80) past.current.shift();
        future.current = [];
      }
      const data = normalize(mutate(prev.data));
      const next: ResumeProject = { ...prev, data, updatedAt: Date.now() };
      persist(next);
      return next;
    });
  }, [persist]);

  const patchContent = useCallback((fn: (c: ResumeContent) => ResumeContent) => {
    commit((d) => ({ ...d, content: fn(d.content) }));
  }, [commit]);

  const patchData = useCallback((fn: (d: ResumeData) => ResumeData) => {
    commit(fn);
  }, [commit]);

  const undo = useCallback(() => {
    if (!project || past.current.length === 0) return;
    future.current.push(project.data);
    const prevData = past.current.pop()!;
    setProject((p) => (p ? { ...p, data: prevData, updatedAt: Date.now() } : p));
    persist({ ...project, data: prevData });
    forceRerender((n) => n + 1);
  }, [project, persist]);

  const redo = useCallback(() => {
    if (!project || future.current.length === 0) return;
    past.current.push(project.data);
    const nextData = future.current.pop()!;
    setProject((p) => (p ? { ...p, data: nextData, updatedAt: Date.now() } : p));
    persist({ ...project, data: nextData });
    forceRerender((n) => n + 1);
  }, [project, persist]);

  // Keyboard shortcuts for undo/redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const findings: Finding[] = useMemo(() => (project ? runResumeChecks(project.data) : []), [project]);
  const issueCount = findings.filter((f) => f.id !== 'ok').length;
  const writingFindings: WritingFinding[] = useMemo(() => (project ? runWritingChecks(project.data) : []), [project]);
  const writingCount = writingFindings.filter((f) => f.id !== 'ok').length;

  const setTitle = (title: string) => setProject((p) => {
    if (!p) return p;
    const next = { ...p, title, updatedAt: Date.now() };
    persist(next);
    return next;
  });

  const duplicate = async () => {
    if (!project) return;
    const copy = newResumeProject({ title: `${project.title} (copy)`, templateId: project.data.templateId, content: structuredClone(project.data.content) });
    copy.data = structuredClone({ ...project.data });
    await dbApi.saveProject(copy);
    await refreshProjects();
    navigate(`/resume/${copy.id}`);
  };

  const importFromProfile = () => {
    if (!confirm('Replace this resume’s content with your Career Profile? This affects only this resume.')) return;
    patchContent(() => structuredClone({
      fullName: profile.fullName, title: profile.title, email: profile.email, phone: profile.phone,
      location: profile.location, website: profile.website, links: profile.links, summary: profile.summary,
      experience: profile.experience, education: profile.education, skills: profile.skills,
      projects: profile.projects, certifications: profile.certifications, customSections: profile.customSections,
    }));
  };

  const doPrint = () => { setShowExport(false); setTimeout(() => window.print(), 50); };
  const exportTxt = () => { if (project) download(safeFilename(project.title, 'txt'), resumeToText(project.data), 'text/plain'); setShowExport(false); };
  const exportJson = () => {
    if (!project) return;
    download(safeFilename(project.title, 'json'), JSON.stringify(buildBackup(profile, [project as ProjectEnvelope]), null, 2));
    setShowExport(false);
  };
  const exportDocx = async () => {
    if (!project) return;
    setShowExport(false);
    setBusy('Generating DOCX…');
    try {
      const blob = await resumeToDocxBlob(project.data);
      downloadBlob(safeFilename(project.title, 'docx'), blob);
    } catch {
      alert('Sorry — DOCX export failed for this content.');
    } finally {
      setBusy(null);
    }
  };

  // --- Version snapshots ---
  const saveVersion = () => {
    if (!project) return;
    const n = project.data.snapshots.length + 1;
    const name = window.prompt('Name this version', `Version ${n}`);
    if (name === null) return;
    const d = project.data;
    const snap: ResumeSnapshot = {
      id: uid('ver'), name: name.trim() || `Version ${n}`, createdAt: Date.now(),
      content: structuredClone(d.content), templateId: d.templateId, design: structuredClone(d.design),
      sectionOrder: [...d.sectionOrder], hiddenSections: [...d.hiddenSections],
    };
    commit((prev) => ({ ...prev, snapshots: [snap, ...prev.snapshots] }), false);
  };
  const restoreVersion = (snap: ResumeSnapshot) => {
    commit((prev) => ({
      ...prev,
      content: structuredClone(snap.content), templateId: snap.templateId, design: structuredClone(snap.design),
      sectionOrder: [...snap.sectionOrder], hiddenSections: [...snap.hiddenSections],
    }), true);
    setShowVersions(false);
  };
  const deleteVersion = (sid: string) =>
    commit((prev) => ({ ...prev, snapshots: prev.snapshots.filter((s) => s.id !== sid) }), false);

  if (missing) {
    return (
      <div className="content" style={{ textAlign: 'center', paddingTop: 50 }}>
        <h2>Resume not found</h2>
        <p className="muted">It may have been deleted, or this device has different local data.</p>
        <Link className="btn btn-primary" to="/">Back to dashboard</Link>
      </div>
    );
  }
  if (!project) return <div className="content" style={{ paddingTop: 50, textAlign: 'center' }}><p className="muted">Loading resume…</p></div>;

  const saveText = save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved locally' : save === 'error' ? 'Save failed' : '';

  return (
    <div>
      {/* Toolbar */}
      <div className="panel-head no-print" style={{ position: 'sticky', top: 53, gap: 10 }}>
        <Link className="btn btn-sm btn-ghost btn-icon" to="/" aria-label="Back to dashboard"><Icon name="home" /></Link>
        <input
          className="input"
          style={{ maxWidth: 320, fontWeight: 600 }}
          value={project.title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Resume title"
        />
        <span className="save-pill"><span className={`save-dot ${save}`} />{busy ?? saveText}</span>
        <span className="spacer" />
        <button className={`btn btn-sm ${editing ? 'btn-primary' : ''}`} onClick={() => { setEditing((v) => !v); setPane('preview'); }} aria-pressed={editing} title="Edit text directly on the page">
          <Icon name={editing ? 'check' : 'file'} size={15} /> {editing ? 'Editing' : 'Edit on page'}
        </button>
        <button className="btn btn-sm btn-ghost btn-icon" onClick={undo} disabled={past.current.length === 0} aria-label="Undo" title="Undo (Ctrl+Z)"><Icon name="chevron-up" style={{ transform: 'rotate(-90deg)' }} /></button>
        <button className="btn btn-sm btn-ghost btn-icon" onClick={redo} disabled={future.current.length === 0} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Icon name="chevron-down" style={{ transform: 'rotate(-90deg)' }} /></button>
        <button className="btn btn-sm" onClick={() => setShowChecks(true)}>
          <Icon name={issueCount ? 'alert' : 'check'} size={15} /> Checks{issueCount ? ` (${issueCount})` : ''}
        </button>
        <button className="btn btn-sm" onClick={() => setShowWriting(true)} title="Rule-based writing suggestions">
          <Icon name="file" size={15} /> Writing{writingCount ? ` (${writingCount})` : ''}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setShowVersions(true)} title="Version snapshots">
          <Icon name="copy" size={15} /> Versions{project.data.snapshots.length ? ` (${project.data.snapshots.length})` : ''}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={duplicate} title="Duplicate as a separate resume">Duplicate</button>
        <div style={{ position: 'relative' }}>
          <button className="btn btn-sm btn-primary" onClick={() => setShowExport((s) => !s)}><Icon name="download" size={15} /> Export</button>
          {showExport && (
            <div className="card" style={{ position: 'absolute', right: 0, top: '110%', zIndex: 40, padding: 6, minWidth: 230 }} onMouseLeave={() => setShowExport(false)}>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={doPrint}><Icon name="print" size={15} /> Print / Save as PDF</button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={exportDocx}><Icon name="file" size={15} /> Word document (.docx)</button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={exportTxt}><Icon name="file" size={15} /> Plain text (.txt)</button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={exportJson}><Icon name="download" size={15} /> Backup this resume (.json)</button>
              <p className="muted" style={{ fontSize: 11.5, margin: '6px 8px 2px' }}>PDF uses your browser’s “Save as PDF” (turn OFF headers/footers). DOCX is a clean single-column layout, not the template design.</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile pane tabs */}
      <div className="studio-tabs no-print">
        <button className={pane === 'content' ? 'active' : ''} onClick={() => setPane('content')}>Content</button>
        <button className={pane === 'preview' ? 'active' : ''} onClick={() => setPane('preview')}>Preview</button>
        <button className={pane === 'design' ? 'active' : ''} onClick={() => setPane('design')}>Design</button>
      </div>

      <div className="studio">
        <div className={`studio-panel studio-pane ${pane === 'content' ? 'active' : ''}`}>
          <div className="panel-head no-print">Content
            <span className="spacer" />
            <button className="btn btn-sm btn-ghost" onClick={importFromProfile} title="Pull content from your Career Profile">From Profile</button>
          </div>
          <ResumeEditor content={project.data.content} patch={patchContent} />
        </div>

        <div className={`studio-center studio-pane ${pane === 'preview' ? 'active' : ''}`}>
          {editing && (
            <div className="no-print" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', padding: '8px 16px', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
              Editing on the page — click any dashed field to change it. Enter saves, Esc cancels. This edits the same data as the Content panel.
            </div>
          )}
          <div className="preview-wrap">
            <ResumePreview data={project.data} editing={editing} commit={patchContent} />
          </div>
        </div>

        <div className={`studio-panel studio-pane ${pane === 'design' ? 'active' : ''}`}>
          <div className="panel-head no-print">Design</div>
          <DesignPanel data={project.data} patchData={patchData} />
        </div>
      </div>

      {/* Checks drawer */}
      {showChecks && (
        <div role="dialog" aria-modal="true" aria-label="Resume checks" className="no-print" onClick={() => setShowChecks(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 90, display: 'flex', justifyContent: 'flex-end' }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 100%)', height: '100%', borderRadius: 0, overflow: 'auto' }}>
            <div className="panel-head">Resume checks <span className="spacer" /><button className="btn btn-sm btn-ghost btn-icon" aria-label="Close" onClick={() => setShowChecks(false)}><Icon name="x" /></button></div>
            <div className="panel-pad">
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Deterministic checks run locally. They are guidance only and never a guarantee of any outcome.</p>
              {findings.map((f) => (
                <div key={f.id} className="entry" style={{ display: 'flex', gap: 10 }}>
                  <span className={`sev-${f.severity}`} style={{ marginTop: 1 }}>
                    <Icon name={f.severity === 'error' ? 'alert' : f.severity === 'warning' ? 'alert' : f.id === 'ok' ? 'check' : 'info'} size={17} />
                  </span>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{f.message}</div>
                    {f.hint && <div className="muted" style={{ fontSize: 12.5 }}>{f.hint}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Writing assistant drawer */}
      {showWriting && (
        <div role="dialog" aria-modal="true" aria-label="Writing suggestions" className="no-print" onClick={() => setShowWriting(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 90, display: 'flex', justifyContent: 'flex-end' }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(440px, 100%)', height: '100%', borderRadius: 0, overflow: 'auto' }}>
            <div className="panel-head">Writing assistant <span className="spacer" /><button className="btn btn-sm btn-ghost btn-icon" aria-label="Close" onClick={() => setShowWriting(false)}><Icon name="x" /></button></div>
            <div className="panel-pad">
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Rule-based suggestions, computed locally — no AI, nothing is sent anywhere. Guidance only; it never rewrites your words or invents facts.</p>
              {writingFindings.map((f) => (
                <div key={f.id} className="entry" style={{ display: 'flex', gap: 10 }}>
                  <span className={`sev-${f.severity}`} style={{ marginTop: 1 }}><Icon name={f.severity === 'warning' ? 'alert' : f.id === 'ok' ? 'check' : 'info'} size={16} /></span>
                  <div>
                    {f.where && <div className="faint" style={{ fontSize: 11.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{f.where}</div>}
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{f.message}</div>
                    {f.hint && <div className="muted" style={{ fontSize: 12.5 }}>{f.hint}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Versions drawer */}
      {showVersions && (
        <div role="dialog" aria-modal="true" aria-label="Versions" className="no-print" onClick={() => setShowVersions(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 90, display: 'flex', justifyContent: 'flex-end' }}>
          <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(420px, 100%)', height: '100%', borderRadius: 0, overflow: 'auto' }}>
            <div className="panel-head">Version snapshots <span className="spacer" /><button className="btn btn-sm btn-ghost btn-icon" aria-label="Close" onClick={() => setShowVersions(false)}><Icon name="x" /></button></div>
            <div className="panel-pad">
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Save a named snapshot of this resume’s content and design, then restore it later. Snapshots live inside this resume.</p>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={saveVersion}><Icon name="plus" size={15} /> Save current as version</button>
              {project.data.snapshots.length === 0 ? (
                <p className="faint" style={{ fontSize: 13, textAlign: 'center', marginTop: 16 }}>No versions saved yet.</p>
              ) : (
                <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                  {project.data.snapshots.map((s) => (
                    <div key={s.id} className="entry" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div className="faint" style={{ fontSize: 12 }}>{s.templateId} · saved {relTime(s.createdAt)}</div>
                      </div>
                      <button className="btn btn-sm btn-ghost" onClick={() => setCompareSnap(s)} title="Compare with current">Compare</button>
                      <button className="btn btn-sm" onClick={() => restoreVersion(s)}>Restore</button>
                      <button className="btn btn-sm btn-ghost btn-icon btn-danger" aria-label="Delete version" onClick={() => deleteVersion(s.id)}><Icon name="trash" size={15} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Version comparison */}
      {compareSnap && (() => {
        const diff = diffContent(compareSnap.content, project.data.content);
        return (
          <div role="dialog" aria-modal="true" aria-label="Compare versions" className="no-print" onClick={() => setCompareSnap(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 95, display: 'grid', placeItems: 'center', padding: 16 }}>
            <div className="card" onClick={(e) => e.stopPropagation()} style={{ width: 'min(640px, 100%)', maxHeight: '86vh', overflow: 'auto', padding: 20 }}>
              <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                <h3>Compare</h3>
                <button className="btn btn-sm btn-ghost btn-icon" aria-label="Close" onClick={() => setCompareSnap(null)}><Icon name="x" /></button>
              </div>
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>“{compareSnap.name}” → current. Content differences only.</p>
              {!diff.changed ? (
                <p className="faint" style={{ textAlign: 'center', padding: '20px 0' }}>No content differences — the current resume matches this version.</p>
              ) : (
                <>
                  {diff.fields.length > 0 && (
                    <div className="entry">
                      <strong style={{ fontSize: 13 }}>Changed fields</strong>
                      {diff.fields.map((f) => (
                        <div key={f.label} style={{ fontSize: 13, marginTop: 6 }}>
                          <div style={{ fontWeight: 600 }}>{f.label}</div>
                          <div className="sev-error" style={{ textDecoration: 'line-through', opacity: 0.8 }}>{f.from || '(empty)'}</div>
                          <div className="sev-info" style={{ color: 'var(--ok)' }}>{f.to || '(empty)'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {diff.lists.map((l) => (
                    <div className="entry" key={l.section}>
                      <strong style={{ fontSize: 13 }}>{l.section}</strong>
                      {l.added.map((x, i) => <div key={`a${i}`} style={{ fontSize: 13, color: 'var(--ok)' }}>+ added: {x}</div>)}
                      {l.removed.map((x, i) => <div key={`r${i}`} className="sev-error" style={{ fontSize: 13 }}>− removed: {x}</div>)}
                      {l.modified.map((x, i) => <div key={`m${i}`} className="sev-warning" style={{ fontSize: 13 }}>~ changed: {x}</div>)}
                    </div>
                  ))}
                </>
              )}
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                <button className="btn btn-ghost" onClick={() => setCompareSnap(null)}>Close</button>
                <button className="btn btn-primary" onClick={() => { restoreVersion(compareSnap); setCompareSnap(null); }}>Restore this version</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
