import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { StoredAsset } from '../../core/models/types';
import { uid } from '../../core/models/factory';
import * as dbApi from '../../core/storage/db';
import { applyEdits, defaultEdits, loadImage, dataUrlBytes, type ImageEdits } from '../../services/images/edit';
import { Confirm } from '../../components/ui/Confirm';
import { Icon } from '../../components/ui/Icon';

function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AssetStudio() {
  const [assets, setAssets] = useState<StoredAsset[]>([]);
  const [query, setQuery] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [edits, setEdits] = useState<ImageEdits>(defaultEdits());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const cropBox = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { dbApi.listAssets().then(setAssets).catch(() => setAssets([])); }, []);

  const selected = assets.find((a) => a.id === selId) ?? null;

  // Reset edits when selecting a different asset.
  useEffect(() => { setEdits(defaultEdits()); setCropMode(false); }, [selId]);

  // Live edited preview (debounced).
  useEffect(() => {
    if (!selected) { setPreviewUrl(null); return; }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const r = await applyEdits(selected.dataUrl, edits, /png/i.test(selected.name) ? 'image/png' : 'image/jpeg');
        if (!cancelled) setPreviewUrl(r.dataUrl);
      } catch { /* ignore */ }
    }, 120);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [selected, edits]);

  const onUpload = useCallback(async (files: FileList) => {
    setBusy('Adding images…');
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = () => rej(new Error('read failed'));
          r.readAsDataURL(file);
        });
        const img = await loadImage(dataUrl);
        const asset: StoredAsset = {
          id: uid('ast'), name: file.name, dataUrl, width: img.width, height: img.height,
          size: dataUrlBytes(dataUrl), alt: '', createdAt: Date.now(),
        };
        await dbApi.saveAsset(asset);
      }
      setAssets(await dbApi.listAssets());
    } finally { setBusy(null); }
  }, []);

  const patchAsset = async (id: string, patch: Partial<StoredAsset>) => {
    const next = assets.map((a) => a.id === id ? { ...a, ...patch } : a);
    setAssets(next);
    const a = next.find((x) => x.id === id);
    if (a) await dbApi.saveAsset(a);
  };

  const remove = async (id: string) => {
    await dbApi.deleteAsset(id);
    setAssets(await dbApi.listAssets());
    if (selId === id) setSelId(null);
  };

  const saveVariant = async () => {
    if (!selected) return;
    setBusy('Saving variant…');
    try {
      const r = await applyEdits(selected.dataUrl, edits, /png/i.test(selected.name) ? 'image/png' : 'image/jpeg');
      const base = selected.name.replace(/\.[^.]+$/, '');
      const ext = edits.cornerRadius > 0 || /png/i.test(selected.name) ? 'png' : 'jpg';
      const asset: StoredAsset = { id: uid('ast'), name: `${base}-edited.${ext}`, dataUrl: r.dataUrl, width: r.width, height: r.height, size: r.size, alt: selected.alt, createdAt: Date.now() };
      await dbApi.saveAsset(asset);
      setAssets(await dbApi.listAssets());
      setSelId(asset.id);
    } finally { setBusy(null); }
  };

  const download = () => {
    if (!previewUrl || !selected) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = selected.name.replace(/\.[^.]+$/, '') + (edits.cornerRadius > 0 ? '.png' : /png/i.test(selected.name) ? '.png' : '.jpg');
    document.body.appendChild(a); a.click(); a.remove();
  };

  // Crop drag on the original image.
  const startCrop = (e: React.PointerEvent) => {
    const box = cropBox.current!.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    dragRef.current = { x, y };
    setEdits((prev) => ({ ...prev, crop: { x, y, w: 0, h: 0 } }));
    window.addEventListener('pointermove', onCropMove);
    window.addEventListener('pointerup', endCrop);
  };
  const onCropMove = (e: PointerEvent) => {
    const d = dragRef.current; if (!d || !cropBox.current) return;
    const box = cropBox.current.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    setEdits((prev) => ({ ...prev, crop: { x: Math.min(d.x, x), y: Math.min(d.y, y), w: Math.abs(x - d.x), h: Math.abs(y - d.y) } }));
  };
  const endCrop = () => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onCropMove);
    window.removeEventListener('pointerup', endCrop);
    setEdits((prev) => (prev.crop && (prev.crop.w < 0.02 || prev.crop.h < 0.02) ? { ...prev, crop: undefined } : prev));
    setCropMode(false);
  };

  const filtered = assets.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()) || a.alt.toLowerCase().includes(query.toLowerCase()));
  const rot = (dir: 1 | -1) => setEdits((e) => ({ ...e, rotate: (((e.rotate + dir * 90) % 360) + 360) % 360 }));

  return (
    <div className="content content-wide" style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 18px 60px' }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ gap: 10 }}>
          <Link className="btn btn-sm btn-ghost btn-icon" to="/" aria-label="Back"><Icon name="home" /></Link>
          <div>
            <h1 style={{ fontSize: 20 }}>Image & Asset Studio</h1>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>Upload, organise and edit images — crop, rotate, flip, resize, round corners. All local.</p>
          </div>
        </div>
        {busy && <span className="save-pill"><span className="save-dot saving" />{busy}</span>}
      </div>

      <div className="row-wrap" style={{ marginBottom: 14 }}>
        <button className="btn btn-primary" onClick={() => uploadRef.current?.click()}><Icon name="upload" size={15} /> Upload images</button>
        <input className="input" style={{ maxWidth: 240 }} placeholder="Search by name or alt text" value={query} onChange={(e) => setQuery(e.target.value)} />
        <input ref={uploadRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) onUpload(e.target.files); e.target.value = ''; }} />
      </div>

      {assets.length === 0 ? (
        <div className="card" style={{ padding: 36, textAlign: 'center' }}><p className="muted" style={{ margin: 0 }}>No images yet. Upload some to build a reusable library — stored only in this browser.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,420px)', gap: 16, alignItems: 'start' }}>
          {/* Library */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {filtered.map((a) => (
              <div key={a.id} className="card" style={{ padding: 8, outline: a.id === selId ? '2px solid var(--accent)' : 'none', outlineOffset: -1 }}>
                <button onClick={() => setSelId(a.id)} aria-label={`Select ${a.name}`} style={{ display: 'block', width: '100%', border: 'none', background: '#f4f5f7', borderRadius: 4, padding: 0, cursor: 'pointer', aspectRatio: '1', overflow: 'hidden' }}>
                  <img src={a.dataUrl} alt={a.alt} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </button>
                <input className="input" style={{ fontSize: 12, padding: '4px 6px', marginTop: 6 }} value={a.name} onChange={(e) => patchAsset(a.id, { name: e.target.value })} aria-label="Asset name" />
                <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>{a.width}×{a.height} · {kb(a.size)}</div>
                <button className="btn btn-sm btn-ghost btn-danger" style={{ width: '100%', marginTop: 4 }} onClick={() => setConfirmDel(a.id)}><Icon name="trash" size={13} /> Delete</button>
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="card" style={{ padding: 14, position: 'sticky', top: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Editor</div>
            {!selected ? <p className="faint" style={{ fontSize: 13 }}>Select an image to edit.</p> : (
              <>
                {cropMode ? (
                  <div ref={cropBox} onPointerDown={startCrop} style={{ position: 'relative', cursor: 'crosshair', userSelect: 'none', touchAction: 'none' }}>
                    <img src={selected.dataUrl} alt="" style={{ width: '100%', display: 'block', borderRadius: 4 }} draggable={false} />
                    {edits.crop && <div style={{ position: 'absolute', left: `${edits.crop.x * 100}%`, top: `${edits.crop.y * 100}%`, width: `${edits.crop.w * 100}%`, height: `${edits.crop.h * 100}%`, border: '2px solid var(--accent)', background: 'rgba(37,99,235,0.15)' }} />}
                    <div className="no-print" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'end center', pointerEvents: 'none' }}><span className="badge badge-coming-soon" style={{ marginBottom: 8 }}>Drag to select crop</span></div>
                  </div>
                ) : (
                  <img src={previewUrl ?? selected.dataUrl} alt={selected.alt} style={{ width: '100%', borderRadius: 4, boxShadow: 'var(--shadow)', background: 'repeating-conic-gradient(#e5e7eb 0 25%, #fff 0 50%) 50%/16px 16px' }} />
                )}

                <div className="row-wrap" style={{ gap: 6, marginTop: 10 }}>
                  <button className="btn btn-sm" onClick={() => rot(-1)} title="Rotate left"><Icon name="chevron-up" size={13} style={{ transform: 'rotate(-90deg)' }} /></button>
                  <button className="btn btn-sm" onClick={() => rot(1)} title="Rotate right"><Icon name="chevron-up" size={13} style={{ transform: 'rotate(90deg)' }} /></button>
                  <button className={`btn btn-sm ${edits.flipH ? 'btn-primary' : ''}`} onClick={() => setEdits((e) => ({ ...e, flipH: !e.flipH }))}>Flip H</button>
                  <button className={`btn btn-sm ${edits.flipV ? 'btn-primary' : ''}`} onClick={() => setEdits((e) => ({ ...e, flipV: !e.flipV }))}>Flip V</button>
                  <button className={`btn btn-sm ${cropMode ? 'btn-primary' : ''}`} onClick={() => setCropMode((v) => !v)}>Crop</button>
                  {edits.crop && <button className="btn btn-sm btn-ghost" onClick={() => setEdits((e) => ({ ...e, crop: undefined }))}>Reset crop</button>}
                </div>

                <div className="field" style={{ marginTop: 10 }}>
                  <div className="range-label"><span>Max width</span><span>{edits.maxWidth}px</span></div>
                  <input className="range" type="range" min={200} max={2400} step={20} value={edits.maxWidth} onChange={(e) => setEdits((p) => ({ ...p, maxWidth: Number(e.target.value) }))} />
                </div>
                <div className="field">
                  <div className="range-label"><span>Quality</span><span>{Math.round(edits.quality * 100)}%</span></div>
                  <input className="range" type="range" min={0.3} max={1} step={0.01} value={edits.quality} onChange={(e) => setEdits((p) => ({ ...p, quality: Number(e.target.value) }))} />
                </div>
                <div className="field">
                  <div className="range-label"><span>Corner radius</span><span>{Math.round(edits.cornerRadius * 100)}%</span></div>
                  <input className="range" type="range" min={0} max={0.5} step={0.01} value={edits.cornerRadius} onChange={(e) => setEdits((p) => ({ ...p, cornerRadius: Number(e.target.value) }))} />
                </div>
                <div className="field">
                  <label>Alt text (for accessibility & SEO)</label>
                  <input className="input" value={selected.alt} onChange={(e) => patchAsset(selected.id, { alt: e.target.value })} />
                </div>

                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary" onClick={saveVariant}><Icon name="copy" size={15} /> Save as new</button>
                  <button className="btn" onClick={download}><Icon name="download" size={15} /> Download</button>
                </div>
                <p className="faint" style={{ fontSize: 11.5, marginTop: 8 }}>“Save as new” keeps the original and stores the edited copy in your library.</p>
              </>
            )}
          </div>
        </div>
      )}

      <Confirm open={confirmDel !== null} title="Delete this image?" body="It is removed from your local library. Documents that already embedded a copy keep it." confirmLabel="Delete" danger
        onCancel={() => setConfirmDel(null)} onConfirm={() => { if (confirmDel) remove(confirmDel); setConfirmDel(null); }} />
    </div>
  );
}
