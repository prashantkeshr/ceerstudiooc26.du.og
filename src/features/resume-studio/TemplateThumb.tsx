import { memo } from 'react';
import type { ResumeContent, ResumeData } from '../../core/models/types';
import { defaultDesign, DEFAULT_SECTION_ORDER } from '../../core/models/factory';
import { getTemplate } from './templates/registry';
import { ResumePreview } from './ResumePreview';

/** Trim content so each thumbnail renders cheaply but still looks real. */
export function thumbContent(c: ResumeContent): ResumeContent {
  return {
    ...c,
    photo: c.photo,
    summary: (c.summary || '').slice(0, 170),
    links: c.links.slice(0, 2),
    experience: c.experience.slice(0, 2).map((e) => ({ ...e, bullets: e.bullets.slice(0, 2) })),
    education: c.education.slice(0, 1),
    projects: c.projects.slice(0, 1),
    skills: c.skills.slice(0, 3),
    certifications: c.certifications.slice(0, 1),
    customSections: [],
  };
}

/** A scaled, non-interactive live preview of a template, for the picker. */
export const TemplateThumb = memo(function TemplateThumb({ templateId, content, pageSize }: {
  templateId: string;
  content: ResumeContent;
  pageSize: 'a4' | 'letter';
}) {
  const t = getTemplate(templateId);
  const isTwo = t.layout === 'sidebar';
  const data: ResumeData = {
    content,
    templateId,
    design: {
      ...defaultDesign(),
      accent: t.defaults.accent,
      fontFamily: t.defaults.font,
      headingFont: t.defaults.headingFont ?? t.defaults.font,
      headingStyle: t.defaults.heading,
      pageSize,
      columns: isTwo ? 'two' : 'single',
      sidebarSections: isTwo ? ['skills'] : [],
      sidebarSide: templateId === 'corporate' ? 'right' : 'left',
    },
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    snapshots: [],
  };
  return (
    <div className="tpl-live" aria-hidden>
      <div className="tpl-live-scale">
        <ResumePreview data={data} />
      </div>
    </div>
  );
});
