import { useEffect, type CSSProperties } from 'react';
import type { ResumeContent, ResumeData } from '../../core/models/types';
import { getTemplate } from './templates/registry';
import { SECTION_TITLES } from './sections';
import { Editable } from './Editable';
import { FONT_STACK, ensureFont } from './fonts';

const PAGE_DIMS = {
  a4: { w: 794, h: 1123 },
  letter: { w: 816, h: 1056 },
};

type Commit = (fn: (c: ResumeContent) => ResumeContent) => void;
interface EditCtx { on: boolean; commit: Commit; }

function dateSpan(start: string, end: string, current?: boolean): string {
  const e = current ? 'Present' : end;
  return [start, e].filter(Boolean).join(' – ');
}

function ContactLine({ c }: { c: ResumeContent }) {
  const parts = [c.email, c.phone, c.location, c.website].filter(Boolean);
  const links = c.links.filter((l) => l.url);
  if (parts.length === 0 && links.length === 0) return null;
  return (
    <div className="r-contact">
      {parts.map((p, i) => (
        <span key={`p${i}`}>{i > 0 && <span className="sep">•&nbsp;</span>}{p}</span>
      ))}
      {links.map((l) => (
        <span key={l.id}><span className="sep">•&nbsp;</span>
          <a href={l.url.startsWith('http') ? l.url : `https://${l.url}`}>{l.label || l.url}</a>
        </span>
      ))}
    </div>
  );
}

function Section({ k, content, isTech, ec }: { k: string; content: ResumeContent; isTech: boolean; ec: EditCtx }) {
  const c = content;
  const on = ec.on;
  const setExp = (id: string, patch: Partial<ResumeContent['experience'][number]>) =>
    ec.commit((p) => ({ ...p, experience: p.experience.map((e) => e.id === id ? { ...e, ...patch } : e) }));
  const setEdu = (id: string, patch: Partial<ResumeContent['education'][number]>) =>
    ec.commit((p) => ({ ...p, education: p.education.map((e) => e.id === id ? { ...e, ...patch } : e) }));
  const setProj = (id: string, patch: Partial<ResumeContent['projects'][number]>) =>
    ec.commit((p) => ({ ...p, projects: p.projects.map((e) => e.id === id ? { ...e, ...patch } : e) }));
  const setCert = (id: string, patch: Partial<ResumeContent['certifications'][number]>) =>
    ec.commit((p) => ({ ...p, certifications: p.certifications.map((e) => e.id === id ? { ...e, ...patch } : e) }));
  const setBullet = (id: string, i: number, v: string) =>
    ec.commit((p) => ({ ...p, experience: p.experience.map((e) => e.id === id ? { ...e, bullets: e.bullets.map((b, j) => j === i ? v : b) } : e) }));

  switch (k) {
    case 'summary':
      if (!c.summary.trim() && !on) return null;
      return (
        <section className="r-section">
          <h2 className="r-sec-title">{SECTION_TITLES.summary}</h2>
          <Editable as="div" className="r-summary" multiline editing={on} value={c.summary} placeholder="Professional summary…" onCommit={(v) => ec.commit((p) => ({ ...p, summary: v }))} />
        </section>
      );
    case 'experience':
      if (!c.experience.length) return null;
      return (
        <section className="r-section">
          <h2 className="r-sec-title">{SECTION_TITLES.experience}</h2>
          {c.experience.map((e) => (
            <div className="r-item" key={e.id}>
              <div className="r-item-head">
                <span>
                  <Editable className="r-role" editing={on} value={e.role} placeholder="Role" onCommit={(v) => setExp(e.id, { role: v })} />
                  {(e.company || on) && <span className="r-org"> — <Editable editing={on} value={e.company} placeholder="Company" onCommit={(v) => setExp(e.id, { company: v })} /></span>}
                </span>
                <span className="r-date">{dateSpan(e.start, e.end, e.current)}</span>
              </div>
              {e.location && <div className="r-detail">{e.location}</div>}
              {e.bullets.some((b) => b.trim()) && (
                <ul className="r-bullets">
                  {e.bullets.map((b, i) => (b.trim() || on) ? <li key={i}><Editable editing={on} value={b} placeholder="Achievement…" onCommit={(v) => setBullet(e.id, i, v)} /></li> : null)}
                </ul>
              )}
            </div>
          ))}
        </section>
      );
    case 'education':
      if (!c.education.length) return null;
      return (
        <section className="r-section">
          <h2 className="r-sec-title">{SECTION_TITLES.education}</h2>
          {c.education.map((e) => (
            <div className="r-item" key={e.id}>
              <div className="r-item-head">
                <span>
                  <Editable className="r-role" editing={on} value={e.degree} placeholder="Degree" onCommit={(v) => setEdu(e.id, { degree: v })} />
                  {(e.institution || on) && <span className="r-org"> — <Editable editing={on} value={e.institution} placeholder="Institution" onCommit={(v) => setEdu(e.id, { institution: v })} /></span>}
                </span>
                <span className="r-date">{dateSpan(e.start, e.end)}</span>
              </div>
              {(e.details || on) && <Editable as="div" className="r-detail" editing={on} value={e.details} placeholder="Details…" onCommit={(v) => setEdu(e.id, { details: v })} />}
            </div>
          ))}
        </section>
      );
    case 'skills':
      if (!c.skills.length) return null;
      return (
        <section className="r-section">
          <h2 className="r-sec-title">{SECTION_TITLES.skills}</h2>
          {c.skills.map((g) =>
            isTech ? (
              <div className="r-skillgroup" key={g.id}><b>{g.name}</b><div className="r-chip-list">{g.skills.map((s, i) => <span key={i}>{s}</span>)}</div></div>
            ) : (
              <div className="r-skillgroup" key={g.id}><b>{g.name}:</b> {g.skills.join(', ')}</div>
            ),
          )}
        </section>
      );
    case 'projects':
      if (!c.projects.length) return null;
      return (
        <section className="r-section">
          <h2 className="r-sec-title">{SECTION_TITLES.projects}</h2>
          {c.projects.map((p) => (
            <div className="r-item" key={p.id}>
              <div className="r-item-head">
                <Editable className="r-role" editing={on} value={p.name} placeholder="Project" onCommit={(v) => setProj(p.id, { name: v })} />
                {p.link && <a className="r-proj-link" href={p.link.startsWith('http') ? p.link : `https://${p.link}`}>{p.link}</a>}
              </div>
              {(p.description || on) && <Editable as="div" className="r-detail" editing={on} value={p.description} placeholder="Description…" onCommit={(v) => setProj(p.id, { description: v })} />}
              {p.tech.length > 0 && <div className="r-tech">{p.tech.join(' · ')}</div>}
            </div>
          ))}
        </section>
      );
    case 'certifications':
      if (!c.certifications.length) return null;
      return (
        <section className="r-section">
          <h2 className="r-sec-title">{SECTION_TITLES.certifications}</h2>
          {c.certifications.map((ct) => (
            <div className="r-item" key={ct.id}>
              <div className="r-item-head">
                <span>
                  <Editable className="r-role" editing={on} value={ct.name} placeholder="Certification" onCommit={(v) => setCert(ct.id, { name: v })} />
                  {(ct.issuer || on) && <span className="r-org"> — <Editable editing={on} value={ct.issuer} placeholder="Issuer" onCommit={(v) => setCert(ct.id, { issuer: v })} /></span>}
                </span>
                <span className="r-date">{ct.date}</span>
              </div>
            </div>
          ))}
        </section>
      );
    default: {
      const cs = c.customSections.find((s) => s.id === k);
      if (!cs || !cs.items.length) return null;
      return (
        <section className="r-section">
          <h2 className="r-sec-title">{cs.title}</h2>
          {cs.items.map((it) => (
            <div className="r-item" key={it.id}>
              <div className="r-item-head">
                <span><span className="r-role">{it.heading}</span>{it.subheading && <span className="r-org"> — {it.subheading}</span>}</span>
                <span className="r-date">{it.date}</span>
              </div>
              {it.bullets.some((b) => b.trim()) && (
                <ul className="r-bullets">{it.bullets.filter((b) => b.trim()).map((b, i) => <li key={i}>{b}</li>)}</ul>
              )}
            </div>
          ))}
        </section>
      );
    }
  }
}

