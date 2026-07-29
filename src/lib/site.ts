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
  /** Header/footer nav. Optional: when absent, Base.astro falls back to its built-in nav.
   *  `primary` items show in the mobile quick-access row; `themeLabel` items are renamed
   *  from the active full-theme vocabulary. */
  nav?: Array<{ href: string; label: string; primary?: boolean; themeLabel?: boolean }>;
}

export const site = siteData as SiteConfig;

/** Page <title>: "<title> — <name>" for sub-pages; pass no argument to use the masthead
 *  as the title segment ("<masthead> — <name>"). */
export function pageTitle(title?: string): string {
  return title ? `${title} — ${site.name}` : `${site.masthead} — ${site.name}`;
}
