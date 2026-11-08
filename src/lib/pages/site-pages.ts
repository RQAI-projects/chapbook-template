// The site's block pages (src/data/pages/<slug>.json), checked once for the whole build.
import { normalisePage, SPECIAL_SLUGS } from './render.mjs';
import { effectiveColours } from '../business/render.mjs';
import themesRegistry from '../../data/themes.json';
import { site } from '../site';

// Read as text so one damaged file (a hand edit, a merge conflict) skips that page instead of
// failing the whole website build.
const files = import.meta.glob('../../data/pages/*.json', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
export const blockPages = Object.entries(files).map(([path, text]) => {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { console.warn(`[pages] ${path} is not valid JSON, so that page was skipped.`); return null; }
  const page = normalisePage(raw);
  // The file name is the page's address; a page that says otherwise is ignored.
  const name = path.split('/').pop()!.replace(/\.json$/, '');
  return page.slug === name && page.blocks.length ? page : null;
}).filter(Boolean) as any[];
export const blockPage = (slug: string) => blockPages.find((p) => p.slug === slug) || null;
export const customPages = blockPages.filter((p) => !SPECIAL_SLUGS.includes(p.slug));
// The colours the site already uses, so block backgrounds and buttons stay readable.
export function baseColours() {
  const theme = (themesRegistry.themes as any[]).find((t) => t.id === site.defaultTheme)?.preview || {};
  const c = effectiveColours((site as any).design, theme);
  return { bg: c.background, ink: c.ink, accent: c.accent };
}
