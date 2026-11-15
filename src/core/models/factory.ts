import type {
  CareerProfile,
  CoverLetterData,
  CoverLetterProject,
  PortfolioProject,
  ResumeContent,
  ResumeData,
  ResumeDesign,
  ResumeProject,
  WebsiteData,
  WebsiteProject,
  WebsiteSectionCfg,
} from './types';
import { SCHEMA_VERSION } from './types';

/** Stable, collision-resistant id. Uses crypto.randomUUID when available. */
export function uid(prefix = 'id'): string {
  const g = globalThis.crypto;
  if (g && typeof g.randomUUID === 'function') return `${prefix}_${g.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyContent(): ResumeContent {
  return {
    fullName: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    website: '',
    links: [],
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    certifications: [],
    customSections: [],
  };
}

export function emptyProfile(): CareerProfile {
  return {
    ...emptyContent(),
    id: 'primary',
    objective: '',
    portfolioProjects: [],
    updatedAt: Date.now(),
  };
}

export function emptyPortfolioProject(): PortfolioProject {
  return { id: uid('pf'), title: '', summary: '', description: '', role: '', tech: [], link: '', repo: '', demo: '', date: '', image: '' };
}

export function defaultDesign(): ResumeDesign {
  return {
    accent: '#2563eb',
    fontFamily: 'inter',
    headingFont: 'inter',
    fontScale: 1,
    lineHeight: 1.45,
    sectionSpacing: 20,
    headingStyle: 'bar',
    pageSize: 'a4',
    columns: 'single',
    sidebarSections: ['skills'],
    sidebarSide: 'left',
    showPhoto: false,
    photoShape: 'circle',
    divider: 'none',
  };
}

export const DEFAULT_SECTION_ORDER: string[] = [
  'summary',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
];

/** Build resume content from a profile (a snapshot the resume then owns). */
export function contentFromProfile(profile: CareerProfile): ResumeContent {
  const {
    fullName, title, photo, email, phone, location, website, links, summary,
    experience, education, skills, projects, certifications, customSections,
  } = profile;
  // Deep clone so the resume cannot mutate the profile (or vice versa).
  return structuredClone({
    fullName, title, photo, email, phone, location, website, links, summary,
    experience, education, skills, projects, certifications, customSections,
  });
}

export const DEFAULT_WEBSITE_SECTIONS: WebsiteSectionCfg[] = [
  { key: 'about', visible: true },
  { key: 'skills', visible: true },
  { key: 'experience', visible: true },
  { key: 'projects', visible: true },
  { key: 'education', visible: true },
  { key: 'contact', visible: true },
];

export function newWebsiteProject(opts: {
  title: string;
  templateId: string;
  profile: CareerProfile;
}): WebsiteProject {
  const now = Date.now();
  const content = contentFromProfile(opts.profile);
  const data: WebsiteData = {
    templateId: opts.templateId,
    theme: { accent: '#2563eb', font: 'inter', dark: false },
    hero: {
      headline: opts.profile.fullName ? `Hi, I’m ${opts.profile.fullName.split(' ')[0]}.` : 'Hi, I’m …',
      tagline: opts.profile.title || 'Your professional tagline',
    },
    about: opts.profile.summary || '',
    sections: structuredClone(DEFAULT_WEBSITE_SECTIONS),
    snapshot: content,
    projects: structuredClone(opts.profile.portfolioProjects ?? []),
    seo: {
      title: [opts.profile.fullName, opts.profile.title].filter(Boolean).join(' — ') || 'My personal website',
      description: (opts.profile.summary || '').slice(0, 155),
      ogImage: '',
      favicon: (opts.profile.fullName || '•').trim().charAt(0).toUpperCase() || '•',
    },
  };
  return {
    id: uid('web'),
    type: 'website',
    schemaVersion: SCHEMA_VERSION,
    title: opts.title || 'Untitled website',
    createdAt: now,
    updatedAt: now,
    archived: false,
    data,
  };
}

export function newCoverLetterProject(opts: { title: string; profile: CareerProfile }): CoverLetterProject {
  const now = Date.now();
  const p = opts.profile;
  const data: CoverLetterData = {
    design: { accent: '#2563eb', fontFamily: 'georgia', fontScale: 1, lineHeight: 1.5, pageSize: 'a4' },
    sender: { name: p.fullName, title: p.title, email: p.email, phone: p.phone, location: p.location, website: p.website },
    recipient: { name: '', title: 'Hiring Manager', company: '', address: '' },
    date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    subject: '',
    salutation: 'Dear Hiring Manager,',
    body: [
      'I am writing to express my interest in the [role] position at [company].',
      '',
      '',
    ],
    closing: 'Sincerely,',
    signature: p.fullName,
  };
  return {
    id: uid('cl'),
    type: 'cover-letter',
    schemaVersion: SCHEMA_VERSION,
    title: opts.title || 'Untitled cover letter',
    createdAt: now,
    updatedAt: now,
    archived: false,
    data,
  };
}

export function newResumeProject(opts: {
  title: string;
  templateId: string;
  content?: ResumeContent;
}): ResumeProject {
  const now = Date.now();
  const data: ResumeData = {
    content: opts.content ?? emptyContent(),
    templateId: opts.templateId,
    design: defaultDesign(),
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    snapshots: [],
  };
  return {
    id: uid('prj'),
    type: 'resume',
    schemaVersion: SCHEMA_VERSION,
    title: opts.title || 'Untitled resume',
    createdAt: now,
    updatedAt: now,
    archived: false,
    data,
  };
}
