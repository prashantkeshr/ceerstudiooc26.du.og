import type { CoverLetterData } from '../../core/models/types';
import type { Finding } from './checks';

// Deterministic, rule-based cover-letter checks. No AI, nothing sent anywhere.
// Guidance only — never a guarantee of any outcome.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Common leftover placeholders people forget to replace.
const PLACEHOLDER_RE = /\[[^\]]+\]|\bXYZ\b|\bcompany name\b|\byour company\b|\bposition title\b|\bjob title\b|lorem ipsum/i;
const GENERIC_SALUTATION_RE = /to whom it may concern|dear sir or madam|dear sir\/madam|dear hiring manager/i;

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function runCoverLetterChecks(d: CoverLetterData): Finding[] {
  const out: Finding[] = [];
  const bodyText = d.body.join('\n').trim();
  const words = wordCount(bodyText);

  // --- Sender identity ---
  if (!d.sender.name.trim()) {
    out.push({ id: 'sender-name', severity: 'error', message: 'Your name is missing.', hint: 'Add it under Content, or use “Sync sender” to pull it from your profile.' });
  }
  if (!d.sender.email.trim() && !d.sender.phone.trim()) {
    out.push({ id: 'sender-contact', severity: 'warning', message: 'No sender email or phone.', hint: 'Give the reader at least one way to reach you.' });
  } else if (d.sender.email.trim() && !EMAIL_RE.test(d.sender.email.trim())) {
    out.push({ id: 'sender-email', severity: 'warning', message: 'Sender email looks malformed.', hint: `“${d.sender.email}” is not a standard email address.` });
  }

  // --- Addressing ---
  if (!d.recipient.name.trim() && !d.recipient.company.trim()) {
    out.push({ id: 'recipient', severity: 'info', message: 'No recipient name or company.', hint: 'A letter addressed to a named person or company reads as more tailored.' });
  }
  if (d.salutation.trim() && GENERIC_SALUTATION_RE.test(d.salutation)) {
    out.push({ id: 'salutation-generic', severity: 'info', message: 'Salutation is generic.', hint: 'Where you can, address a specific person (e.g. “Dear Ms. Rao,”).' });
  }
  if (!d.salutation.trim()) {
    out.push({ id: 'salutation-missing', severity: 'info', message: 'No salutation.', hint: 'Open with a greeting such as “Dear Hiring Team,”.' });
  }

  // --- Body substance ---
  const emptyParas = d.body.filter((p) => !p.trim()).length;
  if (words === 0) {
    out.push({ id: 'body-empty', severity: 'warning', message: 'The letter has no body text.', hint: 'Add a few paragraphs about why you fit the role.' });
  } else {
    if (emptyParas > 0) {
      out.push({ id: 'body-empty-paras', severity: 'info', message: `${emptyParas} empty paragraph(s).`, hint: 'Remove blank paragraphs or fill them in.' });
    }
    if (words < 120) {
      out.push({ id: 'body-short', severity: 'info', message: `Body is short (${words} words).`, hint: 'Most cover letters run ~150–350 words across 3–4 paragraphs.' });
    } else if (words > 400) {
      out.push({ id: 'body-long', severity: 'info', message: `Body is long (${words} words).`, hint: 'Aim to stay on one page — trim toward ~350 words.' });
    }
  }

  // --- Tailoring cue: is the company named in the body? ---
  const company = d.recipient.company.trim();
  if (company && words > 0 && !bodyText.toLowerCase().includes(company.toLowerCase())) {
    out.push({ id: 'body-company', severity: 'info', message: `“${company}” isn’t mentioned in the body.`, hint: 'Naming the company signals a tailored, non-generic letter.' });
  }

  // --- Leftover placeholders ---
  const placeholderHit = PLACEHOLDER_RE.exec(bodyText) || PLACEHOLDER_RE.exec(d.subject) || PLACEHOLDER_RE.exec(d.salutation);
  if (placeholderHit) {
    out.push({ id: 'placeholder', severity: 'warning', message: `Possible leftover placeholder: “${placeholderHit[0]}”.`, hint: 'Replace template placeholders before sending.' });
  }

  // --- Sign-off ---
  if (!d.closing.trim()) {
    out.push({ id: 'closing', severity: 'info', message: 'No closing line.', hint: 'Add a sign-off such as “Sincerely,”.' });
  }
  if (!d.signature.trim()) {
    out.push({ id: 'signature', severity: 'info', message: 'No signature name.', hint: 'End with your name under the closing.' });
  }

  if (out.length === 0) {
    out.push({ id: 'ok', severity: 'info', message: 'No issues found by the basic checks.', hint: 'These checks are a guide, not a guarantee of any outcome.' });
  }
  return out;
}
