// ---------------------------------------------------------------------------
// Central feature registry. The SAME status is displayed everywhere in the UI
// (dashboard cards, menus, tooltips) so the product never claims a capability
// it does not actually have. Honesty is a product requirement, not decoration.
// ---------------------------------------------------------------------------

export type FeatureStatus = 'available' | 'partial' | 'coming-soon' | 'unsupported';

export interface Feature {
  id: string;
  name: string;
  status: FeatureStatus;
  note?: string;
}

export const FEATURES: Feature[] = [
  { id: 'resume-editor', name: 'Resume editor', status: 'available' },
  { id: 'live-preview', name: 'Live resume preview', status: 'available' },
  { id: 'templates', name: 'Resume templates', status: 'available', note: '6 distinct templates; architecture supports more.' },
  { id: 'template-customize', name: 'Template customization', status: 'available', note: 'Fonts, colors, spacing, heading style, section order & visibility.' },
  { id: 'career-profile', name: 'Career Profile', status: 'available', note: 'Reusable master content for all documents.' },
  { id: 'autosave', name: 'Autosave (IndexedDB)', status: 'available' },
  { id: 'pdf-export', name: 'PDF export', status: 'available', note: 'Via the browser print engine (Save as PDF); preview matches output.' },
  { id: 'txt-export', name: 'Plain-text export', status: 'available' },
  { id: 'json-backup', name: 'Project backup & restore (JSON)', status: 'available' },
  { id: 'quality-checks', name: 'Resume quality checks', status: 'available', note: 'Deterministic, rule-based checks.' },
  { id: 'writing-assist', name: 'Writing assistant', status: 'available', note: 'Rule-based suggestions (action verbs, filler, passive, metrics) — local, no AI.' },
  { id: 'resume-versions', name: 'Resume versions & snapshots', status: 'available', note: 'Duplicate for job-specific copies; save/restore named snapshots; compare a snapshot with the current resume.' },
  { id: 'direct-edit', name: 'Direct click-to-edit on preview', status: 'available', note: 'Toggle “Edit on page” and click any field; edits the same data as the panel.' },
  { id: 'docx-export', name: 'DOCX export', status: 'available', note: 'Real .docx, clean single-column (not the template design).' },
  { id: 'docx-import', name: 'DOCX import', status: 'partial', note: 'Local text extraction with a review step; visual formatting is not preserved.' },
  { id: 'pdf-pages', name: 'PDF Studio — page operations', status: 'available', note: 'View, reorder, rotate, delete, duplicate, extract, merge & split pages; export edited PDF.' },
  { id: 'pdf-annotate', name: 'PDF annotations', status: 'available', note: 'Text, highlight & box overlays baked into the exported PDF (overlay, not text removal).' },
  { id: 'pdf-import', name: 'PDF → resume reconstruction', status: 'partial', note: 'Extracts the PDF text layer into an editable resume with a review step; layout not preserved.' },
  { id: 'ocr', name: 'OCR for scanned PDFs', status: 'partial', note: 'Optional, in-browser (tesseract.js); downloads a model on first use and may misread — review required.' },
  { id: 'asset-studio', name: 'Image & asset studio', status: 'available', note: 'Upload, organise & edit images (crop, rotate, flip, resize, round, compress); stored locally.' },
  { id: 'tests', name: 'Automated tests', status: 'available', note: 'Vitest unit suite for the core logic (run: npm test). Playwright e2e planned.' },
  { id: 'localization', name: 'Localization / i18n', status: 'coming-soon' },
  { id: 'portfolio', name: 'Portfolio Studio', status: 'available', note: 'Reusable projects with images; feeds any website you build.' },
  { id: 'website', name: 'Website Studio & ZIP export', status: 'available', note: 'No-code builder; exports a self-contained static site (HTML/CSS/JS, SEO, sitemap) as a ZIP.' },
  { id: 'cover-letter', name: 'Cover letter builder', status: 'available', note: 'Recipient, body paragraphs, design; prefilled from your profile. Export PDF / DOCX / TXT.' },
  { id: 'offline-pwa', name: 'Offline & installable (PWA)', status: 'available', note: 'App shell cached by a service worker; installable. OCR still needs the network for its model.' },
  { id: 'ai-writing', name: 'External AI writing assistance', status: 'coming-soon', note: 'Optional, off by default. Rule-based writing help ships today; an external AI provider is not integrated and would disclose any data sent.' },
  { id: 'cloud-publish', name: 'Automatic cloud publishing', status: 'unsupported', note: 'No backend by design; export and self-host instead.' },
];

const byId = new Map(FEATURES.map((f) => [f.id, f]));

export function getFeature(id: string): Feature | undefined {
  return byId.get(id);
}

export const STATUS_LABEL: Record<FeatureStatus, string> = {
  available: 'Available',
  partial: 'Partial',
  'coming-soon': 'Coming soon',
  unsupported: 'Not supported',
};
