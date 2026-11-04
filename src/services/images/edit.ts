// Browser-only, canvas-based image editing. All operations run locally and
// produce a new data URL — the original is never mutated in place.

export interface ImageEdits {
  rotate: number; // 0 | 90 | 180 | 270
  flipH: boolean;
  flipV: boolean;
  maxWidth: number; // output max width in px (resize/compress)
  quality: number; // 0..1 (JPEG quality)
  cornerRadius: number; // 0..0.5 as a fraction of the smaller side
  crop?: { x: number; y: number; w: number; h: number }; // normalised [0,1]
}

export interface EditedImage {
  dataUrl: string;
  width: number;
  height: number;
  size: number;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image.'));
    img.src = src;
  });
}

/** Approximate byte size of a data URL's payload. */
export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
  return Math.round((b64.length * 3) / 4);
}

function roundRectPath(ctx: CanvasRenderingContext2D, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.arcTo(w, 0, w, h, r);
  ctx.arcTo(w, h, 0, h, r);
  ctx.arcTo(0, h, 0, 0, r);
  ctx.arcTo(0, 0, w, 0, r);
  ctx.closePath();
}

export async function applyEdits(src: string, e: ImageEdits, mime = 'image/png'): Promise<EditedImage> {
  const img = await loadImage(src);

  // 1) Crop (+ flip) at natural resolution.
  const cx = Math.round((e.crop?.x ?? 0) * img.width);
  const cy = Math.round((e.crop?.y ?? 0) * img.height);
  const cw = Math.max(1, Math.round((e.crop?.w ?? 1) * img.width));
  const ch = Math.max(1, Math.round((e.crop?.h ?? 1) * img.height));
  const a = document.createElement('canvas');
  a.width = cw; a.height = ch;
  const actx = a.getContext('2d')!;
  actx.save();
  actx.translate(e.flipH ? cw : 0, e.flipV ? ch : 0);
  actx.scale(e.flipH ? -1 : 1, e.flipV ? -1 : 1);
  actx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
  actx.restore();

  // 2) Rotate.
  const rot = (((e.rotate % 360) + 360) % 360);
  const swap = rot === 90 || rot === 270;
  const b = document.createElement('canvas');
  b.width = swap ? ch : cw;
  b.height = swap ? cw : ch;
  const bctx = b.getContext('2d')!;
  bctx.translate(b.width / 2, b.height / 2);
  bctx.rotate((rot * Math.PI) / 180);
  bctx.drawImage(a, -cw / 2, -ch / 2);

  // 3) Resize + optional rounded corners.
  const scale = Math.min(1, e.maxWidth / b.width);
  const ow = Math.max(1, Math.round(b.width * scale));
  const oh = Math.max(1, Math.round(b.height * scale));
  const c = document.createElement('canvas');
  c.width = ow; c.height = oh;
  const cctx = c.getContext('2d')!;
  if (e.cornerRadius > 0) {
    const r = Math.min(ow, oh) * Math.min(0.5, e.cornerRadius);
    roundRectPath(cctx, ow, oh, r);
    cctx.clip();
  }
  cctx.drawImage(b, 0, 0, ow, oh);

  const outMime = e.cornerRadius > 0 ? 'image/png' : mime; // keep transparency for rounded
  const dataUrl = c.toDataURL(outMime, e.quality);
  return { dataUrl, width: ow, height: oh, size: dataUrlBytes(dataUrl) };
}

export function defaultEdits(): ImageEdits {
  return { rotate: 0, flipH: false, flipV: false, maxWidth: 1600, quality: 0.85, cornerRadius: 0 };
}
