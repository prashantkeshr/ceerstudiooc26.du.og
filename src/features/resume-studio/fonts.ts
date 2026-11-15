import type { FontKey } from '../../core/models/types';

// Curated font library. System-safe fonts work offline; the rest are loaded
// from Google Fonts on demand (needs network) and fall back gracefully.
export interface FontDef {
  key: FontKey;
  label: string;
  stack: string;
  cat: 'Sans-serif' | 'Serif' | 'Display' | 'Mono';
  google?: string; // family+weights query for fonts.googleapis.com css2
}

export const FONTS: FontDef[] = [
  { key: 'inter', label: 'Inter', cat: 'Sans-serif', stack: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  { key: 'arial', label: 'Arial', cat: 'Sans-serif', stack: 'Arial, Helvetica, sans-serif' },
  { key: 'verdana', label: 'Verdana', cat: 'Sans-serif', stack: 'Verdana, Geneva, sans-serif' },
  { key: 'poppins', label: 'Poppins', cat: 'Sans-serif', stack: "'Poppins', system-ui, sans-serif", google: 'Poppins:wght@400;500;600;700' },
  { key: 'montserrat', label: 'Montserrat', cat: 'Sans-serif', stack: "'Montserrat', system-ui, sans-serif", google: 'Montserrat:wght@400;500;600;700' },
  { key: 'sourceSans', label: 'Source Sans 3', cat: 'Sans-serif', stack: "'Source Sans 3', system-ui, sans-serif", google: 'Source+Sans+3:wght@400;600;700' },
  { key: 'georgia', label: 'Georgia', cat: 'Serif', stack: "Georgia, 'Times New Roman', serif" },
  { key: 'times', label: 'Times New Roman', cat: 'Serif', stack: "'Times New Roman', Times, serif" },
  { key: 'garamond', label: 'EB Garamond', cat: 'Serif', stack: "'EB Garamond', Garamond, Georgia, serif", google: 'EB+Garamond:wght@400;500;600;700' },
  { key: 'lora', label: 'Lora', cat: 'Serif', stack: "'Lora', Georgia, serif", google: 'Lora:wght@400;500;600;700' },
  { key: 'merriweather', label: 'Merriweather', cat: 'Serif', stack: "'Merriweather', Georgia, serif", google: 'Merriweather:wght@400;700' },
  { key: 'robotoSlab', label: 'Roboto Slab', cat: 'Serif', stack: "'Roboto Slab', Georgia, serif", google: 'Roboto+Slab:wght@400;500;700' },
  { key: 'playfair', label: 'Playfair Display', cat: 'Display', stack: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@400;600;700' },
  { key: 'jetbrains', label: 'JetBrains Mono', cat: 'Mono', stack: "'JetBrains Mono', ui-monospace, 'Courier New', monospace" },
];

const byKey = new Map(FONTS.map((f) => [f.key, f]));

export const FONT_STACK = Object.fromEntries(FONTS.map((f) => [f.key, f.stack])) as Record<FontKey, string>;

const loaded = new Set<string>();

/** Inject the Google Fonts stylesheet for a font the first time it is used. */
export function ensureFont(key: FontKey | undefined): void {
  if (!key || typeof document === 'undefined') return;
  const f = byKey.get(key);
  if (!f?.google || loaded.has(f.google)) return;
  loaded.add(f.google);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${f.google}&display=swap`;
  document.head.appendChild(link);
}

/** Fonts grouped by category, for a <select> with <optgroup>s. */
export function fontsByCategory(): [FontDef['cat'], FontDef[]][] {
  const cats: FontDef['cat'][] = ['Sans-serif', 'Serif', 'Display', 'Mono'];
  return cats.map((cat) => [cat, FONTS.filter((f) => f.cat === cat)]);
}
