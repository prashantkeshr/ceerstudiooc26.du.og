import type { ResumeContent } from '../../core/models/types';

// Deterministic, local job-description keyword match. No AI, nothing leaves the
// browser. It extracts the most salient terms from a pasted job description and
// reports which already appear in the resume and which are missing, with a
// coverage score. It is a guide for tailoring — never a guarantee of any outcome.

export interface MatchTerm {
  term: string;
  count: number; // frequency in the job description
  matched: boolean; // present in the resume text
}

export interface JobMatchResult {
  score: number; // 0–100 coverage of the ranked key terms
  total: number; // number of ranked key terms considered
  matchedCount: number;
  terms: MatchTerm[]; // ranked; matched + missing together
}

// Common English + boilerplate words to ignore when ranking job terms.
const STOP = new Set([
  'the', 'and', 'for', 'with', 'you', 'your', 'our', 'are', 'will', 'have', 'has', 'had', 'that', 'this',
  'these', 'those', 'from', 'was', 'were', 'they', 'their', 'them', 'who', 'what', 'which', 'when', 'where',
  'how', 'all', 'any', 'can', 'may', 'must', 'should', 'would', 'could', 'about', 'into', 'than', 'then',
  'but', 'not', 'out', 'off', 'per', 'via', 'etc', 'such', 'also', 'more', 'most', 'some', 'each', 'other',
  'within', 'across', 'while', 'being', 'been', 'both', 'able', 'over', 'under', 'upon', 'role', 'job',
  'work', 'working', 'team', 'teams', 'company', 'companies', 'candidate', 'candidates', 'applicant',
  'position', 'opportunity', 'responsibilities', 'requirements', 'qualifications', 'preferred', 'required',
  'experience', 'experienced', 'years', 'year', 'plus', 'strong', 'excellent', 'good', 'great', 'ability',
  'skills', 'skill', 'knowledge', 'understanding', 'including', 'include', 'includes', 'well', 'etc.',
  'new', 'using', 'use', 'used', 'help', 'helping', 'join', 'looking', 'seeking', 'ideal', 'plus.', 'day',
  'business', 'high', 'quality', 'best', 'ensure', 'ensuring', 'provide', 'providing', 'support', 'related',
  'environment', 'part', 'full', 'time', 'based', 'across', 'within', 'make', 'makes', 'making', 'get',
]);

function tokenize(text: string): string[] {
  // Keep tech tokens like c++, c#, node.js, .net intact; drop punctuation otherwise.
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9+#.]*[a-z0-9+#]|[a-z0-9]/g) || [])
    .map((t) => t.replace(/\.+$/, ''))
    .filter(Boolean);
}

function isTermToken(t: string): boolean {
  if (STOP.has(t)) return false;
  if (/^\d+$/.test(t)) return false; // pure numbers
  return t.length >= 3 || /[+#.]/.test(t); // allow c++, c#, .net
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function inResume(term: string, resume: string): boolean {
  return new RegExp(`(^|[^a-z0-9#+.])${escapeRe(term)}([^a-z0-9#+]|$)`, 'i').test(resume);
}

/** Flatten a resume's content into one lowercase searchable string. */
export function resumeSearchText(c: ResumeContent): string {
  const parts: string[] = [c.fullName, c.title, c.summary, c.website];
  for (const l of c.links) parts.push(l.label);
  for (const e of c.experience) parts.push(e.role, e.company, ...e.bullets);
  for (const ed of c.education) parts.push(ed.degree, ed.institution, ed.details);
  for (const s of c.skills) parts.push(s.name, ...s.skills);
  for (const p of c.projects) parts.push(p.name, p.description, ...p.tech);
  for (const cert of c.certifications) parts.push(cert.name, cert.issuer);
  for (const cs of c.customSections) {
    parts.push(cs.title);
    for (const it of cs.items) parts.push(it.heading, it.subheading, ...it.bullets);
  }
  return parts.filter(Boolean).join(' \n ').toLowerCase();
}

/**
 * Extract and rank the most salient terms from a job description and check them
 * against the resume text. `resumeText` may be raw; it is lowercased internally.
 */
export function analyzeJobMatch(resumeText: string, jobText: string, limit = 30): JobMatchResult {
  const job = (jobText || '').trim();
  if (!job) return { score: 0, total: 0, matchedCount: 0, terms: [] };
  const resume = (resumeText || '').toLowerCase();

  const tokens = tokenize(job);
  const freq = new Map<string, number>();

  // Unigrams.
  for (const t of tokens) {
    if (isTermToken(t)) freq.set(t, (freq.get(t) || 0) + 1);
  }
  // Bigrams (both tokens meaningful) — weighted higher as specific phrases.
  const bigrams = new Map<string, number>();
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i], b = tokens[i + 1];
    if (isTermToken(a) && isTermToken(b)) {
      const key = `${a} ${b}`;
      bigrams.set(key, (bigrams.get(key) || 0) + 1);
    }
  }

  type Cand = { term: string; count: number; rank: number; bi: boolean };
  const cands: Cand[] = [];
  for (const [term, count] of freq) cands.push({ term, count, rank: count, bi: false });
  for (const [term, count] of bigrams) {
    if (count >= 2) cands.push({ term, count, rank: count * 2.3, bi: true });
  }

  cands.sort((a, b) => b.rank - a.rank || b.term.length - a.term.length || a.term.localeCompare(b.term));

  // Drop unigrams that are already covered by a higher-ranked selected bigram.
  const selected: Cand[] = [];
  const biWords = new Set<string>();
  for (const c of cands) {
    if (selected.length >= limit) break;
    if (!c.bi && biWords.has(c.term)) continue;
    selected.push(c);
    if (c.bi) c.term.split(' ').forEach((w) => biWords.add(w));
  }

  const terms: MatchTerm[] = selected
    .map((c) => ({ term: c.term, count: c.count, matched: inResume(c.term, resume) }))
    .sort((a, b) => Number(a.matched) - Number(b.matched) || b.count - a.count); // missing first

  const matchedCount = terms.filter((t) => t.matched).length;
  const score = terms.length ? Math.round((matchedCount / terms.length) * 100) : 0;
  return { score, total: terms.length, matchedCount, terms };
}
