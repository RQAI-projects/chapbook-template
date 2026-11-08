import siteData from '../data/site.json';

export interface SiteConfig {
  name: string;
  masthead: string;
  tagline: string;
  description: string;
  url: string;
  /** Site-wide blog theme id — one of the entries in src/data/themes.json, applied as
   *  data-blog-theme on <html>. Unknown/absent falls back to the base 'observatory' look. */
  defaultTheme:
    | 'observatory' | 'ledger' | 'air' | 'blueprint-workshop'
    | 'broadsheet' | 'journal' | 'kiosk' | 'desert-archive'
    | 'neon' | 'zine' | 'scrapbook' | 'woodland-chronicle'
    | 'doodle' | 'rocket' | 'pixel' | 'comic'
    | 'field-atlas' | 'darkroom' | 'contact-sheet' | 'polaroid'
    | (string & {});
  socials: { linkedin?: string; instagram?: string; github?: string };
  newsletter: { endpoint: string };
  contact: { endpoint: string };
  professional?: { eyebrow?: string; heading?: string; intro?: string; location?: string; hours?: string; email?: string; phone?: string; bookingUrl?: string; bookingLabel?: string; services?: Array<{name:string;description?:string;price?:string;duration?:string;bookingUrl?:string}>; credentials?: string[] };
  /** Header/footer nav. Optional: when absent, Base.astro falls back to its built-in nav.
   *  `primary` items show in the mobile quick-access row; `themeLabel` items are renamed
   *  from the active full-theme vocabulary. */
  /** Colours, heading font, corners and home page sections, set in Chapbook. */
  design?: Record<string, unknown>;
  nav?: Array<{ href: string; label: string; primary?: boolean; themeLabel?: boolean }>;
  /** Logo set in Chapbook (Site settings → Logo). Pictures live in /site-images/. */
  logo?: { src: string; showName: boolean; favicon: string } | null;
  /** Badge beside a post title when the writer hasn't picked one: a flat modern icon,
   *  the spinning 3D glyph, or nothing. Absent = '3d' so older sites look as they did. */
  postBadges: 'icon' | '3d' | 'none';
}

// site.json can be edited by hand, so wrong shapes are repaired here rather than breaking the build.
const raw = (siteData && typeof siteData === 'object' ? siteData : {}) as any;
const textOf = (v: unknown, fallback = '') => (typeof v === 'string' ? v : v == null ? fallback : String(v));
const objectOf = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, any>) : {});
// Only the site's own pictures: a root-relative path under /site-images/ with an image type.
export function safeSiteImage(v: unknown): string {
  const src = textOf(v).trim();
  return /^\/site-images\/[\w./-]+\.(svg|png|jpe?g|webp)$/i.test(src) && !src.includes('..') ? src : '';
}
function logoOf(v: unknown) {
  const o = objectOf(v), src = safeSiteImage(o.src);
  return src ? { src, showName: o.showName !== false, favicon: safeSiteImage(o.favicon) } : null;
}
export const site = {
  ...raw,
  name: textOf(raw.name),
  masthead: textOf(raw.masthead, textOf(raw.name)),
  tagline: textOf(raw.tagline),
  description: textOf(raw.description),
  url: textOf(raw.url),
  socials: objectOf(raw.socials),
  newsletter: { endpoint: textOf(objectOf(raw.newsletter).endpoint) },
  contact: { endpoint: textOf(objectOf(raw.contact).endpoint) },
  nav: Array.isArray(raw.nav) ? raw.nav.filter((n: any) => n && typeof n === 'object') : undefined,
  logo: logoOf(raw.logo),
  postBadges: ['icon', '3d', 'none'].includes(raw.postBadges) ? raw.postBadges : '3d',
} as SiteConfig;

/** Page <title>: "<title> — <name>" for sub-pages; pass no argument to use the masthead
 *  as the title segment ("<masthead> — <name>"). */
export function pageTitle(title?: string): string {
  return title ? `${title} — ${site.name}` : `${site.masthead} — ${site.name}`;
}