export function ResumePreview({ data, editing = false, commit }: {
  data: ResumeData;
  editing?: boolean;
  commit?: Commit;
}) {
  const tpl = getTemplate(data.templateId);
  const c = data.content;
  const dims = PAGE_DIMS[data.design.pageSize];
  const isTech = tpl.id === 'technical';
  const ec: EditCtx = { on: editing && !!commit, commit: commit ?? (() => {}) };

  const headingFont = data.design.headingFont ?? data.design.fontFamily;
  // Load any on-demand (Google) fonts the document uses.
  useEffect(() => { ensureFont(data.design.fontFamily); ensureFont(headingFont); }, [data.design.fontFamily, headingFont]);

  const visible = data.sectionOrder.filter((k) => !data.hiddenSections.includes(k));

  const style = {
    '--r-accent': data.design.accent,
    '--doc-font': FONT_STACK[data.design.fontFamily],
    '--doc-heading-font': FONT_STACK[headingFont],
    '--doc-scale': data.design.fontScale,
    '--doc-lh': data.design.lineHeight,
    '--doc-sec-gap': `${data.design.sectionSpacing}px`,
    '--page-w': `${dims.w}px`,
    '--page-h': `${dims.h}px`,
  } as CSSProperties;

  const name = (
    <>
      <Editable as="div" className="r-name" editing={ec.on} value={c.fullName} placeholder="Your Name" onCommit={(v) => ec.commit((p) => ({ ...p, fullName: v }))} />
      {(c.title || ec.on) && <Editable as="div" className="r-title" editing={ec.on} value={c.title} placeholder="Professional title" onCommit={(v) => ec.commit((p) => ({ ...p, title: v }))} />}
    </>
  );

  // Two columns when the design asks for it (defaults seeded from the template).
  const twoCol = (data.design.columns ?? (tpl.layout === 'sidebar' ? 'two' : 'single')) === 'two';
  const sidebarSet = new Set(data.design.sidebarSections ?? (tpl.layout === 'sidebar' ? ['skills'] : []));
  const side = data.design.sidebarSide ?? 'left';
  const cls = `paper tpl-${tpl.id}${twoCol ? ' two-col' : ''}${ec.on ? ' editing' : ''}`;

  if (twoCol) {
    const sideKeys = visible.filter((k) => sidebarSet.has(k));
    const mainKeys = visible.filter((k) => !sidebarSet.has(k));
    return (
      <div className={cls} data-heading={data.design.headingStyle} data-side={side} style={style}>
        <div className="r-layout">
          <aside className="r-side">
            {name}
            <ContactLine c={c} />
            {sideKeys.map((k) => <Section key={k} k={k} content={c} isTech={isTech} ec={ec} />)}
          </aside>
          <div className="r-main">
            {mainKeys.map((k) => <Section key={k} k={k} content={c} isTech={isTech} ec={ec} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cls} data-heading={data.design.headingStyle} style={style}>
      <header className="r-header">{name}<ContactLine c={c} /></header>
      {visible.map((k) => <Section key={k} k={k} content={c} isTech={isTech} ec={ec} />)}
    </div>
  );
}
