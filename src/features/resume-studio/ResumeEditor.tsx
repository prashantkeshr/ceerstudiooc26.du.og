import { useRef, useState, type DragEvent } from 'react';
import type {
  CertificationEntry,
  CustomSection,
  EducationEntry,
  ExperienceEntry,
  ProjectEntry,
  ResumeContent,
  SkillGroup,
} from '../../core/models/types';
import { uid } from '../../core/models/factory';
import { Icon } from '../../components/ui/Icon';

type Patch = (fn: (c: ResumeContent) => ResumeContent) => void;

// --- small inputs -------------------------------------------------------
function Text({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Area({ label, value, onChange, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea className="textarea" rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function moveItem<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const next = index + dir;
  if (next < 0 || next >= arr.length) return arr;
  const copy = arr.slice();
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0) return arr;
  const copy = arr.slice();
  const [m] = copy.splice(from, 1);
  copy.splice(to, 0, m);
  return copy;
}

function EntryToolbar({ onUp, onDown, onDup, onRemove, canUp, canDown, label }: {
  onUp: () => void; onDown: () => void; onDup: () => void; onRemove: () => void; canUp: boolean; canDown: boolean; label: string;
}) {
  return (
    <div className="row" style={{ gap: 4 }}>
      <button className="btn btn-sm btn-ghost btn-icon" onClick={onUp} disabled={!canUp} aria-label={`Move ${label} up`}><Icon name="chevron-up" size={15} /></button>
      <button className="btn btn-sm btn-ghost btn-icon" onClick={onDown} disabled={!canDown} aria-label={`Move ${label} down`}><Icon name="chevron-down" size={15} /></button>
      <button className="btn btn-sm btn-ghost btn-icon" onClick={onDup} aria-label={`Duplicate ${label}`}><Icon name="copy" size={15} /></button>
      <button className="btn btn-sm btn-ghost btn-icon" onClick={onRemove} aria-label={`Remove ${label}`}><Icon name="trash" size={15} /></button>
    </div>
  );
}

// --- bullet list editor -------------------------------------------------
function Bullets({ bullets, onChange }: { bullets: string[]; onChange: (b: string[]) => void }) {
  const from = useRef<number | null>(null);
  return (
    <div className="field">
      <label>Bullet points</label>
      {bullets.map((b, i) => (
        <div className="row" key={i} style={{ marginBottom: 6, gap: 4 }}
          onDragOver={(e) => { if (from.current !== null) e.preventDefault(); }}
          onDrop={(e) => { if (from.current !== null) { e.preventDefault(); onChange(reorder(bullets, from.current, i)); from.current = null; } }}>
          <span className="drag-handle" draggable aria-hidden title="Drag to reorder"
            onDragStart={(e) => { from.current = i; e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { from.current = null; }}><Icon name="drag" size={14} /></span>
          <input className="input" value={b} placeholder="Achievement or responsibility…" onChange={(e) => { const n = bullets.slice(); n[i] = e.target.value; onChange(n); }} />
          <button className="btn btn-sm btn-ghost btn-icon" aria-label="Remove bullet" onClick={() => onChange(bullets.filter((_, j) => j !== i))}><Icon name="x" size={15} /></button>
        </div>
      ))}
      <button className="btn btn-sm" onClick={() => onChange([...bullets, ''])}><Icon name="plus" size={14} /> Add bullet</button>
    </div>
  );
}

// --- skills (tag) editor ------------------------------------------------
function SkillTags({ skills, onChange }: { skills: string[]; onChange: (s: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !skills.includes(v)) onChange([...skills, v]);
    setDraft('');
  };
  return (
    <div className="field">
      <label>Skills</label>
      <div className="chip-row" style={{ marginBottom: 6 }}>
        {skills.map((s, i) => (
          <span className="chip" key={i}>{s}<button aria-label={`Remove ${s}`} onClick={() => onChange(skills.filter((_, j) => j !== i))}>×</button></span>
        ))}
      </div>
      <div className="row">
        <input className="input" value={draft} placeholder="Type a skill, press Enter" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
        <button className="btn btn-sm" onClick={add}>Add</button>
      </div>
    </div>
  );
}

// --- collapsible section wrapper ---------------------------------------
function SectionBox({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="sec">
      <div className="sec-head" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)} role="button" aria-expanded={open}>
        <Icon name={open ? 'chevron-down' : 'chevron-up'} size={16} />
        <h3>{title}</h3>
      </div>
      {open && <div className="sec-body">{children}</div>}
    </div>
  );
}

// =======================================================================
export function ResumeEditor({ content, patch }: { content: ResumeContent; patch: Patch }) {
  const c = content;

  // generic list helpers
  const updateList = <K extends keyof ResumeContent>(key: K, list: ResumeContent[K]) =>
    patch((prev) => ({ ...prev, [key]: list }));

  // Drag-and-drop reordering for repeatable entries. One drag at a time; drops
  // only apply within the same list.
  const dnd = useRef<{ list: string; from: number } | null>(null);
  const handleProps = (list: string, i: number) => ({
    draggable: true,
    className: 'drag-handle',
    title: 'Drag to reorder',
    'aria-hidden': true,
    onDragStart: (e: DragEvent) => { dnd.current = { list, from: i }; e.dataTransfer.effectAllowed = 'move'; },
    onDragEnd: () => { dnd.current = null; },
  });
  const dropProps = <K extends keyof ResumeContent>(list: string, i: number, key: K, arr: unknown[]) => ({
    onDragOver: (e: DragEvent) => { if (dnd.current?.list === list) e.preventDefault(); },
    onDrop: (e: DragEvent) => {
      if (dnd.current?.list === list) { e.preventDefault(); updateList(key, reorder(arr, dnd.current.from, i) as ResumeContent[K]); dnd.current = null; }
    },
  });

  return (
    <div className="panel-pad">
      {/* Details */}
      <SectionBox title="Details">
        <Text label="Full name" value={c.fullName} onChange={(v) => patch((p) => ({ ...p, fullName: v }))} placeholder="Jane Doe" />
        <Text label="Professional title" value={c.title} onChange={(v) => patch((p) => ({ ...p, title: v }))} placeholder="Product Designer" />
        <div className="entry-grid">
          <Text label="Email" value={c.email} onChange={(v) => patch((p) => ({ ...p, email: v }))} />
          <Text label="Phone" value={c.phone} onChange={(v) => patch((p) => ({ ...p, phone: v }))} />
          <Text label="Location" value={c.location} onChange={(v) => patch((p) => ({ ...p, location: v }))} />
          <Text label="Website" value={c.website} onChange={(v) => patch((p) => ({ ...p, website: v }))} />
        </div>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-soft)' }}>Links</label>
        {c.links.map((l, i) => (
          <div className="row" key={l.id} style={{ margin: '6px 0' }}>
            <input className="input" style={{ maxWidth: 110 }} value={l.label} placeholder="Label" onChange={(e) => updateList('links', c.links.map((x) => x.id === l.id ? { ...x, label: e.target.value } : x))} />
            <input className="input" value={l.url} placeholder="github.com/you" onChange={(e) => updateList('links', c.links.map((x) => x.id === l.id ? { ...x, url: e.target.value } : x))} />
            <button className="btn btn-sm btn-ghost btn-icon" aria-label={`Move link ${i} up`} disabled={i === 0} onClick={() => updateList('links', moveItem(c.links, i, -1))}><Icon name="chevron-up" size={15} /></button>
            <button className="btn btn-sm btn-ghost btn-icon" aria-label="Remove link" onClick={() => updateList('links', c.links.filter((x) => x.id !== l.id))}><Icon name="x" size={15} /></button>
          </div>
        ))}
        <button className="btn btn-sm" onClick={() => updateList('links', [...c.links, { id: uid('lnk'), label: '', url: '' }])}><Icon name="plus" size={14} /> Add link</button>
      </SectionBox>

      {/* Summary */}
      <SectionBox title="Summary">
        <Area label="Professional summary" rows={5} value={c.summary} onChange={(v) => patch((p) => ({ ...p, summary: v }))} placeholder="2–4 sentences about who you are and what you do." />
      </SectionBox>

      {/* Experience */}
      <SectionBox title="Experience">
        {c.experience.map((e, i) => (
          <div className="entry" key={e.id} {...dropProps('exp', i, 'experience', c.experience)}>
            <div className="row" style={{ marginBottom: 6, gap: 6 }}>
              <span {...handleProps('exp', i)}><Icon name="drag" size={15} /></span>
              <strong style={{ fontSize: 13 }}>{e.role || e.company || `Role ${i + 1}`}</strong>
              <span className="spacer" />
              <EntryToolbar label="role" canUp={i > 0} canDown={i < c.experience.length - 1}
                onUp={() => updateList('experience', moveItem(c.experience, i, -1))}
                onDown={() => updateList('experience', moveItem(c.experience, i, 1))}
                onDup={() => { const d: ExperienceEntry = { ...structuredClone(e), id: uid('exp') }; updateList('experience', [...c.experience.slice(0, i + 1), d, ...c.experience.slice(i + 1)]); }}
                onRemove={() => updateList('experience', c.experience.filter((x) => x.id !== e.id))} />
            </div>
            <div className="entry-grid">
              <Text label="Role" value={e.role} onChange={(v) => updateList('experience', c.experience.map((x) => x.id === e.id ? { ...x, role: v } : x))} />
              <Text label="Company" value={e.company} onChange={(v) => updateList('experience', c.experience.map((x) => x.id === e.id ? { ...x, company: v } : x))} />
              <Text label="Location" value={e.location} onChange={(v) => updateList('experience', c.experience.map((x) => x.id === e.id ? { ...x, location: v } : x))} />
              <Text label="Start" value={e.start} onChange={(v) => updateList('experience', c.experience.map((x) => x.id === e.id ? { ...x, start: v } : x))} />
            </div>
            <label className="row" style={{ fontSize: 13, color: 'var(--text-soft)', gap: 6, margin: '2px 0 8px' }}>
              <input type="checkbox" checked={e.current} onChange={(ev) => updateList('experience', c.experience.map((x) => x.id === e.id ? { ...x, current: ev.target.checked } : x))} />
              Current role
            </label>
            {!e.current && <Text label="End" value={e.end} onChange={(v) => updateList('experience', c.experience.map((x) => x.id === e.id ? { ...x, end: v } : x))} />}
            <Bullets bullets={e.bullets} onChange={(b) => updateList('experience', c.experience.map((x) => x.id === e.id ? { ...x, bullets: b } : x))} />
          </div>
        ))}
        <button className="btn btn-sm btn-primary" onClick={() => updateList('experience', [...c.experience, { id: uid('exp'), role: '', company: '', location: '', start: '', end: '', current: false, bullets: [''] }])}><Icon name="plus" size={14} /> Add experience</button>
      </SectionBox>

      {/* Education */}
      <SectionBox title="Education">
        {c.education.map((e, i) => (
          <div className="entry" key={e.id} {...dropProps('edu', i, 'education', c.education)}>
            <div className="row" style={{ marginBottom: 6, gap: 6 }}>
              <span {...handleProps('edu', i)}><Icon name="drag" size={15} /></span>
              <strong style={{ fontSize: 13 }}>{e.degree || e.institution || `Education ${i + 1}`}</strong>
              <span className="spacer" />
              <EntryToolbar label="education" canUp={i > 0} canDown={i < c.education.length - 1}
                onUp={() => updateList('education', moveItem(c.education, i, -1))}
                onDown={() => updateList('education', moveItem(c.education, i, 1))}
                onDup={() => { const d: EducationEntry = { ...structuredClone(e), id: uid('edu') }; updateList('education', [...c.education.slice(0, i + 1), d, ...c.education.slice(i + 1)]); }}
                onRemove={() => updateList('education', c.education.filter((x) => x.id !== e.id))} />
            </div>
            <div className="entry-grid">
              <Text label="Degree / qualification" value={e.degree} onChange={(v) => updateList('education', c.education.map((x) => x.id === e.id ? { ...x, degree: v } : x))} />
              <Text label="Institution" value={e.institution} onChange={(v) => updateList('education', c.education.map((x) => x.id === e.id ? { ...x, institution: v } : x))} />
              <Text label="Start" value={e.start} onChange={(v) => updateList('education', c.education.map((x) => x.id === e.id ? { ...x, start: v } : x))} />
              <Text label="End" value={e.end} onChange={(v) => updateList('education', c.education.map((x) => x.id === e.id ? { ...x, end: v } : x))} />
            </div>
            <Area label="Details" value={e.details} onChange={(v) => updateList('education', c.education.map((x) => x.id === e.id ? { ...x, details: v } : x))} />
          </div>
        ))}
        <button className="btn btn-sm btn-primary" onClick={() => updateList('education', [...c.education, { id: uid('edu'), degree: '', institution: '', location: '', start: '', end: '', details: '' }])}><Icon name="plus" size={14} /> Add education</button>
      </SectionBox>

      {/* Skills */}
      <SectionBox title="Skills">
        {c.skills.map((g: SkillGroup, i) => (
          <div className="entry" key={g.id}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <input className="input" style={{ maxWidth: 180 }} value={g.name} placeholder="Group name (e.g. Languages)" onChange={(e) => updateList('skills', c.skills.map((x) => x.id === g.id ? { ...x, name: e.target.value } : x))} />
              <div className="row" style={{ gap: 4 }}>
                <button className="btn btn-sm btn-ghost btn-icon" disabled={i === 0} aria-label="Move group up" onClick={() => updateList('skills', moveItem(c.skills, i, -1))}><Icon name="chevron-up" size={15} /></button>
                <button className="btn btn-sm btn-ghost btn-icon" aria-label="Remove group" onClick={() => updateList('skills', c.skills.filter((x) => x.id !== g.id))}><Icon name="trash" size={15} /></button>
              </div>
            </div>
            <SkillTags skills={g.skills} onChange={(s) => updateList('skills', c.skills.map((x) => x.id === g.id ? { ...x, skills: s } : x))} />
          </div>
        ))}
        <button className="btn btn-sm btn-primary" onClick={() => updateList('skills', [...c.skills, { id: uid('skl'), name: '', skills: [] }])}><Icon name="plus" size={14} /> Add skill group</button>
      </SectionBox>

      {/* Projects */}
      <SectionBox title="Projects" defaultOpen={false}>
        {c.projects.map((p: ProjectEntry, i) => (
          <div className="entry" key={p.id} {...dropProps('prj', i, 'projects', c.projects)}>
            <div className="row" style={{ marginBottom: 6, gap: 6 }}>
              <span {...handleProps('prj', i)}><Icon name="drag" size={15} /></span>
              <strong style={{ fontSize: 13 }}>{p.name || `Project ${i + 1}`}</strong>
              <span className="spacer" />
              <EntryToolbar label="project" canUp={i > 0} canDown={i < c.projects.length - 1}
                onUp={() => updateList('projects', moveItem(c.projects, i, -1))}
                onDown={() => updateList('projects', moveItem(c.projects, i, 1))}
                onDup={() => { const d = { ...structuredClone(p), id: uid('prj') }; updateList('projects', [...c.projects.slice(0, i + 1), d, ...c.projects.slice(i + 1)]); }}
                onRemove={() => updateList('projects', c.projects.filter((x) => x.id !== p.id))} />
            </div>
            <Text label="Name" value={p.name} onChange={(v) => updateList('projects', c.projects.map((x) => x.id === p.id ? { ...x, name: v } : x))} />
            <Area label="Description" value={p.description} onChange={(v) => updateList('projects', c.projects.map((x) => x.id === p.id ? { ...x, description: v } : x))} />
            <Text label="Link" value={p.link} onChange={(v) => updateList('projects', c.projects.map((x) => x.id === p.id ? { ...x, link: v } : x))} />
            <SkillTags skills={p.tech} onChange={(t) => updateList('projects', c.projects.map((x) => x.id === p.id ? { ...x, tech: t } : x))} />
          </div>
        ))}
        <button className="btn btn-sm btn-primary" onClick={() => updateList('projects', [...c.projects, { id: uid('prj'), name: '', description: '', link: '', tech: [] }])}><Icon name="plus" size={14} /> Add project</button>
      </SectionBox>

      {/* Certifications */}
      <SectionBox title="Certifications" defaultOpen={false}>
        {c.certifications.map((ct: CertificationEntry, i) => (
          <div className="entry" key={ct.id}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <strong style={{ fontSize: 13 }}>{ct.name || `Certification ${i + 1}`}</strong>
              <button className="btn btn-sm btn-ghost btn-icon" aria-label="Remove certification" onClick={() => updateList('certifications', c.certifications.filter((x) => x.id !== ct.id))}><Icon name="trash" size={15} /></button>
            </div>
            <div className="entry-grid">
              <Text label="Name" value={ct.name} onChange={(v) => updateList('certifications', c.certifications.map((x) => x.id === ct.id ? { ...x, name: v } : x))} />
              <Text label="Issuer" value={ct.issuer} onChange={(v) => updateList('certifications', c.certifications.map((x) => x.id === ct.id ? { ...x, issuer: v } : x))} />
            </div>
            <Text label="Date" value={ct.date} onChange={(v) => updateList('certifications', c.certifications.map((x) => x.id === ct.id ? { ...x, date: v } : x))} />
          </div>
        ))}
        <button className="btn btn-sm btn-primary" onClick={() => updateList('certifications', [...c.certifications, { id: uid('crt'), name: '', issuer: '', date: '' }])}><Icon name="plus" size={14} /> Add certification</button>
      </SectionBox>

      {/* Custom sections */}
      <SectionBox title="Custom sections" defaultOpen={false}>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>Add any section you need — Awards, Volunteering, Publications, Languages…</p>
        {c.customSections.map((s: CustomSection) => (
          <div className="entry" key={s.id}>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <input className="input" style={{ maxWidth: 200 }} value={s.title} placeholder="Section title" onChange={(e) => updateList('customSections', c.customSections.map((x) => x.id === s.id ? { ...x, title: e.target.value } : x))} />
              <button className="btn btn-sm btn-ghost btn-icon" aria-label="Remove section" onClick={() => updateList('customSections', c.customSections.filter((x) => x.id !== s.id))}><Icon name="trash" size={15} /></button>
            </div>
            {s.items.map((it) => (
              <div className="entry" key={it.id} style={{ background: 'var(--surface-2)' }}>
                <div className="entry-grid">
                  <Text label="Heading" value={it.heading} onChange={(v) => updateList('customSections', c.customSections.map((x) => x.id === s.id ? { ...x, items: x.items.map((y) => y.id === it.id ? { ...y, heading: v } : y) } : x))} />
                  <Text label="Subheading" value={it.subheading} onChange={(v) => updateList('customSections', c.customSections.map((x) => x.id === s.id ? { ...x, items: x.items.map((y) => y.id === it.id ? { ...y, subheading: v } : y) } : x))} />
                </div>
                <Text label="Date" value={it.date} onChange={(v) => updateList('customSections', c.customSections.map((x) => x.id === s.id ? { ...x, items: x.items.map((y) => y.id === it.id ? { ...y, date: v } : y) } : x))} />
                <Bullets bullets={it.bullets} onChange={(b) => updateList('customSections', c.customSections.map((x) => x.id === s.id ? { ...x, items: x.items.map((y) => y.id === it.id ? { ...y, bullets: b } : y) } : x))} />
                <button className="btn btn-sm btn-ghost btn-danger" onClick={() => updateList('customSections', c.customSections.map((x) => x.id === s.id ? { ...x, items: x.items.filter((y) => y.id !== it.id) } : x))}>Remove item</button>
              </div>
            ))}
            <button className="btn btn-sm" onClick={() => updateList('customSections', c.customSections.map((x) => x.id === s.id ? { ...x, items: [...x.items, { id: uid('itm'), heading: '', subheading: '', date: '', bullets: [''] }] } : x))}><Icon name="plus" size={14} /> Add item</button>
          </div>
        ))}
        <button className="btn btn-sm btn-primary" onClick={() => updateList('customSections', [...c.customSections, { id: uid('cst'), title: 'New section', items: [] }])}><Icon name="plus" size={14} /> Add custom section</button>
      </SectionBox>
    </div>
  );
}
