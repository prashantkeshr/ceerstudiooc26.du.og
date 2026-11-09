import { useRef, useState } from 'react';
import { extractDocx, buildContentFromExtraction, type ExtractedDoc, type SectionKeyGuess } from '../../services/imports/docxImport';
import { extractPdfText, extractPdfViaOcr } from '../../services/imports/pdfImport';
import { newResumeProject } from '../../core/models/factory';
import { useStore } from '../../state/store';
import { useEscape } from '../../hooks/useEscape';
import { Icon } from '../../components/ui/Icon';

const KEY_OPTIONS: SectionKeyGuess[] = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications', 'custom'];

type Source = 'docx' | 'pdf';

const ACCEPT: Record<Source, string> = {
  docx: '.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pdf: 'application/pdf,.pdf',
};

export function ImportModal({ source, open, onClose, onCreated }: { source: Source; open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const { saveProjectRecord } = useStore();
  const [step, setStep] = useState<'pick' | 'working' | 'review'>('pick');
  const [doc, setDoc] = useState<ExtractedDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [useOcr, setUseOcr] = useState(false);
  const [scanned, setScanned] = useState(false);
  const lastFile = useRef<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setStep('pick'); setDoc(null); setError(null); setProgress(null); setScanned(false); lastFile.current = null; };
  const close = () => { reset(); setUseOcr(false); onClose(); };

  useEscape(open, close);

  if (!open) return null;

  const run = async (file: File, ocr: boolean) => {
    setError(null);
    setProgress(null);
    setStep('working');
    try {
      let extracted: ExtractedDoc;
      if (source === 'docx') {
        extracted = await extractDocx(file);
      } else if (ocr) {
        extracted = await extractPdfViaOcr(file, (msg, frac) => setProgress(`${msg} ${Math.round(frac * 100)}%`));
      } else {
        const res = await extractPdfText(file);
        setScanned(res.scanned);
        extracted = res;
      }
      setDoc(extracted);
      setStep('review');
    } catch {
      setError('Could not read that file. It may be corrupted, password-protected, or an unsupported format.');
      setStep('pick');
    }
  };

  const onFile = async (file: File) => {
    const ok = source === 'docx' ? /\.docx$/i.test(file.name) : /\.pdf$/i.test(file.name);
    if (!ok) { setError(`Please choose a ${source === 'docx' ? '.docx' : '.pdf'} file.`); return; }
    if (file.size > 25 * 1024 * 1024) { setError('That file is larger than 25 MB. Try a smaller document.'); return; }
    lastFile.current = file;
    await run(file, useOcr);
  };

  const create = async () => {
    if (!doc) return;
    const content = buildContentFromExtraction(doc);
    const proj = newResumeProject({ title: content.fullName ? `${content.fullName} — Imported` : 'Imported resume', templateId: 'modern', content });
    await saveProjectRecord(proj);
    onCreated(proj.id);
    reset();
    setUseOcr(false);
  };

  const label = source === 'docx' ? 'Word (.docx)' : 'PDF';

  return (
    <div role="dialog" aria-modal="true" aria-label={`Import from ${label}`} onClick={close}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'grid', placeItems: 'center', zIndex: 100, padding: 16 }}>
      <div className="card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, width: '100%', maxHeight: '88vh', overflow: 'auto', padding: 20 }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <h3>{source === 'pdf' ? 'Rebuild a resume from a PDF' : 'Import resume from Word (.docx)'}</h3>
          <button className="btn btn-sm btn-ghost btn-icon" aria-label="Close" onClick={close}><Icon name="x" /></button>
        </div>

        {step === 'pick' && (
          <>
            <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>
              Text and structure are extracted locally in your browser. <strong>Visual formatting is not preserved</strong> — you’ll review the
              detected sections before anything is created, and can fix everything afterwards in the editor.
            </p>
            {source === 'pdf' && (
              <label className="row" style={{ gap: 8, fontSize: 13, marginBottom: 10 }}>
                <input type="checkbox" checked={useOcr} onChange={(e) => setUseOcr(e.target.checked)} />
                This PDF is scanned — use OCR (downloads a language model on first use; needs internet)
              </label>
            )}
            {error && <div className="card" style={{ padding: 10, marginBottom: 10, borderColor: 'var(--danger)' }}><span className="sev-error" style={{ fontSize: 13 }}>{error}</span></div>}
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} /> Choose a {source === 'docx' ? '.docx' : '.pdf'} file</button>
            <input ref={fileRef} type="file" accept={ACCEPT[source]} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
          </>
        )}

        {step === 'working' && (
          <div>
            <p className="muted">{progress ?? (source === 'pdf' && useOcr ? 'Starting OCR…' : 'Reading document…')}</p>
            {source === 'pdf' && useOcr && <p className="faint" style={{ fontSize: 12 }}>OCR can take a while and downloads a model on first use.</p>}
          </div>
        )}

        {step === 'review' && doc && (
          <>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Review and correct the extracted content, then create the resume. Reclassify any mislabelled section with the dropdown.</p>
            {(doc.warnings.length > 0 || scanned) && (
              <div className="card" style={{ padding: 10, marginBottom: 12, borderColor: 'var(--warning)' }}>
                {doc.warnings.map((w, i) => <div key={i} className="sev-warning" style={{ fontSize: 12.5 }}><Icon name="alert" size={13} /> {w}</div>)}
                {source === 'pdf' && scanned && !useOcr && lastFile.current && (
                  <button className="btn btn-sm" style={{ marginTop: 8 }} onClick={() => { setUseOcr(true); run(lastFile.current!, true); }}>Re-run with OCR</button>
                )}
              </div>
            )}
            <div className="entry-grid">
              <div className="field"><label>Name</label><input className="input" value={doc.name} onChange={(e) => setDoc({ ...doc, name: e.target.value })} /></div>
              <div className="field"><label>Title</label><input className="input" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} /></div>
            </div>
            <div className="field"><label>Contact line (email, phone, links)</label><input className="input" value={doc.contactLine} onChange={(e) => setDoc({ ...doc, contactLine: e.target.value })} /></div>

            {doc.sections.map((s, idx) => (
              <div className="entry" key={s.id}>
                <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                  <input className="input" style={{ maxWidth: 220 }} value={s.title} onChange={(e) => { const next = [...doc.sections]; next[idx] = { ...s, title: e.target.value }; setDoc({ ...doc, sections: next }); }} />
                  <select className="select" style={{ maxWidth: 160 }} value={s.key} onChange={(e) => { const next = [...doc.sections]; next[idx] = { ...s, key: e.target.value as SectionKeyGuess }; setDoc({ ...doc, sections: next }); }}>
                    {KEY_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <textarea className="textarea" rows={Math.min(8, Math.max(3, s.text.split('\n').length))} value={s.text}
                  onChange={(e) => { const next = [...doc.sections]; next[idx] = { ...s, text: e.target.value }; setDoc({ ...doc, sections: next }); }} />
                <p className="faint" style={{ fontSize: 11.5, margin: '4px 0 0' }}>One entry per line; start a line with “•” or “-” for a bullet. Headers like “Role — Company 2021 – 2024” are parsed automatically.</p>
              </div>
            ))}

            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn btn-ghost" onClick={reset}>Start over</button>
              <button className="btn btn-primary" onClick={create}><Icon name="check" size={15} /> Create resume</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
