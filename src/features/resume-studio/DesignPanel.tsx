import { useMemo, useRef, useState } from 'react';
import type { FontKey, HeadingStyle, ResumeData, ResumeDesign } from '../../core/models/types';
import { TEMPLATES, getTemplate } from './templates/registry';
import { SECTION_TITLES, isBuiltIn } from './sections';
import { defaultDesign } from '../../core/models/factory';
import { fontsByCategory } from './fonts';
import { TemplateThumb, thumbContent } from './TemplateThumb';
import { Icon } from '../../components/ui/Icon';
import { useStore } from '../../state/store';

type PatchData = (fn: (d: ResumeData) => ResumeData) => void;

const ACCENTS = ['#2563eb', '#1d4ed8', '#0d9488', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#9a3412', '#1f2937', '#334155'];
const PALETTES: { name: string; accent: string; nameColor: string; headingColor: string }[] = [
  { name: 'Ocean', accent: '#2563eb', nameColor: '#0f172a', headingColor: '#2563eb' },
  { name: 'Teal', accent: '#0d9488', nameColor: '#0f172a', headingColor: '#0d9488' },
  { name: 'Plum', accent: '#7c3aed', nameColor: '#1f2937', headingColor: '#6d28d9' },
  { name: 'Rose', accent: '#db2777', nameColor: '#1f2937', headingColor: '#be185d' },
  { name: 'Ember', accent: '#ea580c', nameColor: '#1f2937', headingColor: '#c2410c' },
  { name: 'Forest', accent: '#15803d', nameColor: '#14271a', headingColor: '#15803d' },
  { name: 'Graphite', accent: '#334155', nameColor: '#0f172a', headingColor: '#334155' },
  { name: 'Crimson', accent: '#b91c1c', nameColor: '#1f2937', headingColor: '#991b1b' },
];
const HEADINGS: { key: HeadingStyle; label: string }[] = [
  { key: 'bar', label: 'Bar' },
  { key: 'underline', label: 'Underline' },
  { key: 'plain', label: 'Plain' },
  { key: 'uppercase', label: 'Spaced' },
];
const PRESETS: { name: string; design: Partial<ResumeDesign> }[] = [
  { name: 'Professional', design: { accent: '#2563eb', fontFamily: 'inter', headingFont: 'inter', headingStyle: 'bar' } },
  { name: 'Minimal', design: { accent: '#111827', fontFamily: 'inter', headingFont: 'inter', headingStyle: 'uppercase' } },
  { name: 'Classic', design: { accent: '#1f2937', fontFamily: 'georgia', headingFont: 'georgia', headingStyle: 'underline' } },
  { name: 'Elegant', design: { accent: '#9a3412', fontFamily: 'garamond', headingFont: 'playfair', headingStyle: 'uppercase' } },
  { name: 'Bold', design: { accent: '#7c3aed', fontFamily: 'inter', headingFont: 'montserrat', headingStyle: 'bar' } },
];

function FontSelect({ label, value, onChange }: { label: string; value: FontKey; onChange: (v: FontKey) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select className="select" value={value} onChange={(e) => onChange(e.target.value as FontKey)}>
        {fontsByCategory().map(([cat, fonts]) => (
          <optgroup key={cat} label={cat}>
            {fonts.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function ColourRow({ label, value, fallback, onChange }: { label: string; value?: string; fallback: string; onChange: (v: string | undefined) => void }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', margin: '6px 0' }}>
      <span style={{ fontSize: 13, color: 'var(--text-soft)', fontWeight: 600 }}>{label}</span>
      <div className="row" style={{ gap: 6 }}>
        <input type="color" aria-label={label} value={value ?? fallback} onChange={(e) => onChange(e.target.value)} style={{ width: 26, height: 26, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
        <button className="btn btn-sm btn-ghost" onClick={() => onChange(undefined)} disabled={!value}>Auto</button>
      </div>
    </div>
  );
}

function Range({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="field">
      <div className="range-label"><span>{label}</span><span>{format(value)}</span></div>
      <input className="range" type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function DesignPanel({ data, patchData }: { data: ResumeData; patchData: PatchData }) {
  const { mode } = useStore();
  const d = data.design;
  const thumbC = useMemo(() => thumbContent(data.content), [data.content]);
  const dragKey = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const setDesign = (patch: Partial<ResumeDesign>) => patchData((prev) => ({ ...prev, design: { ...prev.design, ...patch } }));
  const twoCol = (d.columns ?? 'single') === 'two';
  const sidebarSet = new Set(d.sidebarSections ?? []);

  const sectionLabel = (key: string) =>
    isBuiltIn(key) ? SECTION_TITLES[key] : data.content.customSections.find((s) => s.id === key)?.title ?? 'Section';

  const toggleHidden = (key: string) =>
    patchData((prev) => ({
      ...prev,
      hiddenSections: prev.hiddenSections.includes(key) ? prev.hiddenSections.filter((k) => k !== key) : [...prev.hiddenSections, key],
    }));

  // Move a section to a column (main/sidebar), optionally before a target key.
  const moveTo = (key: string, col: 'main' | 'sidebar', beforeKey?: string) =>
    patchData((prev) => {
      const side = new Set(prev.design.sidebarSections ?? []);
      if (col === 'sidebar') side.add(key); else side.delete(key);
      let order = prev.sectionOrder.filter((k) => k !== key);
      if (beforeKey && beforeKey !== key) {
        const idx = order.indexOf(beforeKey);
        order.splice(idx < 0 ? order.length : idx, 0, key);
      } else {
        let last = -1;
        order.forEach((k, i) => { if ((col === 'sidebar') === side.has(k)) last = i; });
        order.splice(last + 1, 0, key);
      }
      return { ...prev, sectionOrder: order, design: { ...prev.design, sidebarSections: order.filter((k) => side.has(k)) } };
    });

  const switchTemplate = (id: string) => patchData((prev) => {
    const t = getTemplate(id);
    const isTwo = t.layout === 'sidebar';
    return {
      ...prev,
      templateId: id,
      design: {
        ...prev.design,
        accent: t.defaults.accent,
        fontFamily: t.defaults.font,
        headingFont: t.defaults.headingFont ?? t.defaults.font,
        headingStyle: t.defaults.heading,
        columns: isTwo ? 'two' : 'single',
        sidebarSections: isTwo ? (prev.design.sidebarSections?.length ? prev.design.sidebarSections : ['skills']) : [],
        sidebarSide: id === 'corporate' ? 'right' : 'left',
      },
    };
  });

  const DragRow = ({ k, col }: { k: string; col: 'main' | 'sidebar' }) => {
    const hidden = data.hiddenSections.includes(k);
    return (
      <div
        draggable
        onDragStart={(e) => { dragKey.current = k; e.dataTransfer.effectAllowed = 'move'; }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(k); }}
        onDragLeave={() => setDragOver((p) => (p === k ? null : p))}
        onDrop={(e) => { e.preventDefault(); if (dragKey.current) moveTo(dragKey.current, col, k); dragKey.current = null; setDragOver(null); }}
        className="dnd-row"
        style={{ opacity: hidden ? 0.5 : 1, outline: dragOver === k ? '2px dashed var(--accent)' : 'none' }}
      >
        <Icon name="drag" size={15} className="faint" />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{sectionLabel(k)}</span>
        <button className="btn btn-sm btn-ghost btn-icon" aria-label={hidden ? 'Show section' : 'Hide section'} onClick={() => toggleHidden(k)}><Icon name={hidden ? 'eye-off' : 'eye'} size={15} /></button>
      </div>
    );
  };

  const Column = ({ col, title }: { col: 'main' | 'sidebar'; title: string }) => {
    const keys = data.sectionOrder.filter((k) => (col === 'sidebar') === sidebarSet.has(k));
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver('col-' + col); }}
        onDrop={(e) => { e.preventDefault(); if (dragKey.current) moveTo(dragKey.current, col); dragKey.current = null; setDragOver(null); }}
        className="dnd-col"
        style={{ outline: dragOver === 'col-' + col ? '2px dashed var(--accent)' : '1px solid var(--border)' }}
      >
        <div className="faint" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{title}</div>
        {keys.length === 0 ? <div className="faint" style={{ fontSize: 12, padding: '6px 2px' }}>Drag sections here</div> : keys.map((k) => <DragRow key={k} k={k} col={col} />)}
      </div>
    );
  };

  return (
    <div className="panel-pad">
      <h4 style={{ marginBottom: 8 }}>Template</h4>
      <div className="tpl-pick">
        {TEMPLATES.map((t) => (
          <button key={t.id} className={`tpl-opt ${t.id === data.templateId ? 'active' : ''}`} onClick={() => switchTemplate(t.id)} title={t.description}>
            <TemplateThumb templateId={t.id} content={thumbC} pageSize={d.pageSize} />
            <strong>{t.name}</strong>
            <span>{t.category}</span>
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>Switching a template restyles the page and keeps all your content.</p>

      <h4 style={{ margin: '18px 0 8px' }}>Quick styles</h4>
      <div className="row-wrap">
        {PRESETS.map((p) => <button key={p.name} className="btn btn-sm" onClick={() => setDesign(p.design)}>{p.name}</button>)}
        <button className="btn btn-sm btn-ghost" onClick={() => { const t = getTemplate(data.templateId).defaults; setDesign({ ...defaultDesign(), accent: t.accent, fontFamily: t.font, headingFont: t.headingFont ?? t.font, headingStyle: t.heading, columns: d.columns, sidebarSections: d.sidebarSections, sidebarSide: d.sidebarSide }); }}>Reset</button>
      </div>

      <h4 style={{ margin: '18px 0 8px' }}>Accent colour</h4>
      <div className="swatches">
        {ACCENTS.map((a) => <button key={a} className={`swatch ${a === d.accent ? 'active' : ''}`} style={{ background: a }} aria-label={`Accent ${a}`} onClick={() => setDesign({ accent: a })} />)}
        <input type="color" aria-label="Custom accent colour" value={d.accent} onChange={(e) => setDesign({ accent: e.target.value })} style={{ width: 28, height: 28, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
      </div>

      <h4 style={{ margin: '18px 0 8px' }}>Colour palettes</h4>
      <div className="swatches">
        {PALETTES.map((p) => (
          <button key={p.name} className="swatch" title={p.name} aria-label={`${p.name} palette`} style={{ background: p.accent }}
            onClick={() => setDesign({ accent: p.accent, nameColor: p.nameColor, headingColor: p.headingColor })} />
        ))}
      </div>

      <h4 style={{ margin: '18px 0 8px' }}>Fonts</h4>
      <FontSelect label="Heading font" value={d.headingFont ?? d.fontFamily} onChange={(v) => setDesign({ headingFont: v })} />
      <FontSelect label="Body font" value={d.fontFamily} onChange={(v) => setDesign({ fontFamily: v })} />
      <p className="faint" style={{ fontSize: 11, marginTop: -4 }}>System fonts work offline; the rest load from Google Fonts.</p>

      <div className="field">
        <label>Heading style</label>
        <div className="seg" role="group" aria-label="Heading style">
          {HEADINGS.map((h) => <button key={h.key} className={h.key === d.headingStyle ? 'active' : ''} onClick={() => setDesign({ headingStyle: h.key })}>{h.label}</button>)}
        </div>
      </div>
      <div className="field">
        <label>Section divider</label>
        <div className="seg" role="group" aria-label="Section divider">
          <button className={(d.divider ?? 'none') === 'none' ? 'active' : ''} onClick={() => setDesign({ divider: 'none' })}>None</button>
          <button className={d.divider === 'line' ? 'active' : ''} onClick={() => setDesign({ divider: 'line' })}>Line</button>
        </div>
      </div>
      {!twoCol && (
        <label className="row" style={{ gap: 8, fontSize: 14, marginTop: 4 }}>
          <input type="checkbox" checked={!!d.headerBand} onChange={(e) => setDesign({ headerBand: e.target.checked })} /> Coloured header band
        </label>
      )}

      <h4 style={{ margin: '18px 0 8px' }}>Photo</h4>
      <label className="row" style={{ gap: 8, fontSize: 14 }}>
        <input type="checkbox" checked={!!d.showPhoto} onChange={(e) => setDesign({ showPhoto: e.target.checked })} /> Show profile photo
      </label>
      {d.showPhoto && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>Photo shape</label>
          <div className="seg" role="group" aria-label="Photo shape">
            {(['circle', 'rounded', 'square'] as const).map((s) => <button key={s} className={(d.photoShape ?? 'circle') === s ? 'active' : ''} onClick={() => setDesign({ photoShape: s })} style={{ textTransform: 'capitalize' }}>{s}</button>)}
          </div>
          <p className="faint" style={{ fontSize: 11, marginTop: 4 }}>Upload the photo in the Content panel → Details.</p>
        </div>
      )}

      <h4 style={{ margin: '18px 0 8px' }}>Layout</h4>
      <div className="seg" role="group" aria-label="Column layout">
        <button className={!twoCol ? 'active' : ''} onClick={() => setDesign({ columns: 'single' })}>Single column</button>
        <button className={twoCol ? 'active' : ''} onClick={() => setDesign({ columns: 'two', sidebarSections: d.sidebarSections?.length ? d.sidebarSections : ['skills'] })}>Two columns</button>
      </div>
      {twoCol && (
        <div className="field" style={{ marginTop: 8 }}>
          <label>Sidebar side</label>
          <div className="seg" role="group" aria-label="Sidebar side">
            <button className={(d.sidebarSide ?? 'left') === 'left' ? 'active' : ''} onClick={() => setDesign({ sidebarSide: 'left' })}>Left</button>
            <button className={d.sidebarSide === 'right' ? 'active' : ''} onClick={() => setDesign({ sidebarSide: 'right' })}>Right</button>
          </div>
        </div>
      )}

      {mode === 'advanced' && (
        <>
          <h4 style={{ margin: '18px 0 8px' }}>Advanced</h4>
          <Range label="Text size" value={d.fontScale} min={0.85} max={1.15} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setDesign({ fontScale: v })} />
          <Range label="Line height" value={d.lineHeight} min={1.2} max={1.7} step={0.05} format={(v) => v.toFixed(2)} onChange={(v) => setDesign({ lineHeight: v })} />
          <Range label="Section spacing" value={d.sectionSpacing} min={10} max={36} step={1} format={(v) => `${v}px`} onChange={(v) => setDesign({ sectionSpacing: v })} />
          <div className="field">
            <label>Page size</label>
            <div className="seg" role="group" aria-label="Page size">
              <button className={d.pageSize === 'a4' ? 'active' : ''} onClick={() => setDesign({ pageSize: 'a4' })}>A4</button>
              <button className={d.pageSize === 'letter' ? 'active' : ''} onClick={() => setDesign({ pageSize: 'letter' })}>Letter</button>
            </div>
          </div>

          <h4 style={{ margin: '18px 0 8px' }}>Colours &amp; sizing</h4>
          <ColourRow label="Name colour" value={d.nameColor} fallback="#1a1a1a" onChange={(v) => setDesign({ nameColor: v })} />
          <ColourRow label="Heading colour" value={d.headingColor} fallback={d.accent} onChange={(v) => setDesign({ headingColor: v })} />
          <ColourRow label="Body text colour" value={d.textColor} fallback="#1a1a1a" onChange={(v) => setDesign({ textColor: v })} />
          <Range label="Name size" value={d.nameScale ?? 1} min={0.8} max={1.4} step={0.02} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setDesign({ nameScale: v })} />
          <Range label="Heading size" value={d.headingScale ?? 1} min={0.8} max={1.3} step={0.02} format={(v) => `${Math.round(v * 100)}%`} onChange={(v) => setDesign({ headingScale: v })} />
        </>
      )}

      <h4 style={{ margin: '18px 0 8px' }}>Sections</h4>
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Drag to reorder{twoCol ? ' or move between columns' : ''}. The eye hides a section (its content is kept).</p>
      {twoCol ? (
        <div className="stack" style={{ gap: 10 }}>
          <Column col="sidebar" title="Sidebar" />
          <Column col="main" title="Main column" />
        </div>
      ) : (
        <Column col="main" title="Order" />
      )}
    </div>
  );
}
