// Shared contract for the per-archetype homepages (src/components/home/Home*.astro).
// index.astro shapes the blog collection ONCE into these plain objects and passes them
// to whichever Home component the active theme's `hero` archetype selects. Keeping the
// shape here (not astro:content types) lets every archetype stay a small, self-contained
// presentational component.

export interface HomeTopicRef {
  /** Broad topic display name, e.g. "The Workshop". */
  name: string;
  /** Topic accent colour (hex). */
  color: string;
  /** Topic slug/tag, e.g. "forge". */
  tag: string;
}

export interface HomePost {
  image?: {src:string;alt:string}|null;
  slug: string;
  /** base-aware href to the post. */
  href: string;
  title: string;
  description: string;
  date: Date;
  /** raw tags (broad + narrow), interactive included. */
  tags: string[];
  /** the post's own accent colour (hex). */
  accent: string;
  /** optional glyph id (three.js/SVG glyph name from the frontmatter). */
  glyph?: string;
  /** primary broad topic (first tag that is a topic), or null. */
  topic: HomeTopicRef | null;
  /** true when tagged "interactive". */
  interactive: boolean;
  /** rough reading time in minutes. */
  readMins: number;
}

export interface HomeConstellation {
  name: string;
  subtitle: string;
  tag: string;
  color: string;
  blurb: string;
  count: number;
  /** base-aware href to the topic page. */
  href: string;
}

export interface HomeProps {
  /** all non-draft posts, newest first. topic.name and topics[].name are already
   *  relabelled with the active theme's vocabulary. */
  posts: HomePost[];
  /** the 7 broad topics with post counts + hrefs (names theme-relabelled). */
  topics: HomeConstellation[];
  /** site.masthead — the blog's display name. */
  masthead: string;
  /** the blog's tagline (user's own, or the theme's demo tagline for the seed). */
  tagline: string;
  /** site.name — the author. */
  name: string;
  /** base-aware common hrefs. */
  postsHref: string;
  aboutHref: string;
  observatoryHref: string;
  /** newsletter form endpoint. */
  newsletterEndpoint: string;
  /** per-theme vocabulary for section headings/links. */
  postsTitle: string;
  topicsLabel: string;
  aboutLabel: string;
}

const DTF = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
/** "5 Jun 2026" */
export const fmtDate = (d: Date): string => DTF.format(d);

const DTF_LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
/** "5 June 2026" */
export const fmtDateLong = (d: Date): string => DTF_LONG.format(d);

/** zero-padded 2-digit index, e.g. 3 → "03" (numbered indexes/contact sheets). */
export const pad2 = (n: number): string => String(n).padStart(2, '0');
