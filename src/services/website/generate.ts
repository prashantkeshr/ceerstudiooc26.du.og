import type { PortfolioProject, ResumeContent, WebsiteData } from '../../core/models/types';
import { FONT_STACK } from '../../features/resume-studio/fonts';

// ---------------------------------------------------------------------------
// Static website generator. Produces real, crawlable, semantic HTML plus a
// stylesheet, a tiny progressive-enhancement script, SEO files and a README.
// The in-app preview renders the SAME markup inline (data-URL images, inlined
// CSS/JS), so what you preview is what you export. Nothing here needs a server.
// ---------------------------------------------------------------------------

export function esc(s: string): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function href(url: string): string {
  const u = url.trim();
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function faviconSvg(ch: string, accent: string): string {
  const c = esc((ch || '•').slice(0, 2));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${esc(accent)}"/><text x="50%" y="52%" dy=".35em" font-family="system-ui,sans-serif" font-size="34" font-weight="700" fill="#fff" text-anchor="middle">${c}</text></svg>`;
}

function dataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// --- CSS ----------------------------------------------------------------
export function buildCss(data: WebsiteData): string {
  const t = data.theme;
  const font = FONT_STACK[t.font];
  const bg = t.dark ? '#0b1120' : '#ffffff';
  const surface = t.dark ? '#131c2e' : '#f8fafc';
  const text = t.dark ? '#e9eef6' : '#1a2230';
  const soft = t.dark ? '#9fb0c7' : '#55617a';
  const border = t.dark ? '#273449' : '#e2e8f0';
  return `:root{--accent:${t.accent};--bg:${bg};--surface:${surface};--text:${text};--soft:${soft};--border:${border}}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:${font};background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--accent)}
img{max-width:100%;display:block}
.wrap{max-width:860px;margin:0 auto;padding:0 20px}
.site-nav{position:sticky;top:0;z-index:10;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
.site-nav .wrap{display:flex;align-items:center;gap:16px;height:58px}
.site-nav strong{font-weight:800}
.site-nav .links{margin-left:auto;display:flex;gap:4px;flex-wrap:wrap}
.site-nav a{color:var(--soft);text-decoration:none;font-weight:600;font-size:14px;padding:6px 10px;border-radius:7px}
.site-nav a:hover{color:var(--text);background:var(--surface)}
.hero{padding:72px 0 40px}
.hero h1{font-size:clamp(28px,5vw,46px);line-height:1.1;letter-spacing:-.02em;margin:0 0 12px}
.hero .tagline{font-size:clamp(16px,2.4vw,20px);color:var(--soft);margin:0 0 18px;max-width:40ch}
.hero .contact{display:flex;flex-wrap:wrap;gap:10px 16px;font-size:14px}
.hero .contact a,.hero .contact span{color:var(--soft);text-decoration:none}
section{padding:36px 0;border-top:1px solid var(--border)}
section h2{font-size:14px;text-transform:uppercase;letter-spacing:.12em;color:var(--accent);margin:0 0 18px}
.item{margin-bottom:20px}
.item h3{margin:0;font-size:17px}
.item .meta{color:var(--soft);font-size:14px;margin:2px 0 6px}
.item ul{margin:6px 0 0;padding-left:20px}
.skills-grid{display:flex;flex-wrap:wrap;gap:8px}
.tag{background:var(--surface);border:1px solid var(--border);border-radius:999px;padding:4px 12px;font-size:13px;font-weight:600}
.skillgroup{margin-bottom:10px}
.skillgroup b{display:block;margin-bottom:5px;font-size:14px}
.projects{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.card img{aspect-ratio:16/9;object-fit:cover;width:100%}
.card .body{padding:14px}
.card h3{margin:0 0 4px;font-size:16px}
.card .summary{color:var(--soft);font-size:14px;margin:0 0 8px}
.card .tags{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.card .links{display:flex;gap:12px;font-size:13px;font-weight:600}
footer{border-top:1px solid var(--border);padding:28px 0;color:var(--soft);font-size:14px}
.site-sidebar .layout{display:grid;grid-template-columns:260px 1fr;gap:0;max-width:1100px;margin:0 auto}
.site-sidebar .side{position:sticky;top:0;align-self:start;height:100dvh;padding:40px 24px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;gap:14px}
.site-sidebar .side h1{font-size:26px;margin:0}
.site-sidebar .side nav{display:flex;flex-direction:column;gap:2px;margin-top:10px}
.site-sidebar .side nav a{color:var(--soft);text-decoration:none;font-weight:600;padding:6px 0}
.site-sidebar .main{padding:0 28px}
.site-sidebar .hero{padding:48px 0 24px}
.site-sidebar .site-nav{display:none}
.site-minimal .hero{padding:96px 0 40px}
.site-minimal section h2{color:var(--soft)}
@media(max-width:720px){.site-sidebar .layout{grid-template-columns:1fr}.site-sidebar .side{position:static;height:auto;border-right:none;border-bottom:1px solid var(--border)}.site-sidebar .site-nav{display:block}}
`;
}

// --- Script (progressive enhancement only) ------------------------------
export function buildScript(): string {
  return `document.querySelectorAll('.site-nav a[href^="#"]').forEach(function(a){a.addEventListener('click',function(e){var el=document.querySelector(a.getAttribute('href'));if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth'});}});});`;
}

// --- Body ---------------------------------------------------------------
function dateSpan(start: string, end: string, current?: boolean): string {
  const e = current ? 'Present' : end;
  return [start, e].filter(Boolean).join(' – ');
}

function sectionHtml(key: string, c: ResumeContent, data: WebsiteData, imgSrc: (p: PortfolioProject) => string): string {
  switch (key) {
    case 'about':
      if (!data.about.trim()) return '';
      return `<section id="about"><div class="wrap"><h2>About</h2><p>${esc(data.about)}</p></div></section>`;
    case 'skills':
      if (!c.skills.length) return '';
      return `<section id="skills"><div class="wrap"><h2>Skills</h2>${c.skills.map((g) => `<div class="skillgroup"><b>${esc(g.name)}</b><div class="skills-grid">${g.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</div></div>`).join('')}</div></section>`;
    case 'experience':
      if (!c.experience.length) return '';
      return `<section id="experience"><div class="wrap"><h2>Experience</h2>${c.experience.map((e) => `<div class="item"><h3>${esc(e.role)}${e.company ? ` · ${esc(e.company)}` : ''}</h3><div class="meta">${esc(dateSpan(e.start, e.end, e.current))}${e.location ? ` · ${esc(e.location)}` : ''}</div>${e.bullets.filter((b) => b.trim()).length ? `<ul>${e.bullets.filter((b) => b.trim()).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div></section>`;
    case 'projects':
      if (!data.projects.length) return '';
      return `<section id="projects"><div class="wrap"><h2>Projects</h2><div class="projects">${data.projects.map((p) => `<article class="card">${p.image ? `<img src="${esc(imgSrc(p))}" alt="${esc(p.title)}">` : ''}<div class="body"><h3>${esc(p.title)}</h3>${p.summary ? `<p class="summary">${esc(p.summary)}</p>` : ''}${p.description ? `<p>${esc(p.description)}</p>` : ''}${p.tech.length ? `<div class="tags">${p.tech.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}<div class="links">${p.link ? `<a href="${esc(href(p.link))}">Link</a>` : ''}${p.repo ? `<a href="${esc(href(p.repo))}">Code</a>` : ''}${p.demo ? `<a href="${esc(href(p.demo))}">Demo</a>` : ''}</div></div></article>`).join('')}</div></div></section>`;
    case 'education':
      if (!c.education.length) return '';
      return `<section id="education"><div class="wrap"><h2>Education</h2>${c.education.map((e) => `<div class="item"><h3>${esc(e.degree)}${e.institution ? ` · ${esc(e.institution)}` : ''}</h3><div class="meta">${esc(dateSpan(e.start, e.end))}</div>${e.details ? `<p>${esc(e.details)}</p>` : ''}</div>`).join('')}</div></section>`;
    case 'contact': {
      const bits = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, c.phone && `<span>${esc(c.phone)}</span>`, c.location && `<span>${esc(c.location)}</span>`].filter(Boolean);
      const links = c.links.filter((l) => l.url).map((l) => `<a href="${esc(href(l.url))}">${esc(l.label || l.url)}</a>`);
      if (!bits.length && !links.length) return '';
      return `<section id="contact"><div class="wrap"><h2>Contact</h2><div class="hero"><div class="contact">${[...bits, ...links].join('')}</div></div></div></section>`;
    }
    default:
      return '';
  }
}

export function buildBody(data: WebsiteData, imgSrc: (p: PortfolioProject) => string): string {
  const c = data.snapshot;
  const visible = data.sections.filter((s) => s.visible);
  const navLinks = visible.map((s) => `<a href="#${s.key}">${s.key[0].toUpperCase() + s.key.slice(1)}</a>`).join('');
  const contactTop = [c.email && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`, ...c.links.filter((l) => l.url).map((l) => `<a href="${esc(href(l.url))}">${esc(l.label || l.url)}</a>`)].filter(Boolean).join('');
  const hero = `<header class="hero"><div class="wrap"><h1>${esc(data.hero.headline)}</h1><p class="tagline">${esc(data.hero.tagline)}</p><div class="contact">${contactTop}</div></div></header>`;
  const sectionsHtml = visible.map((s) => sectionHtml(s.key, c, data, imgSrc)).join('\n');
  const year = new Date().getFullYear();
  const footer = `<footer><div class="wrap">© ${year} ${esc(c.fullName || '')} · Built with Career Studio</div></footer>`;

  if (data.templateId === 'sidebar') {
    return `<div class="layout"><aside class="side"><h1>${esc(c.fullName || 'Your Name')}</h1><p style="color:var(--soft);margin:0">${esc(c.title)}</p><nav>${navLinks}</nav><div class="contact" style="margin-top:auto;font-size:13px">${contactTop}</div></aside><div class="main">${hero}<main>${sectionsHtml}</main>${footer}</div></div>`;
  }
  const nav = `<nav class="site-nav"><div class="wrap"><strong>${esc(c.fullName || 'Portfolio')}</strong><div class="links">${navLinks}</div></div></nav>`;
  return `${nav}${hero}<main>${sectionsHtml}</main>${footer}`;
}

// --- Full documents -----------------------------------------------------
interface DocOptions {
  inlineAssets: boolean; // true: inline CSS/JS + data-URL images (preview); false: linked files (ZIP)
}

function head(data: WebsiteData, opts: DocOptions): string {
  const seo = data.seo;
  const fav = dataUri(faviconSvg(seo.favicon, data.theme.accent));
  const styleTag = opts.inlineAssets ? `<style>${buildCss(data)}</style>` : `<link rel="stylesheet" href="styles.css">`;
  const og = [
    `<meta property="og:title" content="${esc(seo.title)}">`,
    `<meta property="og:description" content="${esc(seo.description)}">`,
    `<meta property="og:type" content="website">`,
    seo.ogImage ? `<meta property="og:image" content="${esc(href(seo.ogImage))}">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
  ].filter(Boolean).join('\n  ');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(seo.title)}</title>
  <meta name="description" content="${esc(seo.description)}">
  <link rel="icon" href="${fav}">
  ${og}
  ${styleTag}
</head>`;
}

/** Self-contained HTML string for the in-app preview (and a valid standalone file). */
export function renderPreviewHtml(data: WebsiteData): string {
  const body = buildBody(data, (p) => p.image); // data URLs inline
  return `${head(data, { inlineAssets: true })}
<body class="site-${data.templateId}">
${body}
<script>${buildScript()}</script>
</body>
</html>`;
}

export interface SiteFile {
  path: string;
  text?: string;
  base64?: string;
}

function imageExt(dataUrl: string): string {
  const m = /^data:image\/([a-z0-9+]+);/i.exec(dataUrl);
  const t = (m?.[1] || 'png').toLowerCase();
  return t === 'jpeg' ? 'jpg' : t === 'svg+xml' ? 'svg' : t;
}

/** The full file set for the downloadable ZIP. */
export function generateSiteFiles(data: WebsiteData, siteName: string): SiteFile[] {
  // Map each portfolio image to an asset file path.
  const assetByProject = new Map<string, string>();
  const assetFiles: SiteFile[] = [];
  for (const p of data.projects) {
    if (p.image && p.image.startsWith('data:')) {
      const path = `assets/project-${p.id}.${imageExt(p.image)}`;
      assetByProject.set(p.id, path);
      const base64 = p.image.split(',')[1] ?? '';
      assetFiles.push({ path, base64 });
    }
  }
  const body = buildBody(data, (p) => assetByProject.get(p.id) ?? p.image);
  const html = `${head(data, { inlineAssets: false })}
<body class="site-${data.templateId}">
${body}
<script src="script.js"></script>
</body>
</html>`;

  const robots = `User-agent: *\nAllow: /\nSitemap: sitemap.xml\n`;
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<!-- Replace https://example.com/ with your real domain -->\n<urlset xmlns="http://www.sitemap.org/schemas/sitemap/0.9">\n  <url><loc>https://example.com/</loc></url>\n</urlset>\n`;
  const readme = `# ${siteName}

A static personal website generated by Career Studio. It has **no backend** and
runs on any static host.

## Files
- \`index.html\` — the page (semantic, crawlable HTML)
- \`styles.css\`, \`script.js\` — styling and a tiny smooth-scroll enhancement
- \`assets/\` — images (if any)
- \`sitemap.xml\`, \`robots.txt\` — SEO (edit the domain in \`sitemap.xml\`)

## Deploy
**GitHub Pages:** push these files to a repo, then enable Pages (Settings →
Pages → deploy from branch, root). For a project page the site serves from
\`/<repo>/\` — all links here are relative, so that works unchanged.

**Any static host (Netlify, Cloudflare Pages, S3, …):** upload this folder.

Open \`index.html\` directly in a browser to preview offline.
`;

  return [
    { path: 'index.html', text: html },
    { path: 'styles.css', text: buildCss(data) },
    { path: 'script.js', text: buildScript() },
    { path: 'robots.txt', text: robots },
    { path: 'sitemap.xml', text: sitemap },
    { path: 'README.md', text: readme },
    ...assetFiles,
  ];
}

/** Zip the site (JSZip loaded on demand). */
export async function zipSite(data: WebsiteData, siteName: string): Promise<Blob> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const f of generateSiteFiles(data, siteName)) {
    if (f.base64 !== undefined) zip.file(f.path, f.base64, { base64: true });
    else zip.file(f.path, f.text ?? '');
  }
  return zip.generateAsync({ type: 'blob' });
}
