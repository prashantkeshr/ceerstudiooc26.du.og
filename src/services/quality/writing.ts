import type { ResumeData } from '../../core/models/types';

// Deterministic, rule-based writing assistant. No AI, nothing leaves the
// browser. It flags common resume-writing issues and suggests concrete fixes.
// It never rewrites your words automatically or invents facts.

export interface WritingFinding {
  id: string;
  where: string;
  severity: 'info' | 'warning';
  message: string;
  hint?: string;
}

const STRONG_VERBS = new Set([
  'led', 'built', 'designed', 'launched', 'improved', 'increased', 'reduced', 'created', 'delivered',
  'implemented', 'drove', 'managed', 'owned', 'shipped', 'optimized', 'optimised', 'automated', 'architected',
  'mentored', 'scaled', 'developed', 'engineered', 'streamlined', 'spearheaded', 'established', 'launched',
  'negotiated', 'analyzed', 'analysed', 'cut', 'grew', 'migrated', 'refactored', 'resolved', 'coordinated',
  'founded', 'directed', 'authored', 'accelerated', 'secured', 'generated', 'boosted', 'simplified',
]);

const WEAK_OPENERS = /^(responsible for|helped|worked on|assisted|involved in|participated|duties included|tasked with|was |were )/i;
const FILLER = /\b(various|several things|a lot of|lots of|stuff|etc\.?|things|basically|really|very|in order to|utilize|utilise)\b/gi;
const FIRST_PERSON = /\b(I|me|my|mine)\b/;
const HAS_NUMBER = /\d/;

function analyseBullet(text: string, where: string, idx: number): WritingFinding[] {
  const t = text.trim();
  if (!t) return [];
  const out: WritingFinding[] = [];
  const first = t.replace(/^[•\-*\s]+/, '').split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '') ?? '';

  if (WEAK_OPENERS.test(t)) {
    out.push({ id: `${where}-weak-${idx}`, where, severity: 'warning', message: `Weak opener: “${t.slice(0, 40)}…”`, hint: 'Start with a strong action verb (Led, Built, Reduced…).' });
  } else if (first && !STRONG_VERBS.has(first) && !/ed$|^re/.test(first)) {
    out.push({ id: `${where}-verb-${idx}`, where, severity: 'info', message: `Consider a stronger action verb to open: “${t.slice(0, 40)}…”`, hint: 'e.g. Delivered, Improved, Owned.' });
  }
  if (FIRST_PERSON.test(t)) {
    out.push({ id: `${where}-fp-${idx}`, where, severity: 'info', message: 'Avoid first-person pronouns (I / my) in bullets.', hint: 'Resume bullets are conventionally written without “I”.' });
  }
  const fillers = [...t.matchAll(FILLER)].map((m) => m[0]);
  if (fillers.length) {
    out.push({ id: `${where}-fill-${idx}`, where, severity: 'info', message: `Filler/vague words: ${[...new Set(fillers)].join(', ')}.`, hint: 'Replace with specific, concrete wording.' });
  }
  if (!HAS_NUMBER.test(t)) {
    out.push({ id: `${where}-num-${idx}`, where, severity: 'info', message: 'No measurable result in this bullet.', hint: 'Where true, quantify impact (%, $, time, scale). Never invent numbers.' });
  }
  if (t.split(/\s+/).length > 30) {
    out.push({ id: `${where}-long-${idx}`, where, severity: 'info', message: 'Long bullet (30+ words).', hint: 'Tighten to one clear achievement per line.' });
  }
  return out;
}

export function runWritingChecks(data: ResumeData): WritingFinding[] {
  const c = data.content;
  const out: WritingFinding[] = [];

  if (c.summary.trim()) {
    const words = c.summary.trim().split(/\s+/).length;
    if (words > 90) out.push({ id: 'sum-long', where: 'Summary', severity: 'info', message: 'Summary is long (90+ words).', hint: 'Aim for 2–4 tight sentences.' });
    if (FIRST_PERSON.test(c.summary)) out.push({ id: 'sum-fp', where: 'Summary', severity: 'info', message: 'Summary uses first-person pronouns.', hint: 'Many resumes drop “I” even in the summary — optional but common.' });
    const f = [...c.summary.matchAll(FILLER)].map((m) => m[0]);
    if (f.length) out.push({ id: 'sum-fill', where: 'Summary', severity: 'info', message: `Summary has filler words: ${[...new Set(f)].join(', ')}.` });
  }

  for (const e of c.experience) {
    const label = [e.role, e.company].filter(Boolean).join(' · ') || 'Experience';
    e.bullets.forEach((b, i) => out.push(...analyseBullet(b, label, i)));
    // Repeated openers within one role.
    const openers = e.bullets.map((b) => b.trim().split(/\s+/)[0]?.toLowerCase()).filter(Boolean);
    const dupes = openers.filter((w, i) => w && openers.indexOf(w) !== i);
    if (new Set(dupes).size) out.push({ id: `${label}-rep`, where: label, severity: 'info', message: `Repeated bullet opener(s): ${[...new Set(dupes)].join(', ')}.`, hint: 'Vary the opening verbs for stronger rhythm.' });
  }

  for (const p of c.projects) {
    if (p.description.trim()) analyseBullet(p.description, p.name || 'Project', 0).filter((x) => x.severity === 'warning').forEach((x) => out.push(x));
  }

  if (out.length === 0) out.push({ id: 'ok', where: '', severity: 'info', message: 'No writing issues found by the basic checks.', hint: 'These are guidelines, not rules — your judgement wins.' });
  return out;
}
